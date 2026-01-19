"""
Enhanced Station Base Class with Contracts & Prerequisites
"""
from abc import ABC, abstractmethod
from typing import Set, Tuple, Dict, Any

from loguru import logger

from .types import PipelineContext, StopCondition


class PipelineStation(ABC):
    """
    Pipeline Station: A single step in the enrichment journey
    
    Each station has:
    - Prerequisites (required_inputs): What fields must exist to run?
    - Outputs (produces_outputs): What fields will this station add?
    - Cost Estimate: How much will this cost?
    - Stop Conditions: When should we stop processing?
    """
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable station name"""
        pass

    @property
    def required_inputs(self) -> Set[str]:
        """
        Contract: I need these fields to operate.
        
        Returns:
            Set of field names that must exist in context.data
        """
        return set()

    @property
    def produces_outputs(self) -> Set[str]:
        """
        Contract: I promise to find these fields.
        
        Returns:
            Set of field names this station will add to context.data
        """
        return set()

    @property
    def cost_estimate(self) -> float:
        """
        Estimated cost for budget checks.
        
        Returns:
            Estimated cost in dollars (e.g., 0.02 for API call)
        """
        return 0.0

    async def execute(self, ctx: PipelineContext) -> Tuple[Dict[str, Any], StopCondition]:
        """
        Execute station with automatic prerequisite and budget checks.
        Logs start/complete; lets process() exceptions propagate to the engine
        for precise failure localization (step, reason, suggested_fix).
        """
        logger.info("Starting step: %s", self.name)

        # 1. Prerequisite check
        missing = self.required_inputs - ctx.available_fields
        if missing:
            logger.warning("Step %s: missing required inputs: %s", self.name, missing)
            return {}, StopCondition.FAIL

        # 2. Budget check
        if not ctx.can_afford(self.cost_estimate):
            logger.warning(
                "Step %s: budget exceeded (total=%.2f + %.2f > limit=%.2f)",
                self.name, ctx.total_cost, self.cost_estimate, ctx.budget_limit,
            )
            return {}, StopCondition.SKIP_REMAINING

        # 3. Run logic – let exceptions propagate to engine for structured handling
        result_data, condition = await self.process(ctx)
        logger.info("Completed step: %s (condition=%s)", self.name, condition.value)
        return result_data, condition

    @abstractmethod
    async def process(self, ctx: PipelineContext) -> Tuple[Dict[str, Any], StopCondition]:
        """
        Implement actual station logic here.
        
        Args:
            ctx: Pipeline context with current data
            
        Returns:
            Tuple of (new_data_dict, stop_condition)
            
        Example:
            result = await some_api_call(ctx.data)
            return {"phone": result["phone"]}, StopCondition.CONTINUE
        """
        pass
