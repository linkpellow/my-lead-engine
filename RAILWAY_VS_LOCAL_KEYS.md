# Railway vs codebase: API keys

**.env.local** is filled from Railway (brainscraper, scrapegoat) and from .env for anything not on Railway.

**Removed:** RAPIDAPI_KEY_SKIP_TRACING (skip-tracing uses RAPIDAPI_KEY only).  
**Optional:** USHA_JWT_TOKEN (not in .env.local; add to .env.local or Railway if you want DNC scrub).

---

## By Railway service

### brainscraper
Present: RAPIDAPI_KEY, TELNYX_API_KEY, DECODO_API_KEY, GEOCODIO_API_KEY, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO

Missing on Railway (in .env.local from .env):
- **OPENAI_API_KEY** — `dojo/translate/route.ts`, `dojo/analyze/route.ts`

Optional: **USHA_JWT_TOKEN** — `getUshaToken.ts`, `usha/test-token/route.ts`, DNC flows

### scrapegoat
Present: RAPIDAPI_KEY, OPENAI_API_KEY, CENSUS_API_KEY, TELNYX_API_KEY, USHA_JWT_TOKEN, DECODO_API_KEY, CAPSOLVER_API_KEY

RAPIDAPI_KEY_SKIP_TRACING has been removed; skip-tracing uses RAPIDAPI_KEY only.

### chimera-core
Present: REDIS_URL, DATABASE_URL, CHIMERA_BRAIN_ADDRESS, RAILWAY_*, RUST_LOG, WORKER_ID, PORT

Missing on Railway (in .env.local from .env):
- **CAPSOLVER_API_KEY** — `capsolver.py`
- **DECODO_API_KEY** — `network.py` (proxy)
- **DECODO_USER** — `network.py` (default `user`)

Optional: **WEBHOOK_URL** — `chimera-core/capsolver.py`, `chimera_brain/vision_service.py`

### chimera-brain-v1
Present: REDIS_URL, PORT, CHIMERA_BRAIN_PORT, CHIMERA_USE_SIMPLE, CHIMERA_VISION_DEVICE, MODEL_PATH, PYTHONPATH, PYTHONUNBUFFERED, RAILWAY_*

OPENAI is not used in chimera_brain code.

---

## Suggested Railway updates

1. **brainscraper:** set OPENAI_API_KEY.
2. **chimera-core:** set CAPSOLVER_API_KEY, DECODO_API_KEY, DECODO_USER.
3. **scrapegoat:** unset RAPIDAPI_KEY_SKIP_TRACING (optional cleanup).
