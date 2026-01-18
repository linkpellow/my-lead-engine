"""
GPS Router - Epsilon-Greedy Dynamic Routing for the People-Search Magazine.

Tracks success, failure, captcha, and latency per provider in Redis.
Contextual routing: prioritizes providers by lead's State and by data-type performance.
Rewards: Success +1, Captcha -0.5, Timeout/Fail -5.

Redis keys:
  gps:provider:{name}  -> HASH { success_count, failure_count, captcha_count, total_latency_ms }
  gps:state:{state}:{name} -> HASH { success_count, failure_count }  (contextual heatmap)
  gps:datatype:{dt}:{name} -> HASH { total_latency_ms, count }  (e.g. Age, Income)
"""

import os
import random
from typing import Any, Dict, List, Optional, Set

# Rotational Magazine: people-search providers
MAGAZINE = [
    "FastPeopleSearch",
    "TruePeopleSearch",
    "ZabaSearch",
    "SearchPeopleFree",
    "ThatsThem",
    "AnyWho",
]

# Reward deltas (applied to provider stats)
REWARD_SUCCESS = 1.0
REWARD_CAPTCHA = -0.5
REWARD_FAIL = -5.0

GPS_PREFIX = "gps:"
PROVIDER_PREFIX = "gps:provider:"
STATE_PREFIX = "gps:state:"
DATATYPE_PREFIX = "gps:datatype:"

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    url = os.getenv("REDIS_URL") or os.getenv("APP_REDIS_URL") or "redis://localhost:6379"
    import redis
    _redis_client = redis.from_url(url, decode_responses=True)
    return _redis_client


def _provider_key(name: str) -> str:
    return f"{PROVIDER_PREFIX}{name}"


def _state_key(state: str, name: str) -> str:
    return f"{STATE_PREFIX}{state}:{name}"


def _datatype_key(dt: str, name: str) -> str:
    return f"{DATATYPE_PREFIX}{dt}:{name}"


def _norm(s: str) -> str:
    return (s or "").strip().upper()[:2] if s else ""


def get_lead_state(lead: Dict[str, Any]) -> Optional[str]:
    state = lead.get("state") or lead.get("State") or ""
    if state:
        return _norm(state)
    loc = lead.get("location") or lead.get("geoRegion") or ""
    if not loc:
        return None
    # "City, ST" or "Florida, United States" -> take last 2-char token before comma or last
    parts = [p.strip() for p in str(loc).replace(",", " ").split()]
    for p in reversed(parts):
        if len(p) == 2 and p.isalpha():
            return p.upper()
    return None


def _get_provider_stats(r, name: str) -> Dict[str, float]:
    k = _provider_key(name)
    raw = r.hgetall(k) or {}
    s = int(raw.get("success_count") or 0)
    f = int(raw.get("failure_count") or 0)
    c = int(raw.get("captcha_count") or 0)
    t = int(raw.get("total_latency_ms") or 0)
    n = s + f
    if n == 0:
        return {"success_rate": 0.5, "reward_per_op": 0.0, "avg_latency_ms": 5000.0, "score": 0.0}
    reward = s * REWARD_SUCCESS + c * REWARD_CAPTCHA + f * REWARD_FAIL
    avg_lat = t / n if n else 5000.0
    success_rate = s / n
    # score: higher is better. reward_per_op - latency penalty (lower lat better)
    score = (reward / n) - (avg_lat / 8000.0)
    return {"success_rate": success_rate, "reward_per_op": reward / n, "avg_latency_ms": avg_lat, "score": score, "n": n}


def _get_state_boost(r, state: Optional[str], name: str) -> float:
    if not state:
        return 0.0
    k = _state_key(state, name)
    raw = r.hgetall(k) or {}
    s = int(raw.get("success_count") or 0)
    f = int(raw.get("failure_count") or 0)
    n = s + f
    if n < 3:
        return 0.0
    return 0.15 * (s / n)  # up to 0.15 boost for strong state performance


