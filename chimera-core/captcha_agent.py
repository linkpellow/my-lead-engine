"""
2026 Agentic VLM CAPTCHA Solver (Tier 2).

CoT (Chain-of-Thought) grounding: VLM reasons over a visual puzzle and returns
tile center coordinates. We execute clicks with biological tremor (human_mouse_move).
No API cost. Fallback to CapSolver (Tier 3) when VLM fails after max_attempts.

3-Tier: (1) Stealth/TLS avoids CAPTCHA 80%; (2) VLM Agent; (3) CapSolver.
"""

import re
import random
import logging
from typing import Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

COT_PROMPT = (
    "Task: Visual puzzle. Step 1: Identify all grid or tile boundaries. "
    "Step 2: List which tiles match the instruction (e.g. buses, traffic lights, "
    "or the requested type). Step 3: Give the pixel-center for each selected tile "
    "as [x, y] or 'x y' pairs. If a single element, one pair. Output format: x1,y1 x2,y2 ... or x1 y1, x2 y2. Answer:"
)


def _parse_coords_from_response(description: str, single_x: Optional[int] = None, single_y: Optional[int] = None) -> List[Tuple[int, int]]:
    """Parse 'x y' or 'x,y' pairs from VLM description; include single (x,y) if provided."""
    out: List[Tuple[int, int]] = []
    if single_x is not None and single_y is not None:
        out.append((int(single_x), int(single_y)))
    # Pairs: "100 200" or "100,200" or "(100,200)" or "[100,200]"
    for m in re.finditer(r"[\[]?\s*(\d+)\s*[,]\s*(\d+)\s*[\]]?|\(?\s*(\d+)\s+(\d+)\s*\)?|(\d+)\s+(\d+)", description or ""):
        g = m.groups()
        x = int(g[0] or g[2] or g[4] or 0)
        y = int(g[1] or g[3] or g[5] or 0)
        if (x, y) not in out:
            out.append((x, y))
    return out if out else ([(single_x, single_y)] if single_x is not None and single_y is not None else [])


async def solve_visual_puzzle(
    page: Any,
    worker: Any,
    *,
    prompt_override: Optional[str] = None,
    instruction: str = "tiles with buses or vehicles",
) -> bool:
    """
    CoT VLM: screenshot of puzzle → reason_and_ground → human_mouse_move + click.

    - page: Playwright page (or frame).
    - worker: has process_vision(screenshot, context, text_command) and move_to(x,y).
    - prompt_override: use instead of default CoT + instruction.
    - instruction: semantic target (e.g. "tiles with buses") for the default prompt.

    Returns True if at least one click was executed.
    """
    try:
        # 1. Screenshot (challenge iframe or full page)
        offset_x, offset_y = 0.0, 0.0
        try:
            frame_el = await page.query_selector("iframe[title*='challenge'], iframe[src*='recaptcha'], iframe[src*='hcaptcha']")
            if frame_el:
                fr = await frame_el.content_frame()
                if fr:
                    screenshot = await fr.screenshot()
                    box = await frame_el.bounding_box()
                    if box:
                        offset_x, offset_y = float(box.get("x") or 0), float(box.get("y") or 0)
                else:
                    screenshot = await page.screenshot()
            else:
                screenshot = await page.screenshot()
        except Exception:
            screenshot = await page.screenshot()

        if not screenshot or len(screenshot) < 8:
            return False

        # 2. CoT VLM request (reuse ProcessVision with long prompt)
        text = prompt_override or (COT_PROMPT + " " + instruction)
        coords = await worker.process_vision(screenshot, context="captcha_puzzle", text_command=text)
        if not coords or not coords.get("found"):
            desc = (coords or {}).get("description") or ""
            parsed = _parse_coords_from_response(desc, coords.get("x") if coords else None, coords.get("y") if coords else None)
            if not parsed:
                return False
        else:
            parsed = _parse_coords_from_response(
                (coords or {}).get("description") or "",
                coords.get("x"),
                coords.get("y"),
            )

        # 3. Execution with biological tremor (apply frame offset when coords are in iframe space)
        for (x, y) in parsed:
            x, y = float(x) + offset_x, float(y) + offset_y
            try:
                await worker.move_to(float(x), float(y))
                delay = random.randint(150, 300)
                await page.mouse.click(float(x), float(y), delay=delay)
                logger.info("Captcha agent: clicked (%s, %s) delay=%s", x, y, delay)
                await __import__("asyncio").sleep(0.2 + random.random() * 0.2)
            except Exception as e:
                logger.debug("Captcha agent click (%s,%s): %s", x, y, e)
        return len(parsed) > 0
    except Exception as e:
        logger.debug("solve_visual_puzzle: %s", e)
        return False


async def solve_with_vlm_first(
    page: Any,
    worker: Any,
    max_attempts: int = 2,
) -> bool:
    """
    Tier 2: Try VLM agent up to max_attempts. Returns True if solved, False to fall back to CapSolver (Tier 3).
    """
    for i in range(max_attempts):
        if await solve_visual_puzzle(page, worker):
            return True
        await __import__("asyncio").sleep(0.5 + (i * 0.5))
    return False
