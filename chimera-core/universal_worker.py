"""
Universal Worker - Blueprint Interpreter driven.

Uses the Blueprint's instructions field for clicks, input, and VLM grounding
instead of domain-specific logic. When mission.blueprint.instructions exists,
runs blueprint_interpreter.execute_blueprint_instructions; otherwise delegates
to PhantomWorker (deep_search, sequence, etc.).
"""

from workers import PhantomWorker

# UniversalWorker is PhantomWorker with Blueprint-first branch in execute_mission.
# The logic lives in PhantomWorker; use this class when you want the Blueprint Interpreter.
UniversalWorker = PhantomWorker

__all__ = ["UniversalWorker"]
