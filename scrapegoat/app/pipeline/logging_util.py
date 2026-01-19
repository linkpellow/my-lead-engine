"""
Structured pipeline logging: every micro-event, decision, and transition.
Logs to stdout (loguru) and optionally to progress_queue for real-time streaming.
Format: [Component] action: detail — zero ambiguity about what is happening or why progress halted.
"""
import datetime
from typing import Any, Optional

from loguru import logger


def pipeline_log(
    progress_queue: Optional[Any],
    component: str,
    action: str,
    detail: str,
) -> None:
    """
    Emit a structured log: stdout (Railway/logs) and progress_queue (NDJSON stream).
    Use for: pipeline transitions, decisions, halts, and micro-events.
    """
    msg = f"[{component}] {action}: {detail}"
    logger.info(msg)
    if progress_queue is not None:
        try:
            progress_queue.put_nowait({
                "event": "log",
                "component": component,
                "action": action,
                "detail": detail[:500] if detail else "",
                "ts": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            })
        except Exception:
            pass


def station_emit(
    progress_queue: Optional[Any],
    station_name: str,
    substep: str,
    detail: str,
) -> None:
    """
    Emit a station-level micro-event: stdout and progress_queue.
    Same as _emit in BlueprintLoader/ChimeraStation; also logs to stdout.
    """
    msg = f"[{station_name}] {substep}: {detail}"
    logger.info(msg)
    if progress_queue is not None:
        try:
            progress_queue.put_nowait({
                "station": station_name,
                "substep": substep,
                "detail": detail[:500] if detail else "",
                "ts": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            })
        except Exception:
            pass
