"""
Enhanced Station Base Class with Contracts & Prerequisites
"""
from abc import ABC, abstractmethod
from typing import Set, Tuple, Dict, Any
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
        
        This is the public interface - stations should implement process(), not execute().
        
        Args:
            ctx: Pipeline context with current data and state
            
        Returns:
            Tuple of (new_data_dict, stop_condition)
        """
        # 1. Automatic Prerequisite Check
        missing = self.required_inputs - ctx.available_fields
        if missing:
            error_msg = f"Missing required inputs: {missing}"
            return {}, StopCondition.FAIL
            
        # 2. Budget Check
        if not ctx.can_afford(self.cost_estimate):
            error_msg = f"Budget exceeded: ${ctx.total_cost:.2f} + ${self.cost_estimate:.2f} > ${ctx.budget_limit:.2f}"
            return {}, StopCondition.SKIP_REMAINING

        # 3. Run Logic
        try:
            return await self.process(ctx)
        except Exception as e:
            error_msg = str(e)
            return {}, StopCondition.FAIL

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
