# scrapegoat-worker-swarm Configuration

## Current Configuration

**scrapegoat/railway.worker.toml:**
```toml
[build]
builder = "NIXPACKS"
buildCommand = "pip install -r requirements.txt && playwright install chromium"
watchPatterns = [
  "scrapegoat/**"
]

[deploy]
startCommand = "python start_redis_worker.py"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
# No healthcheck - worker doesn't expose HTTP

[env]
PYTHONUNBUFFERED = "1"

[environments]
[environments.production]
ENVIRONMENT = "production"
```

## Important Notes

1. **Railway.worker.toml may not be auto-detected:**
   - Railway typically looks for `railway.toml` in the root directory
   - `railway.worker.toml` might not be automatically used
   - Both services might still read from `scrapegoat/railway.toml`

2. **Start Command Must Be Set in Dashboard:**
   - Even if `railway.worker.toml` exists, Dashboard settings override it
   - **Railway Dashboard → scrapegoat-worker-swarm → Settings → Deploy → Start Command**
   - **Must be:** `python start_redis_worker.py` (NOT `python main.py`)

3. **Watch Patterns:**
   - Added `watchPatterns = ["scrapegoat/**"]` to worker config
   - But new builder ignores this - must set in Dashboard

## Required Dashboard Configuration

**Railway Dashboard → scrapegoat-worker-swarm:**

1. **Settings → Build:**
   - **Watch Paths:** `scrapegoat/**` (or `**` temporarily)
   - **Save**

2. **Settings → Deploy:**
   - **Start Command:** `python start_redis_worker.py` (NOT `python main.py`)
   - **Save**

3. **Settings → General:**
   - **Root Directory:** `scrapegoat` (verify it's correct)
   - **Save**

## Why `python start_redis_worker.py` Not `python main.py`

- `main.py` = FastAPI server (for scrapegoat main service)
- `start_redis_worker.py` = Worker loop (for scrapegoat-worker-swarm)
- They are different entry points for different services

## Verification

After configuration, logs should show:
```
🚀 SCRAPEGOAT TRI-CORE SYSTEM
✅ All Systems Operational: [Factory] [Driver] [Keymaster]
```

NOT:
```
INFO: Uvicorn running on http://0.0.0.0:8080
```
