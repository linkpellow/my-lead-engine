# Railway Configuration Verification

**Status:** Complete (verified against codebase)  
**Last verified:** 2025

---

## Summary

- **Empty strings:** None. All non-RAILWAY variables have non-empty values or refs that resolve.
- **Critical vars:** Every `os.getenv` / `process.env` used for Redis, Postgres, and service URLs is set and aligned.
- **Refs:** Redis → `${{Redis.REDIS_URL}}`; Postgres → `${{Postgres.DATABASE_PUBLIC_URL}}`; scrapegoat-worker-swarm inherits from `${{scrapegoat.*}}` where applicable.

---

## 1. brainscraper (Node / Next.js)

| Code location | Env var | Railway | Notes |
|---------------|---------|---------|-------|
| `utils/redisBridge.ts`, `queue-*`, `v2-pilot/*`, `dojo/*`, `stats` | REDIS_URL, APP_REDIS_URL | ✓ ${{Redis.REDIS_URL}} | |
| `utils/redisBridge.ts`, `load-enriched-results`, `aggregate-enriched-leads` | DATABASE_URL, APP_DATABASE_URL | ✓ ${{Postgres.DATABASE_PUBLIC_URL}} | |
| `utils/scrapegoatClient.ts`, `dojo/*`, `spiders/*` | SCRAPEGOAT_API_URL, SCRAPEGOAT_URL | ✓ internal :8080, public URL | |
| `dojo/translate`, `dojo/analyze` | OPENAI_API_KEY | ✓ ${{scrapegoat.OPENAI_API_KEY}} | Dojo AI (non-mock) |
| `server.js` | PORT | 3000 | |
| `utils/dataDirectory.ts`, `dojo/*` | DATA_DIR | /data | |
| Various | NODE_ENV | production | |

---

## 2. scrapegoat (FastAPI)

| Code location | Env var | Railway | Notes |
|---------------|---------|---------|-------|
| `main.py`, `app/pipeline/*`, `app/enrichment/*`, `app/workers/*`, `app/scraping/*` | REDIS_URL, APP_REDIS_URL | ✓ ${{Redis.REDIS_URL}} | |
| `app/enrichment/database.py`, `blueprint_commit`, `init_db` | DATABASE_URL, APP_DATABASE_URL | ✓ ${{Postgres.DATABASE_PUBLIC_URL}} | |
| `main.py` | PORT | 8080 | uvicorn; brainscraper/chimera-core use :8080 |
| `app/pipeline/stations/enrichment.py` | CHIMERA_BRAIN_HTTP_URL | ✓ chimera-brain-v1.railway.internal:8080 | Hive + Chimera HTTP |
| `app/pipeline/stations/enrichment.py` | CHIMERA_STATION_TIMEOUT | 90 | |
| `app/enrichment/skip_tracing`, `demographics` | RAPIDAPI_KEY | ✓ | |
| `app/enrichment/demographics` | CENSUS_API_KEY | ✓ | |
| `app/enrichment/telnyx_gatekeep` | TELNYX_API_KEY | ✓ | |
| `app/enrichment/dnc_scrub` | USHA_JWT_TOKEN | ✓ | |
| `app/scraping/base`, `captcha_solver` | CAPSOLVER_API_KEY, DECODO_API_KEY | ✓ | |
| `app/scraping/base`, `auto_map` | OPENAI_API_KEY | ✓ | |
| `main.py` | SEED_MAGAZINE_ON_STARTUP | 1 | |
| `app/pipeline/router` | CHIMERA_PROVIDERS | (optional) | default "" |

---

## 3. chimera-core (Python worker)

| Code location | Env var | Railway | Notes |
|---------------|---------|---------|-------|
| `main.py`, `workers.py`, `capsolver`, `db_bridge`, etc. | REDIS_URL, APP_REDIS_URL | ✓ ${{Redis.REDIS_URL}} | Must match scrapegoat |
| `main.py`, `health_audit`, `db_bridge` | DATABASE_URL, APP_DATABASE_URL | ✓ ${{Postgres.DATABASE_PUBLIC_URL}} | |
| `main.py` | CHIMERA_BRAIN_ADDRESS | ✓ chimera-brain-v1.railway.internal:50051 | gRPC |
| `main.py`, `telemetry_client` | BRAINSCRAPER_URL | ✓ https://brainscraper.io/ | Telemetry |
| `workers.py` | SCRAPEGOAT_URL, DOJO_TRAUMA_URL | ✓ scrapegoat.railway.internal:8080 | |
| `main.py` | PORT | 8080 | Health |
| `capsolver` | CAPSOLVER_API_KEY | ✓ | |
| `network` | DECODO_API_KEY | ✓ | |

---

## 4. chimera-brain-v1 (Python gRPC + HTTP)

| Code location | Env var | Railway | Notes |
|---------------|---------|---------|-------|
| `server.py`, `vision_service` | REDIS_URL, APP_REDIS_URL | ✓ ${{Redis.REDIS_URL}} | Hive Mind |
| `server.py` | PORT | 8080 | HTTP health |
| `server.py` | CHIMERA_BRAIN_PORT | 50051 | gRPC |
| `server.py` | CHIMERA_USE_SIMPLE | false | |
| `server.py` | CHIMERA_VISION_DEVICE | auto | |

