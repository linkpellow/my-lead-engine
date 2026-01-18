"""
Blueprint Interpreter - Execute instructions from BLUEPRINT:{domain}.

Runs click, input, vlm_ground, goto, wait from the Blueprint's instructions array.
Uses the worker's page, process_vision (VLM), and safe_click.
"""

import asyncio
import logging
import re
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def _expand(value: str, lead: Dict[str, Any]) -> str:
    """Replace {{key}} with lead[key]."""
    if not value or not isinstance(value, str):
        return str(value or "")
    for k, v in (lead or {}).items():
        if v is None:
            continue
        value = value.replace("{{" + str(k) + "}}", str(v))
    return value


async def execute_blueprint_instructions(worker: Any, mission: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run the Blueprint's instructions. Uses worker._page, worker.process_vision, worker.safe_click.
    """
    blueprint = mission.get("blueprint") or {}
    instructions = blueprint.get("instructions") or mission.get("instructions") or []
    if not isinstance(instructions, list):
        instructions = []

    lead = mission.get("lead") or {}
    page = getattr(worker, "_page", None)
    if not page:
        return {"status": "failed", "error": "no_page"}

    mission_id = mission.get("mission_id") or mission.get("id") or "blueprint"

    for i, step in enumerate(instructions):
        if not isinstance(step, dict):
            continue
        typ = (step.get("type") or step.get("action") or "").strip().lower()

        if typ == "goto":
            url = _expand(step.get("url") or "", lead)
            if url:
                await page.goto(url, wait_until=step.get("wait_until") or "domcontentloaded", timeout=int(step.get("timeout") or 45000))
            continue

        if typ == "wait":
            sec = step.get("seconds") or 0
            ms = step.get("ms") or 0
            if ms:
                await asyncio.sleep(ms / 1000.0)
            else:
                await asyncio.sleep(float(sec))
            continue

        if typ == "click":
            sel = step.get("selector") or step.get("sel")
            if sel:
                try:
                    if hasattr(worker, "safe_click"):
                        await worker.safe_click(str(sel), timeout=int(step.get("timeout") or 30000), intent=step.get("intent") or "blueprint_click")
                    else:
                        await page.click(sel, timeout=int(step.get("timeout") or 30000))
                except Exception as e:
                    logger.warning("Blueprint click %s: %s", sel, e)
            continue

        if typ in ("input", "type", "fill"):
            sel = step.get("selector") or step.get("sel")
            val = _expand(step.get("value") or step.get("text") or "", lead)
            if sel is not None:
                try:
                    await page.fill(str(sel), str(val))
                    if step.get("press_enter"):
                        await page.keyboard.press("Enter")
                except Exception as e:
                    logger.warning("Blueprint fill %s: %s", sel, e)
            continue

        if typ in ("vlm_ground", "vlm", "vision"):
            intent = step.get("intent") or step.get("text_command") or step.get("text") or "primary action"
            try:
                shot = await worker.take_screenshot()
                coords = await worker.process_vision(shot, context=step.get("context") or "blueprint", text_command=intent)
                if coords and coords.get("found") and coords.get("x") is not None and coords.get("y") is not None:
                    await page.mouse.click(float(coords["x"]), float(coords["y"]))
                else:
                    logger.warning("Blueprint vlm_ground: no coords for %s", intent)
            except Exception as e:
                logger.warning("Blueprint vlm_ground %s: %s", intent, e)
            continue

        logger.debug("Blueprint: unknown step type %s", typ)

    return {"mission_id": mission_id, "status": "completed", "blueprint_done": True}
