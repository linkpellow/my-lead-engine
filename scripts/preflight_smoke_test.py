#!/usr/bin/env python3
"""
Pre-Flight Smoke Test – Sovereign Neural Pipeline (V1→V4).

Runs 5 test leads through chimera:missions (V4 Core + V3 Brain). Uses the
GPS Success Heatmap indirectly via ChimeraStation when running the full
pipeline; when run in isolation we push minimal deep_search missions and
wait on chimera:results.

Logs exact "Trauma Event"s when:
- VLM stage fails (no coords, vision_confidence < 0.95, or status=failed)
- CAPTCHA is encountered and the autonomous agent could not solve it

Requires: REDIS_URL; Chimera Core and Chimera Brain running for real e2e.
"""

import json
import os
import sys
import time

REDIS_URL = os.getenv("REDIS_URL") or os.getenv("APP_REDIS_URL") or "redis://localhost:6379"
_base = os.getenv("CHIMERA_BRAIN_HTTP_URL") or os.getenv("CHIMERA_BRAIN_ADDRESS") or ""
CHIMERA_BRAIN_HTTP = (_base.replace(":50051", ":8080").rstrip("/") if _base else "") or "http://localhost:8080"
SCRAPEGOAT_URL = (os.getenv("SCRAPEGOAT_URL") or "http://localhost:8000").rstrip("/")
RESULTS_TIMEOUT = int(os.getenv("SMOKE_RESULTS_TIMEOUT", "120"))


def redis_ok():
    try:
        import redis
        r = redis.from_url(REDIS_URL, decode_responses=True)
        r.ping()
        return True
    except Exception as e:
        print(f"[TRAUMA] Redis: {e}")
        return False


def http_ok(name: str, url: str, path: str = "/health") -> bool:
    try:
        import urllib.request
        req = urllib.request.Request(f"{url.rstrip('/')}{path}", method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.getcode() == 200
    except Exception as e:
        print(f"[TRAUMA] {name} {path}: {e}")
        return False


def main():
    print("Pre-Flight Smoke Test – 5 leads through chimera:missions (V4)\n")
    traumas = []

    # 1) Health
    if not redis_ok():
        traumas.append({"event": "REDIS_UNREACHABLE", "detail": REDIS_URL})
        print("Redis: FAIL")
    else:
        print("Redis: OK")
    if CHIMERA_BRAIN_HTTP and not http_ok("Chimera Brain", CHIMERA_BRAIN_HTTP):
        traumas.append({"event": "CHIMERA_BRAIN_UNREACHABLE", "detail": CHIMERA_BRAIN_HTTP})
        print("Chimera Brain: FAIL")
    elif CHIMERA_BRAIN_HTTP:
        print("Chimera Brain: OK")
    if not http_ok("Scrapegoat", SCRAPEGOAT_URL):
        traumas.append({"event": "SCRAPEGOAT_UNREACHABLE", "detail": SCRAPEGOAT_URL})
        print("Scrapegoat: FAIL")
    else:
        print("Scrapegoat: OK")

    try:
        import redis
        r = redis.from_url(REDIS_URL, decode_responses=True)
    except Exception as e:
        print(f"Abort: Redis: {e}")
        sys.exit(1)

    mission_queue = os.getenv("CHIMERA_MISSION_QUEUE", "chimera:missions")
    N = 5
    test_leads = [
        {"full_name": "John Doe", "target_provider": "FastPeopleSearch"},
        {"full_name": "Jane Smith", "target_provider": "TruePeopleSearch"},
        {"full_name": "Bob Wilson", "target_provider": "ZabaSearch"},
        {"full_name": "Alice Brown", "target_provider": "AnyWho"},
        {"full_name": "Charlie Davis", "target_provider": "ThatsThem"},
    ]

    ts = int(time.time())
    mission_ids = []
    print(f"\nPushing {N} deep_search missions to {mission_queue}…")
    for i, lead in enumerate(test_leads[:N]):
        mid = f"smoke_preflight_{ts}_{i}"
        mission_ids.append(mid)
        m = {
            "mission_id": mid,
            "instruction": "deep_search",
            "lead": {**lead, "target_provider": lead["target_provider"]},
            "linkedin_url": f"https://linkedin.com/in/smoke-{i}",
        }
        try:
            r.lpush(mission_queue, json.dumps(m))
            print(f"  queued {mid}")
        except Exception as e:
            traumas.append({"event": "LPUSH_FAILED", "mission_id": mid, "detail": str(e)})

    print(f"\nWaiting on chimera:results (timeout={RESULTS_TIMEOUT}s each)…")

    for mid in mission_ids:
        key = f"chimera:results:{mid}"
        raw = r.brpop(key, timeout=RESULTS_TIMEOUT)
        if raw is None:
            traumas.append({"event": "TIMEOUT", "mission_id": mid, "key": key, "timeout_s": RESULTS_TIMEOUT, "signal": "mission exceeded SMOKE_RESULTS_TIMEOUT"})
            print(f"  {mid}: TIMEOUT (exceeded {RESULTS_TIMEOUT}s; Core may not be consuming)")
            continue
        try:
            _, pl = raw
            data = json.loads(pl.decode("utf-8") if isinstance(pl, bytes) else pl)
        except Exception as e:
            traumas.append({"event": "RESULTS_JSON_ERROR", "mission_id": mid, "detail": str(e)})
            print(f"  {mid}: JSON error")
            continue
        status = data.get("status")
        vc = data.get("vision_confidence")
        captcha = data.get("captcha_solved")
        if status == "failed":
            if captcha is False:
                traumas.append({"event": "CAPTCHA_AGENT_FAILURE", "mission_id": mid, "captcha_solved": captcha, "status": status, "signal": "autonomous agent failed to solve challenge"})
                print(f"  {mid}: CAPTCHA_AGENT_FAILURE (failed, captcha_solved=False)")
            else:
                traumas.append({"event": "MISSION_FAILED", "mission_id": mid, "status": status, "payload": {k: data.get(k) for k in ("status", "vision_confidence", "captcha_solved")}})
                print(f"  {mid}: FAIL (status={status})")
        elif status not in ("completed", None) and "ok" not in str(status).lower():
            traumas.append({"event": "MISSION_FAILED", "mission_id": mid, "status": status, "payload": {k: data.get(k) for k in ("status", "vision_confidence", "captcha_solved")}})
            print(f"  {mid}: FAIL (status={status})")
        elif vc is not None and float(vc) < 0.95:
            traumas.append({"event": "NEEDS_OLMOCR_VERIFICATION", "mission_id": mid, "vision_confidence": vc, "signal": "vision confidence fell below 0.95"})
            print(f"  {mid}: NEEDS_OLMOCR_VERIFICATION (vision_confidence={vc})")
        else:
            print(f"  {mid}: OK (status={status}, vision_confidence={vc})")

    # Summary – exact Trauma payloads for final review
    print("\n" + "=" * 60)
    if traumas:
        print("FINAL REVIEW – Trauma payloads (resilience signals):\n")
        for t in traumas:
            print(f"  {json.dumps(t, indent=2)}")
        by_signal = {}
        for t in traumas:
            e = t.get("event", "UNKNOWN")
            by_signal[e] = by_signal.get(e, 0) + 1
        print("\nBy signal: " + json.dumps(by_signal))
        print(f"\nTotal: {len(traumas)} trauma(s). Fix before production.")
        sys.exit(1)
    else:
        print("Pre-Flight OK – no trauma events.")
        sys.exit(0)


if __name__ == "__main__":
    main()
