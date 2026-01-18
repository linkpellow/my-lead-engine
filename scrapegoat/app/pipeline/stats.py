"""
Carrier Health (GPS Pivot for Mobile Proxies).

When a mobile carrier (e.g. T-Mobile) has a high failure rate on a target domain,
the GPS pivots to prefer a different carrier (e.g. AT&T) for that domain. Chimera
Core receives mission["carrier"] and uses Decodo's carrier suffix when configuring
the proxy.

Redis: carrier_health:{domain} HASH, field=carrier, value="s,f" (success, fail).
"""

import os
from typing import Optional

CARRIER_HEALTH_PREFIX = "carrier_health:"
# Carriers we track; "default" when no carrier was requested
KNOWN_CARRIERS = ["att", "tmobile", "verizon", "sprint", "default"]

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    url = os.getenv("REDIS_URL") or os.getenv("APP_REDIS_URL") or "redis://localhost:6379"
    import redis
    _redis_client = redis.from_url(url, decode_responses=True)
    return _redis_client


def _domain_key(domain: str) -> str:
    d = (domain or "").strip().lower()
    if not d:
        return CARRIER_HEALTH_PREFIX + "unknown"
    if not ("." in d):
        d = f"{d}.com"
    return f"{CARRIER_HEALTH_PREFIX}{d}"


def _norm_carrier(c: Optional[str]) -> str:
    if not c or not str(c).strip():
        return "default"
    return str(c).strip().lower().replace(" ", "").replace("_", "") or "default"


def record_carrier_result(
    domain: str,
    carrier: str,
    success: bool,
    r=None,
) -> None:
    """
    Record a success or failure for (domain, carrier). Used by ChimeraStation
    after each Chimera mission so the GPS can pivot away from poor carriers.
    """
    if r is None:
        r = _get_redis()
    key = _domain_key(domain)
    c = _norm_carrier(carrier)
    try:
        raw = r.hget(key, c) or "0,0"
        s, f = 0, 0
        parts = str(raw).split(",")
        if len(parts) >= 2:
            s, f = int(parts[0] or 0), int(parts[1] or 0)
        if success:
            s += 1
        else:
            f += 1
        r.hset(key, c, f"{s},{f}")
    except Exception:
        pass


def get_preferred_carrier_for_domain(
    domain: str,
    r=None,
    *,
    exclude_carriers: Optional[list] = None,
) -> Optional[str]:
    """
    Return the carrier with the lowest failure rate for this domain. If a carrier
    (e.g. T-Mobile) has a high failure rate, the GPS effectively pivots by
    excluding it and choosing the next best. Use exclude_carriers to force pivot.

    Returns None when there is no data, so Chimera does not set a carrier.
    """
    if r is None:
        r = _get_redis()
    key = _domain_key(domain)
    exclude = set((exclude_carriers or []) or [])
    exclude = {_norm_carrier(x) for x in exclude}
    try:
        all_ = r.hgetall(key) or {}
        best: Optional[str] = None
        best_rate = 2.0  # fail_rate; lower is better
        for carrier, val in all_.items():
            if _norm_carrier(carrier) in exclude:
                continue
            parts = str(val or "0,0").split(",")
            s = int(parts[0] or 0)
            f = int(parts[1] or 0)
            total = s + f
            if total < 1:
                fail_rate = 0.5
            else:
                fail_rate = f / total
            if fail_rate < best_rate:
                best_rate = fail_rate
                best = carrier
        return best
    except Exception:
        return None
