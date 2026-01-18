"""
Anti-Poisoning & Honey Pot Guard (The Shield).

VLM-Verified Interaction (check_before_selector_click):
  - Takes a screenshot and asks the VLM to find the visible clickable element
    (described by the target's text/aria-label/placeholder or intent).
  - If the element exists in the DOM but: (a) has no bounding box (hidden),
    (b) the VLM finds nothing, or (c) the VLM finds something at a different
    location (spatial mismatch), it is flagged as HONEYPOT_TRAP and the click
    is skipped. The pipeline uses this in workers.safe_click before every
    selector click.

Forbidden Regions: Dojo-painted red zones (rects, selectors) from dojo:forbidden:{domain}.
If a click would land in a forbidden rect or use a forbidden selector, it is blocked.
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

FORBIDDEN_PREFIX = "dojo:forbidden:"
_redis = None


def _get_redis():
    global _redis
    if _redis is not None:
        return _redis
    url = os.getenv("REDIS_URL") or os.getenv("APP_REDIS_URL")
    if not url:
        return None
    try:
        import redis
        _redis = redis.from_url(url, decode_responses=True)
        return _redis
    except Exception:
        return None


def _domain_from_url(url: str) -> str:
    if not url:
        return ""
    return (urlparse(url).hostname or "").replace("www.", "").split("/")[0]


def get_forbidden_regions(domain: str) -> Dict[str, List[Any]]:
    """Load Dojo forbidden regions from Redis. Keys: rects, selectors."""
    r = _get_redis()
    if not r or not domain:
        return {"rects": [], "selectors": []}
    try:
        raw = r.get(f"{FORBIDDEN_PREFIX}{domain}")
        if not raw:
            return {"rects": [], "selectors": []}
        data = json.loads(raw) if isinstance(raw, str) else raw
        regs = data if isinstance(data, dict) else {}
        return {
            "rects": regs.get("rects") or [],
            "selectors": regs.get("selectors") or [],
        }
    except Exception:
        return {"rects": [], "selectors": []}


def is_in_forbidden_region(domain: str, x: float, y: float) -> bool:
    """True if (x,y) lies inside any forbidden rect."""
    regs = get_forbidden_regions(domain)
    for r in regs.get("rects") or []:
        rx = float(r.get("x") or 0)
        ry = float(r.get("y") or 0)
        w = float(r.get("width") or 0)
        h = float(r.get("height") or 0)
        if rx <= x <= rx + w and ry <= y <= ry + h:
            return True
    return False


def is_selector_forbidden(domain: str, selector: str) -> bool:
    """True if selector is in the Dojo forbidden list."""
    regs = get_forbidden_regions(domain)
    sel = (selector or "").strip()
    for s in regs.get("selectors") or []:
        if (s or "").strip() == sel:
            return True
    return False


# L1 distance (px): VLM coords must be this close to the target element's center.
# If the VLM finds something far away, the target is "in DOM but not on Visual Map" (honeypot).
_VLM_SPATIAL_TOLERANCE_PX = 120


async def check_before_selector_click(
    worker: Any,
    selector: str,
    intent: str = "click_element",
) -> Tuple[bool, bool]:
    """
    VLM-Verified Interaction: take a screenshot and verify the target element is
    visible on the Visual Map before clicking. If it exists in the DOM but is
    missing from the VLM map (or VLM finds a different element elsewhere), it is
    flagged as HONEYPOT_TRAP and skipped. Also enforces Dojo forbidden regions.

    Flow:
      1) Forbidden selector → HONEYPOT
      2) Resolve selector to element; no box (hidden/not rendered) → HONEYPOT
      3) Screenshot + VLM "Find the visible clickable element: {description}"
      4) VLM found nothing → HONEYPOT (element not on Visual Map)
      5) VLM (x,y) far from element center → HONEYPOT (VLM found a different element)
      6) Forbidden rect at (x,y) → HONEYPOT

    Returns:
        (ok, honeypot): ok=True => safe to click; honeypot=True => HONEYPOT_TRAP, do not click.
    """
    page = getattr(worker, "_page", None)
    if not page:
        return (False, False)

    domain = _domain_from_url(page.url)

    # 1) Forbidden selector
    if is_selector_forbidden(domain, selector):
        logger.warning("HONEYPOT_TRAP: selector in Dojo forbidden list: %s", (selector or "")[:80])
        return (False, True)

    # 2) Resolve target element and its bbox (element in DOM but not rendered → HONEYPOT)
    try:
        elem = await page.query_selector(selector)
    except Exception:
        elem = None
    if not elem:
        return (False, False)  # not in DOM; let caller handle

    try:
        box = await elem.bounding_box()
    except Exception:
        box = None
    if not box or not isinstance(box, dict):
        logger.warning("HONEYPOT_TRAP: element has no bounding box (hidden/not rendered) selector=%s", (selector or "")[:60])
        return (False, True)

    # Description for VLM (tie check to this specific element)
    desc = intent
    try:
        raw = await elem.evaluate(
            "el => (el.innerText||'').trim().slice(0,80) || (el.getAttribute('aria-label')||'') || (el.getAttribute('placeholder')||'') || el.tagName"
        )
        if raw and isinstance(raw, str) and raw.strip():
            desc = raw.strip()[:80]
    except Exception:
        pass

    # 3) Screenshot + VLM: is this element on the Visual Map?
    try:
        shot = await worker.take_screenshot()
        cmd = f"Find the visible clickable element: {desc}" if desc else "Find the visible clickable element for this action"
        coords = await worker.process_vision(shot, context="visibility_check", text_command=cmd)
        # Brain unavailable (coords is None) -> fail open to avoid blocking
        if coords is None:
            return (True, False)
        if not coords.get("found") or coords.get("x") is None or coords.get("y") is None:
            logger.warning("HONEYPOT_TRAP: element not on Visual Map (VLM found nothing) for selector=%s desc=%s", (selector or "")[:50], (desc or "")[:40])
            return (False, True)
        xv, yv = float(coords["x"]), float(coords["y"])
    except Exception as e:
        logger.debug("visibility_check VLM failed (non-fatal): %s", e)
        return (False, True)

    # 4) Spatial consistency: VLM must have found *this* element, not a different one.
    # If VLM coords are far from our element's center, the target is in DOM but not on the Visual Map.
    cx = float(box.get("x", 0)) + float(box.get("width", 0)) / 2.0
    cy = float(box.get("y", 0)) + float(box.get("height", 0)) / 2.0
    l1 = abs(xv - cx) + abs(yv - cy)
    if l1 > _VLM_SPATIAL_TOLERANCE_PX:
        logger.warning(
            "HONEYPOT_TRAP: element in DOM but not on Visual Map (VLM found another at %.0f,%.0f; target center %.0f,%.0f L1=%.0f)",
            xv, yv, cx, cy, l1,
        )
        return (False, True)

    # 5) Forbidden rect at VLM coords (or effectively at target; they are close)
    if is_in_forbidden_region(domain, xv, yv):
        logger.warning("HONEYPOT_TRAP: coords (%.0f,%.0f) in Dojo forbidden region", xv, yv)
        return (False, True)

    return (True, False)


def check_before_coords_click(worker: Any, x: float, y: float) -> bool:
    """
    Before clicking at (x,y) from VLM: ensure not in a Dojo forbidden rect.
    Returns True if safe to click, False if in forbidden zone.
    """
    page = getattr(worker, "_page", None)
    if not page:
        return True
    domain = _domain_from_url(page.url)
    if is_in_forbidden_region(domain, x, y):
        logger.warning("HONEYPOT_TRAP: coords (%.0f,%.0f) in Dojo forbidden region", x, y)
        return False
    return True
