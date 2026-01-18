# Start Command Fix - scrapegoat Services

## Problem
Both `scrapegoat` (main) and `scrapegoat-worker-swarm` services read from `scrapegoat/railway.toml`, but they need different start commands:
- **scrapegoat (main):** `python3 main.py` (FastAPI server)
- **scrapegoat-worker-swarm:** `python start_redis_worker.py` (Worker loop)

## Solution
Removed `startCommand` from `scrapegoat/railway.toml` so each service can set its own start command in Railway Dashboard.

## Required: Railway Dashboard Configuration

### scrapegoat (Main Service)
1. Railway Dashboard → scrapegoat service
2. Settings → Deploy → Start Command
3. Set to: `python3 main.py`
4. Save

### scrapegoat-worker-swarm (Worker Service)
1. Railway Dashboard → scrapegoat-worker-swarm service
2. Settings → Deploy → Start Command
3. Set to: `python start_redis_worker.py`
4. Save

## Current Configuration

**scrapegoat/railway.toml:**
```toml
[build]
builder = "NIXPACKS"
buildCommand = "pip install -r requirements.txt && playwright install chromium"

[deploy]
# startCommand removed - set per-service in Railway Dashboard
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[env]
PYTHONUNBUFFERED = "1"
PORT = "8080"
```

**Note:** Build command remains in railway.toml (shared by both services). Start commands are now set per-service in Dashboard.

## Verification

After setting start commands in Dashboard:
- **scrapegoat:** Should run FastAPI server (`python3 main.py`)
- **scrapegoat-worker-swarm:** Should run worker loop (`python start_redis_worker.py`)

Check logs to verify:
```bash
railway logs --service scrapegoat --tail 20
railway logs --service scrapegoat-worker-swarm --tail 20
```

**Expected:**
- scrapegoat: `INFO: Uvicorn running on http://0.0.0.0:8080`
- scrapegoat-worker-swarm: `🚀 SCRAPEGOAT TRI-CORE SYSTEM` (worker startup message)
