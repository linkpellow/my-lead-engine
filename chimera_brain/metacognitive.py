"""
Metacognitive Reflection - The ReAct Loop

This module implements self-critique before actions to avoid traps and mistakes.
Instead of just "seeing and clicking," the AI analyzes, critiques, reflects, and then decides.

The Logic: Before sending the command to the Rust body, the AI must Critique its own plan.
"""

import json
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class MetacognitiveReflection:
    """
    Metacognitive Reflection Engine
    
    Implements Chain of Thought (CoT) reasoning with self-critique
    to catch mistakes before they happen.
    """
    
    def __init__(self):
        """Initialize the Metacognitive Reflection engine"""
        logger.info("Initializing Metacognitive Reflection (ReAct Loop)")
    
    def build_reflection_prompt(
        self,
        objective: str,
        ax_tree_summary: str,
        screenshot_description: str,
        proposed_action: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Build a Chain of Thought prompt with self-critique
        
        Args:
            objective: The goal we're trying to achieve
            ax_tree_summary: Summary of AX tree (semantic structure)
            screenshot_description: Description of visual state
            proposed_action: Optional proposed action to critique
        
        Returns:
            Formatted prompt for LLM with CoT reasoning
        """
        prompt = f"""GOAL: {objective}

CURRENT STATE:
- Visual: {screenshot_description}
- Semantic (AX Tree): {ax_tree_summary}

INSTRUCTIONS (Chain of Thought Reasoning):
1. ANALYZE: What specific elements are blocking the goal?
   - Identify all clickable elements
   - Identify all input fields
   - Identify any blockers (popups, modals, etc.)

2. CRITIQUE: Evaluate potential actions for safety
   - If I click the biggest/most prominent button, is it a trap?
   - Check for honeypots: elements with 'display:none', invisible overlays, or suspicious positioning
   - Are there multiple similar buttons? Which one is the correct target?
   - Does the target element have proper accessibility attributes?

3. REFLECT: Consider past failures
   - Have I tried similar actions before and failed?
   - Are there patterns in the page structure that suggest a different approach?
   - Is there a safer alternative action?

4. DECIDE: Output the final action plan
   - Choose the safest, most reliable action
   - Provide reasoning for why this action is correct
   - Include fallback options if this fails

OUTPUT FORMAT (JSON):
{{
  "thought_process": "Detailed reasoning about why this action is correct and safe",
  "confidence": 0.0-1.0,
  "warnings": ["Any potential risks or concerns"],
  "action": {{
    "type": "click|type|scroll|wait",
    "target": "description or selector",
    "coordinates": {{"x": 0, "y": 0}},
    "value": "optional value for type actions"
  }},
  "fallback": {{
    "action": "alternative action if primary fails",
    "coordinates": {{"x": 0, "y": 0}}
  }}
}}
"""
        return prompt
    
    def critique_action(
        self,
        action: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Critique a proposed action for safety
        
        Args:
            action: The proposed action to critique
            context: Current context (AX tree, screenshot, history)
        
        Returns:
            Critique with warnings and recommendations
        """
        warnings = []
        risk_level = "low"
        
        # Rule-based critique (can be enhanced with LLM)
        if action.get("type") == "click":
            # Check for common honeypot patterns
            ax_tree = context.get("ax_tree", "")
            
            if "display:none" in str(ax_tree):
                warnings.append("Potential honeypot: Element may be hidden")
                risk_level = "medium"
            
            if "overlay" in str(ax_tree).lower() or "modal" in str(ax_tree).lower():
                warnings.append("Warning: Overlay detected - ensure target is not blocked")
                risk_level = "medium"
            
            # Check if target is too small (might be a trap)
            if "bounds" in action:
                width = action["bounds"].get("width", 0)
                height = action["bounds"].get("height", 0)
                if width < 10 or height < 10:
                    warnings.append("Warning: Target is very small - may be a trap")
                    risk_level = "high"
        
        return {
            "risk_level": risk_level,
            "warnings": warnings,
            "recommended": risk_level != "high"
        }
    
    def parse_reflection_response(self, response: str) -> Dict[str, Any]:
        """
        Parse LLM response from reflection prompt
        
        Args:
            response: LLM response (should be JSON)
        
        Returns:
            Parsed action plan with thought process
        """
        try:
            # Try to extract JSON from response
            # LLMs sometimes wrap JSON in markdown code blocks
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()
            elif "```" in response:
                json_start = response.find("```") + 3
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()
            
            parsed = json.loads(response)
            return parsed
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse reflection response: {e}")
            # Return safe fallback
            return {
                "thought_process": "Failed to parse reflection, using default action",
                "confidence": 0.5,
                "warnings": ["Could not parse LLM response"],
                "action": {
                    "type": "wait",
                    "target": "unknown",
                    "coordinates": {"x": 0, "y": 0}
                }
            }