def _is_blacklisted(name: str, r) -> bool:
    try:
        from app.pipeline.validator import is_provider_blacklisted
        return is_provider_blacklisted(name, r)
    except Exception:
        return False


def select_provider(
    lead: Dict[str, Any],
    r=None,
    *,
    epsilon: float = 0.1,
    tried: Optional[Set[str]] = None,
    preferred: Optional[str] = None,
) -> str:
    """
    Epsilon-Greedy: 90% best by score+state_boost, 10% random exploration.
    Excludes `tried` and blacklisted. If `preferred` is set and in candidates, use it
    with 80% probability (Hive Mind "Path of Least Resistance").
    """
    if r is None:
        r = _get_redis()
    tried = tried or set()
    candidates = [p for p in MAGAZINE if p not in tried and not _is_blacklisted(p, r)]
    if not candidates:
        return MAGAZINE[0]  # fallback

    # Hive Mind: if preferred is in candidates, use it with 80% probability
    if preferred and preferred in candidates and random.random() < 0.8:
        return preferred

    # Exploration
    if random.random() < epsilon:
        return random.choice(candidates)

    # Exploitation: argmax score
    state = get_lead_state(lead)
    best = None
    best_score = -1e9
    for name in candidates:
        st = _get_provider_stats(r, name)
        boost = _get_state_boost(r, state, name)
        sc = st["score"] + boost
        if sc > best_score:
            best_score = sc
            best = name
    return best or candidates[0]


def get_next_provider(failed_provider: str, tried: Optional[Set[str]] = None, r=None) -> Optional[str]:
    """
    Return the next provider in the Magazine to try after a failure.
    Excludes `tried` (including failed_provider) and blacklisted providers. Returns None if all tried.
    """
    if r is None:
        r = _get_redis()
    tried = set(tried or [])
    tried.add(failed_provider)
    for p in MAGAZINE:
        if p not in tried and not _is_blacklisted(p, r):
            return p
    return None


def record_result(
    provider: str,
    state: Optional[str],
    success: bool,
    latency_ms: float,
    captcha_solved: bool = False,
    datatypes_found: Optional[List[str]] = None,
    r=None,
) -> None:
    """
    Update Redis stats after ChimeraStation finishes.
    Rewards: Success +1, Captcha -0.5, Timeout/Fail -5.
    """
    if r is None:
        r = _get_redis()
    pk = _provider_key(provider)
    if success:
        r.hincrby(pk, "success_count", 1)
    else:
        r.hincrby(pk, "failure_count", 1)
    if captcha_solved:
        r.hincrby(pk, "captcha_count", 1)
    r.hincrby(pk, "total_latency_ms", int(latency_ms))

    # Contextual heatmap: by state
    if state:
        sk = _state_key(state, provider)
        if success:
            r.hincrby(sk, "success_count", 1)
        else:
            r.hincrby(sk, "failure_count", 1)

    # By data type (latency for Age, Income, Phone)
    for dt in (datatypes_found or []):
        if dt in ("age", "income", "phone"):
            dk = _datatype_key(dt, provider)
            r.hincrby(dk, "total_latency_ms", int(latency_ms / max(1, len(datatypes_found))))
            r.hincrby(dk, "count", 1)


def get_rankings(r=None) -> List[Dict[str, Any]]:
    """Return rankings for GPS Dashboard: provider, success_rate, avg_latency_ms, score."""
    if r is None:
        r = _get_redis()
    out = []
    for name in MAGAZINE:
        st = _get_provider_stats(r, name)
        out.append({
            "provider": name,
            "success_rate": round(st["success_rate"] * 100, 1),
            "avg_latency_ms": round(st["avg_latency_ms"], 0),
            "avg_latency_sec": round(st["avg_latency_ms"] / 1000, 2),
            "score": round(st["score"], 3),
            "n": st.get("n", 0),
        })
    # Sort by success_rate desc, then latency asc
    out.sort(key=lambda x: (-x["success_rate"], x["avg_latency_ms"]))
    return out
