"""
Chimera enrichment pipeline exceptions.

Use ChimeraEnrichmentError for failures where we need to know precisely:
- which step failed (step)
- why (reason)
- how to fix it (suggested_fix, optional)

All enrichment-related functions should use structured try/except and either
raise this or log with equivalent context (step, input, exception).
"""
from typing import Optional


class ChimeraEnrichmentError(Exception):
    """
    Domain exception for chimera enrichment failures.
    Enables precise failure localization: what failed, when, and how to fix.
    """

    def __init__(
        self,
        step: str,
        reason: str,
        suggested_fix: Optional[str] = None,
    ):
        self.step = step
        self.reason = reason
        self.suggested_fix = suggested_fix
        super().__init__(f"[{step}] {reason}")
