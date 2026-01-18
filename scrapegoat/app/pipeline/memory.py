"""
Cross-Site Semantic Memory - Success patterns (e.g. "Phone under Contact header").

Store and recall patterns like: "Phone numbers on people-search sites are usually
located under a header containing the word 'Contact'." Used by the Semantic
Translator and Blueprint to bias intents.
"""

import json
import os
from typing import Any, Dict, List, Optional

import redis

_PREFIX = "semantic_memory:"
_PATTERNS_KEY = "semantic_memory:patterns"
_INDEX_KEY = "semantic_memory:by_domain:"

_redis: Optional[redis.Redis] = None


def _get_redis() -> redis.Redis:
    global _redis
    if _redis is not None:
        return _redis
    url = os.getenv("REDIS_URL") or os.getenv("APP_REDIS_URL") or "redis://localhost:6379"
    _redis = redis.from_url(url, decode_responses=True)
    return _redis


def store_success_pattern(
    pattern: str,
    sites: Optional[List[str]] = None,
    intent_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Store a success pattern. Example:
      store_success_pattern(
        "Phone numbers on people-search sites are usually under a header containing the word 'Contact'",
        sites=["truepeoplesearch.com", "fastpeoplesearch.com"],
        intent_id="find_phone",
      )
    """
    try:
        r = _get_redis()
        entry = {
            "pattern": pattern,
            "sites": sites or [],
            "intent_id": intent_id or "",
            "metadata": metadata or {},
            "count": 1,
        }
        # Append to a list; we could use a Redis Stream or HASH for dedup
        r.rpush(_PATTERNS_KEY, json.dumps(entry))
        for d in (sites or []):
            if d:
                r.sadd(f"{_INDEX_KEY}{d}", pattern[:200])
    except Exception:
        pass


def get_patterns_for_domain(domain: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Return success patterns that mention this domain or are generic."""
    try:
        r = _get_redis()
        raw = r.lrange(_PATTERNS_KEY, -limit, -1) or []
        out = []
        for s in reversed(raw):
            try:
                obj = json.loads(s)
                sites = obj.get("sites") or []
                if not sites or domain in sites or any(domain in str(s) for s in sites):
                    out.append(obj)
            except Exception:
                pass
        return out[:limit]
    except Exception:
        return []


def get_patterns_for_intent(intent_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Return patterns tagged with this intent_id."""
    try:
        r = _get_redis()
        raw = r.lrange(_PATTERNS_KEY, -100, -1) or []
        out = []
        for s in raw:
            try:
                obj = json.loads(s)
                if (obj.get("intent_id") or "") == intent_id:
                    out.append(obj)
            except Exception:
                pass
        return out[-limit:]
    except Exception:
        return []
