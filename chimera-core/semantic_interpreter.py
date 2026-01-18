"""
Semantic Interpreter - Ground Semantic Blueprint intents via Chimera Brain VLM.

Takes a Semantic Blueprint (JSON-LD with intents and visualAnchors) and uses
process_vision to ground each "Intent" onto the current screen. Example: if
the Blueprint says "Find the primary action button," the VLM returns coordinates.
"""

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


async def ground_intent(worker: Any, description: str, context: str = "semantic") -> Dict[str, Any]:
    """
    Use Chimera Brain VLM to ground one intent onto the current screen.
    Returns { "x", "y", "found", "confidence", "coordinate_drift" }.
    """
    page = getattr(worker, "_page", None)
    if not page:
        return {"found": False, "x": None, "y": None}
    try:
        shot = await worker.take_screenshot()
        coords = await worker.process_vision(shot, context=context, text_command=description)
        if not coords:
            return {"found": False, "x": None, "y": None}
        return {
            "found": bool(coords.get("found")),
            "x": coords.get("x"),
            "y": coords.get("y"),
            "confidence": coords.get("confidence"),
            "coordinate_drift": coords.get("coordinate_drift", False),
        }
    except Exception as e:
        logger.debug("semantic ground_intent %s: %s", description[:40], e)
        return {"found": False, "x": None, "y": None}


async def run_semantic_blueprint(
    worker: Any,
    semantic_blueprint: Dict[str, Any],
    *,
    click_on_found: bool = False,
) -> Dict[str, Any]:
    """
    Run a Semantic Blueprint: for each intent, call the VLM to ground it.
    Optionally click on found coordinates. Returns a map intent_id -> {x, y, found, ...}.
    """
    intents: List[Dict[str, Any]] = semantic_blueprint.get("intents") or []
    out: Dict[str, Any] = {}

    for it in intents:
        iid = it.get("id") or "unknown"
        desc = it.get("description") or ""
        if not desc:
            continue
        r = await ground_intent(worker, desc, context="semantic_blueprint")
        out[iid] = r
        if click_on_found and r.get("found") and r.get("x") is not None and r.get("y") is not None:
            try:
                page = getattr(worker, "_page", None)
                if page:
                    await page.mouse.click(float(r["x"]), float(r["y"]))
            except Exception as e:
                logger.debug("semantic click %s: %s", iid, e)

    return {"intents": out}