---

## 5. scrapegoat-worker-swarm

Runs pipeline/worker code that expects scrapegoat-level env. All of the following are set (literals or `${{scrapegoat.*}}`):

- REDIS_URL, APP_REDIS_URL
- DATABASE_URL, APP_DATABASE_URL
- CHIMERA_BRAIN_HTTP_URL → ${{scrapegoat.CHIMERA_BRAIN_HTTP_URL}}
- CHIMERA_STATION_TIMEOUT → ${{scrapegoat.CHIMERA_STATION_TIMEOUT}}
- USHA_JWT_TOKEN → ${{scrapegoat.USHA_JWT_TOKEN}}
- OPENAI_API_KEY → ${{scrapegoat.OPENAI_API_KEY}}
- ENVIRONMENT → ${{scrapegoat.ENVIRONMENT}}
- PYTHONUNBUFFERED=1
- CAPSOLVER_API_KEY, DECODO_API_KEY, RAPIDAPI_KEY, CENSUS_API_KEY, TELNYX_API_KEY (literals)

---

## 6. Redis

- REDIS_URL, APP_REDIS_URL: full URL with auth.
- No DATABASE_* or other app vars.

---

## 7. Postgres

- DATABASE_PUBLIC_URL: used by app refs.
- No REDIS_* or APP_REDIS_*.

---

## Service-to-service URLs

| From | To | Var | Value |
|------|----|-----|-------|
| brainscraper | scrapegoat | SCRAPEGOAT_API_URL | http://scrapegoat.railway.internal:8080 |
| chimera-core | chimera-brain (gRPC) | CHIMERA_BRAIN_ADDRESS | http://chimera-brain-v1.railway.internal:50051 |
| chimera-core | scrapegoat | SCRAPEGOAT_URL | http://scrapegoat.railway.internal:8080 |
| scrapegoat | chimera-brain (HTTP) | CHIMERA_BRAIN_HTTP_URL | http://chimera-brain-v1.railway.internal:8080 |
| chimera-core | brainscraper | BRAINSCRAPER_URL | https://brainscraper.io/ |

---

## V2 Pilot: Neural Sight & Stealth Health

### Required for any telemetry

- **chimera-core:** `BRAINSCRAPER_URL` must be set (e.g. `https://brainscraper.io/` or `http://brainscraper.railway.internal:3000`). Chimera POSTs to `{BRAINSCRAPER_URL}/api/v2-pilot/telemetry`; if unset, `tc.push()` is skipped. ✓ Set.
- **brainscraper:** `REDIS_URL` (or `APP_REDIS_URL`) must be the **same Redis as chimera-core**. The telemetry route HSETs `mission:{id}` in Redis; mission-status and the v2-pilot UI read from that. If BrainScraper used a different Redis, telemetry would never reach `mission:{id}`. ✓ Aligned.

### NEURAL SIGHT LIVE FEED (why empty?)

Chimera sends `screenshot`, `coordinate_drift`, `grounding_bbox` when a VLM `process_vision` returns **found**. If:

- no vision run, or  
- no Blueprint `suggested_x` / `suggested_y` (so `coordinate_drift` is not computed),

then `coordinate_drift` stays empty and the overlay/grounding mirror has nothing to show. Data source: `mission:{id}` `.screenshot_url`, `.grounding_bbox`, `.coordinate_drift`.

### STEALTH HEALTH DASHBOARD (why empty?)

Chimera Core’s `tc.push()` in `main.py` currently sends only:

- `screenshot`, `vision_confidence`, `status`, `coordinate_drift`, `grounding_bbox`

It does **not** send `fingerprint` or `mouse_movements`. `TelemetryClient.push()` supports them, but `main.py` never passes them. Until Chimera adds `fingerprint` and `mouse_movements` to its `tc.push()` calls, the Fingerprint Snapshot, Proxy Pinning, and Human Jitter Heatmap panels stay empty.

---

## Scripts

- **`./scripts/railway-set-all-vars.sh`** – Sets REDIS, DATABASE, APP_*, and refs (brainscraper OPENAI from scrapegoat; worker USHA, CHIMERA_BRAIN_HTTP, CHIMERA_STATION_TIMEOUT, ENVIRONMENT, OPENAI from scrapegoat). Use correct `REDIS_REF` / `DB_REF` for your Redis/Postgres service names.
- **`./scripts/railway-people-search-align.sh`** – Aligns chimera-core REDIS_URL with scrapegoat and redeploys.

---

## Quick re-check (CLI)

```bash
# No empty non-RAILWAY vars
for s in brainscraper scrapegoat chimera-core chimera-brain-v1 Redis Postgres scrapegoat-worker-swarm; do
  railway variable list -s "$s" --kv | awk -F= 'NR>0 && $1!~/^RAILWAY_/ && ($2=="" || $2==" ") {print "EMPTY:", $1, "(" s ")"}' s="$s"
done

# Critical refs resolve (same Redis)
railway variable list -s scrapegoat --kv | grep REDIS_URL
railway variable list -s chimera-core --kv | grep REDIS_URL
```
