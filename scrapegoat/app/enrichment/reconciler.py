"""
Reconciler - Merge conflicting data points into a single Golden Record.

Uses GPS Success Heatmap weights: higher success_rate provider wins for each field.
Lightweight logic: no SLM required; optional SLM can be wired later.
"""

import os
from typing import Any, Dict, List, Optional

try:
    from app.pipeline.router import get_rankings
    ROUTER_AVAILABLE = True
except ImportError:
    ROUTER_AVAILABLE = False

_FIELDS = ("phone", "age", "income", "email", "address", "city", "state", "zipcode")


def _get_weights(r=None) -> Dict[str, float]:
    """Weights from GPS rankings: provider -> success_rate/100."""
    if not ROUTER_AVAILABLE or r is None:
        return {}
    try:
        ranks = get_rankings(r)
        return {x["provider"]: x["success_rate"] / 100.0 for x in ranks}
    except Exception:
        return {}


def _non_null(val: Any) -> bool:
    if val is None:
        return False
    if isinstance(val, str) and not val.strip():
        return False
    return True


def reconcile_results(
    list_of_site_data: List[Dict[str, Any]],
    r=None,
) -> Dict[str, Any]:
    """
    Merge conflicting data points into a single Golden Record using GPS weights.

    list_of_site_data: [ {"provider": "TruePeopleSearch", "phone": "...", "age": 1, ... }, ... ]
    Returns: one dict with the best value per field (by provider weight). Prefer non-null.
    """
    weights = _get_weights(r)
    if not weights:
        weights = {d.get("provider", ""): 0.5 for d in list_of_site_data}

    out: Dict[str, Any] = {}
    for field in _FIELDS:
        best_val: Any = None
        best_w = -1.0
        for rec in list_of_site_data:
            v = rec.get(field)
            if not _non_null(v):
                continue
            p = rec.get("provider", "")
            w = weights.get(p, 0.5)
            if w > best_w:
                best_w = w
                best_val = v
        if best_val is not None:
            out[field] = best_val

    # Preserve any extra fields from the highest-weight provider that has them
    for rec in list_of_site_data:
        p = rec.get("provider", "")
        if weights.get(p, 0) < 0.5:
            continue
        for k, v in rec.items():
            if k in _FIELDS or k in ("provider",):
                continue
            if _non_null(v) and k not in out:
                out[k] = v

    return out
