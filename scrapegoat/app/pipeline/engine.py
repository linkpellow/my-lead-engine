"""
Pipeline Engine: Orchestrates stations with stop conditions and cost tracking
"""
from typing import List, Dict, Any, Optional
from loguru import logger
from .types import PipelineContext, StopCondition
from .station import PipelineStation


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
    
    async def run(self, initial_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the pipeline route with full tracking.
        
        Args:
            initial_data: Starting data for the lead
            
        Returns:
            Final enriched data dictionary
        """
        ctx = PipelineContext(data=initial_data.copy(), budget_limit=self.budget_limit)
        
        logger.info(f"🚀 Starting pipeline with {len(self.route)} stations (budget: ${self.budget_limit:.2f})")
        
        for station in self.route:
            try:
                logger.debug(f"📍 Executing: {station.name}")
                
                # Execute handles prerequisites & budget checks internally
                result_data, condition = await station.execute(ctx)
                
                # Calculate actual cost (may differ from estimate)
                actual_cost = station.cost_estimate  # TODO: Stations can report actual cost
                
                # Update Context
                ctx.update(result_data, station.name, actual_cost, condition)
                
                # Handle stop conditions
                if condition == StopCondition.SKIP_REMAINING:
                    logger.info(f"🛑 Stop Condition hit at {station.name}. Finishing early.")
                    logger.info(f"   Reason: Budget or business logic (e.g., DNC hit, invalid phone)")
                    break
                    
                if condition == StopCondition.FAIL:
                    logger.warning(f"⚠️  Station {station.name} failed.")
                    # Policy: Continue to next station (some failures are recoverable)
                    # Alternative: Break here for strict failure handling
                    continue
                
                logger.debug(f"✅ {station.name} completed (cost: ${actual_cost:.4f}, total: ${ctx.total_cost:.4f})")
            
            except Exception as e:
                logger.error(f"💥 Critical Failure at {station.name}: {e}")
                ctx.errors.append(str(e))
                # Continue to next station (resilient pipeline)
        
        # Final summary
        logger.info(f"🏁 Pipeline complete: ${ctx.total_cost:.4f} spent, {len(ctx.history)} stations executed")
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
