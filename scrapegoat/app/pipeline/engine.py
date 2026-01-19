"""
Pipeline Engine: Orchestrates stations with stop conditions and cost tracking.
Failures are localized with step, reason, and suggested_fix when stations raise
ChimeraEnrichmentError. Structured logging: every transition, decision, and halt.
"""
import datetime
import time

from loguru import logger

from typing import Any, Dict, List, Optional

from .exceptions import ChimeraEnrichmentError
from .logging_util import pipeline_log
from .station import PipelineStation
from .types import PipelineContext, StopCondition


class PipelineEngine:
    """
    Production-Grade Pipeline Engine
    
    Features:
    - Contract enforcement (prerequisites)
    - Budget management (auto stop-loss)
    - Stop conditions (early termination)
    - Full cost tracking
    - Error handling
    """
    
    def __init__(self, route: List[PipelineStation], budget_limit: float = 5.0):
        """
        Initialize pipeline engine with a route of stations.
        
        Args:
            route: Ordered list of stations to execute
            budget_limit: Maximum cost per lead (default: $5.00)
        """
        self.route = route
        self.budget_limit = budget_limit
    
    async def run(
        self,
        initial_data: Dict[str, Any],
        step_collector: Optional[List[Dict[str, Any]]] = None,
        log_buffer: Optional[List[str]] = None,
        progress_queue: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Execute the pipeline route with full tracking.
        step_collector: If provided, append per-station {station, duration_ms, condition, status, error?, recent_logs?}.
        log_buffer: If provided, on station exception the failing step gets recent_logs=last 20 lines for where/why.
        progress_queue: If provided (queue.Queue), put {step, total, pct, station, status, message, duration_ms?} at start/end of each station for streaming UX.
        """
        data = initial_data.copy()
        if not data.get("name") and (data.get("fullName") or data.get("full_name") or data.get("Name")):
            data["name"] = data.get("fullName") or data.get("full_name") or data.get("Name") or ""
            pipeline_log(progress_queue, "Pipeline", "name_normalized", f"from fullName/full_name/Name -> name={repr((data.get('name') or '')[:60])}")
        if not data.get("name") and (data.get("firstName") or data.get("lastName") or data.get("first_name") or data.get("last_name")):
            data["name"] = f"{data.get('firstName') or data.get('first_name') or ''} {data.get('lastName') or data.get('last_name') or ''}".strip()
            pipeline_log(progress_queue, "Pipeline", "name_normalized", f"from firstName+lastName -> name={repr((data.get('name') or '')[:60])}")
        ctx = PipelineContext(data=data, budget_limit=self.budget_limit, progress_queue=progress_queue)
        steps = step_collector
        N = len(self.route)

        pipeline_log(progress_queue, "Pipeline", "start", f"stations={N} route=[{', '.join(s.name for s in self.route)}] budget=${self.budget_limit:.2f} lead_name={repr((data.get('name') or '')[:50]) or '?'}")

        for i, station in enumerate(self.route):
            t0 = time.perf_counter()
            started_at = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
            pipeline_log(progress_queue, "Pipeline", "station_enter", f"({i+1}/{N}) {station.name} — starting")
            if progress_queue is not None:
                progress_queue.put_nowait({
                    "step": i + 1, "total": N, "pct": int(i / N * 100),
                    "station": station.name, "status": "running",
                    "message": f"Starting {station.name}",
                })
            try:
                result_data, condition = await station.execute(ctx)
                duration_ms = int((time.perf_counter() - t0) * 1000)
                status = "ok" if condition == StopCondition.CONTINUE else ("stop" if condition == StopCondition.SKIP_REMAINING else "fail")
                pipeline_log(progress_queue, "Pipeline", "station_exit", f"{station.name} condition={condition.value} status={status} duration_ms={duration_ms} cost={station.cost_estimate:.4f}")
                if steps is not None:
                    steps.append({"station": station.name, "started_at": started_at, "duration_ms": duration_ms, "condition": condition.value, "status": status})
                if progress_queue is not None:
                    progress_queue.put_nowait({
                        "step": i + 1, "total": N, "pct": int((i + 1) / N * 100),
                        "station": station.name, "status": status, "duration_ms": duration_ms,
                        "message": f"{station.name} done" if status == "ok" else f"{station.name} {status}",
                    })
                actual_cost = station.cost_estimate
                ctx.update(result_data, station.name, actual_cost, condition)
                if condition == StopCondition.SKIP_REMAINING:
                    pipeline_log(progress_queue, "Pipeline", "stop_condition", f"SKIP_REMAINING at {station.name} — finishing early")
                    break
                if condition == StopCondition.FAIL:
                    pipeline_log(progress_queue, "Pipeline", "station_fail", f"{station.name} returned FAIL — continuing to next station")
                    continue
            except ChimeraEnrichmentError as e:
                duration_ms = int((time.perf_counter() - t0) * 1000)
                recent = (log_buffer[-20:] if log_buffer and len(log_buffer) > 0 else []) if log_buffer else []
                err_msg = f"{e.reason} (step={e.step})"
                if e.suggested_fix:
                    err_msg += f" [suggested_fix: {e.suggested_fix}]"
                pipeline_log(progress_queue, "Pipeline", "station_error", f"{station.name} ChimeraEnrichmentError reason={e.reason} step={e.step} suggested_fix={e.suggested_fix or 'none'}")
                if steps is not None:
                    step_entry = {"station": station.name, "started_at": started_at, "duration_ms": duration_ms, "condition": "fail", "status": "fail", "error": err_msg}
                    if e.suggested_fix:
                        step_entry["suggested_fix"] = e.suggested_fix
                    if recent:
                        step_entry["recent_logs"] = recent
                    steps.append(step_entry)
                if progress_queue is not None:
                    progress_queue.put_nowait({
                        "step": i + 1, "total": N, "pct": int((i + 1) / N * 100),
                        "station": station.name, "status": "fail", "duration_ms": duration_ms,
                        "message": f"{station.name} failed", "error": err_msg,
                    })
                logger.exception("💥 ChimeraEnrichmentError at %s: step=%s reason=%s", station.name, e.step, e.reason)
                if e.suggested_fix:
                    logger.info("  Suggested fix: %s", e.suggested_fix)
                ctx.errors.append(err_msg)
            except Exception as e:
                duration_ms = int((time.perf_counter() - t0) * 1000)
                recent = (log_buffer[-20:] if log_buffer and len(log_buffer) > 0 else []) if log_buffer else []
                pipeline_log(progress_queue, "Pipeline", "station_error", f"{station.name} Exception: {str(e)[:300]}")
                if steps is not None:
                    step_entry = {"station": station.name, "started_at": started_at, "duration_ms": duration_ms, "condition": "fail", "status": "fail", "error": str(e)}
                    if recent:
                        step_entry["recent_logs"] = recent
                    steps.append(step_entry)
                if progress_queue is not None:
                    progress_queue.put_nowait({
                        "step": i + 1, "total": N, "pct": int((i + 1) / N * 100),
                        "station": station.name, "status": "fail", "duration_ms": duration_ms,
                        "message": f"{station.name} failed", "error": str(e),
                    })
                logger.exception("💥 Critical Failure at %s: %s", station.name, e)
                ctx.errors.append(str(e))
        
        pipeline_log(progress_queue, "Pipeline", "complete", f"cost=${ctx.total_cost:.4f} stations_executed={len(ctx.history)} errors={len(ctx.errors)}")
        if ctx.errors:
            logger.warning(f"⚠️  {len(ctx.errors)} errors encountered")
        
        # Add pipeline metadata to final data
        final_data = ctx.data.copy()
        final_data['_pipeline_cost'] = ctx.total_cost
        final_data['_pipeline_stations_executed'] = len(ctx.history)
        final_data['_pipeline_errors'] = len(ctx.errors)
        
        return final_data
    
    def visualize_route(self) -> str:
        """
        Generate a visual representation of the pipeline route.
        
        Returns:
            String representation of the pipeline graph
        """
        lines = ["Pipeline Route:"]
        for i, station in enumerate(self.route, 1):
            inputs = ", ".join(sorted(station.required_inputs)) or "none"
            outputs = ", ".join(sorted(station.produces_outputs)) or "none"
            cost = f"${station.cost_estimate:.4f}"
            
            lines.append(f"  {i}. {station.name}")
            lines.append(f"     Requires: [{inputs}]")
            lines.append(f"     Produces: [{outputs}]")
            lines.append(f"     Cost: {cost}")
        
        return "\n".join(lines)
