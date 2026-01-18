"""
BlueprintLoaderStation - Fetch BLUEPRINT:{domain} before ChimeraStation.

Runs before ChimeraStation. Resolves target provider via GPS router, fetches
BLUEPRINT:{domain} (or blueprint:{domain}) from Redis. If none, triggers
"Mapping Required" to Dojo (PUBLISH dojo:alerts) and sets _mapping_required.
"""

import json
import os
from typing import Any, Dict, Set, Tuple

from loguru import logger
import redis

from app.pipeline.station import PipelineStation
from app.pipeline.types import PipelineContext, StopCondition

try:
    from app.pipeline.router import select_provider
    ROUTER_AVAILABLE = True
except ImportError:
    ROUTER_AVAILABLE = False

BLUEPRINT_PREFIX = "BLUEPRINT:"
LEGACY_PREFIX = "blueprint:"
DOJO_ALERTS = "dojo:alerts"

_PROVIDER_TO_DOMAIN = {
    "FastPeopleSearch": "fastpeoplesearch.com",
    "TruePeopleSearch": "truepeoplesearch.com",
    "ZabaSearch": "zabasearch.com",
    "SearchPeopleFree": "searchpeoplefree.com",
    "ThatsThem": "thatsthem.com",
    "AnyWho": "anywho.com",
}


class BlueprintLoaderStation(PipelineStation):
    @property
    def name(self) -> str:
        return "Blueprint Loader"

    @property
    def required_inputs(self) -> Set[str]:
        return {"linkedinUrl"}

    @property
    def produces_outputs(self) -> Set[str]:
        return set()  # _blueprint, _mapping_required are internal

    @property
    def cost_estimate(self) -> float:
        return 0.0

    def _get_redis(self) -> redis.Redis:
        url = os.getenv("REDIS_URL") or os.getenv("APP_REDIS_URL") or "redis://localhost:6379"
        return redis.from_url(url, decode_responses=True)

    async def process(self, ctx: PipelineContext) -> Tuple[Dict[str, Any], StopCondition]:
        out: Dict[str, Any] = {}
        r = self._get_redis()

        # Resolve target provider (same as ChimeraStation would)
        provider = None
        if ROUTER_AVAILABLE:
            try:
                provider = select_provider(ctx.data, r, tried=set())
            except Exception as e:
                logger.debug("BlueprintLoader: select_provider failed: %s", e)
        if not provider:
            provider = "TruePeopleSearch"

        domain = _PROVIDER_TO_DOMAIN.get(provider) or provider.replace(" ", "").lower() + ".com"

        # Fetch BLUEPRINT:{domain} then blueprint:{domain}
        raw = None
        for prefix in (BLUEPRINT_PREFIX, LEGACY_PREFIX):
            key = f"{prefix}{domain}"
            try:
                raw = r.hgetall(key)
                if raw:
                    break
            except Exception:
                pass

        if raw and isinstance(raw, dict):
            data_str = raw.get("data") or raw.get("blueprint_json")
            if data_str:
                try:
                    bp = json.loads(data_str)
                    out["_blueprint"] = bp
                    out["_blueprint_domain"] = domain
                    logger.info("BlueprintLoader: loaded for %s", domain)
                    return out, StopCondition.CONTINUE
                except Exception as e:
                    logger.warning("BlueprintLoader: parse %s: %s", domain, e)
            # Fallback: use hash as blueprint-like map
            instr = raw.get("instructions")
            if isinstance(instr, str):
                try:
                    out["_blueprint"] = {"instructions": json.loads(instr), "domain": domain}
                    return out, StopCondition.CONTINUE
                except Exception:
                    pass

        # No blueprint: alert Dojo
        try:
            r.publish(DOJO_ALERTS, json.dumps({"type": "mapping_required", "domain": domain}))
        except Exception as e:
            logger.debug("BlueprintLoader: publish dojo:alerts: %s", e)
        out["_mapping_required"] = domain
        logger.warning("BlueprintLoader: no blueprint for %s; Mapping Required", domain)
        return out, StopCondition.CONTINUE
