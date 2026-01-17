# Railway Forensics - Raw Diagnostic Output

## 1. Build Context (Railway Environment Variables)

**Command:** `railway run env | grep RAILWAY_`

**RAW OUTPUT:**
```
RAILWAY_ENVIRONMENT=production
RAILWAY_ENVIRONMENT_ID=2f98412c-dce1-459f-ac12-e80cfc5ba4f2
RAILWAY_ENVIRONMENT_NAME=production
RAILWAY_PRIVATE_DOMAIN=redis.railway.internal
RAILWAY_PROJECT_ID=4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
RAILWAY_PROJECT_NAME=my-lead-engine
RAILWAY_SERVICE_BRAINSCRAPER_URL=brainscraper.io
RAILWAY_SERVICE_CHIMERA_CORE_URL=chimera-core-production.up.railway.app
RAILWAY_SERVICE_ID=aee93890-86bd-4f5b-be71-ff583cd9129f
RAILWAY_SERVICE_NAME=Redis
RAILWAY_SERVICE_SCRAPEGOAT_URL=scrapegoat-production-8d0a.up.railway.app
RAILWAY_TCP_APPLICATION_PORT=6379
RAILWAY_TCP_PROXY_DOMAIN=switchyard.proxy.rlwy.net
RAILWAY_TCP_PROXY_PORT=54243
RAILWAY_VOLUME_ID=687da708-42db-431f-80be-c6403fee7e37
RAILWAY_VOLUME_MOUNT_PATH=/data
RAILWAY_VOLUME_NAME=redis-volume
```

**Analysis:**
- ✅ Project linked: `my-lead-engine`
- ✅ Environment: `production`
- ⚠️ **Current service context: Redis** (not scrapegoat or brainscraper)
- ✅ Service URLs detected: `RAILWAY_SERVICE_SCRAPEGOAT_URL` and `RAILWAY_SERVICE_BRAINSCRAPER_URL`

---

## 2. Deployment History

**Command:** `railway deployment list`

**RAW OUTPUT:**
```
Recent Deployments
  b8d1b4cd-8a84-4675-9a60-6a2b43575472 | SUCCESS | 2026-01-16 17:06:54 -05:00
  aa6e722c-e374-4268-b288-27f198c50298 | REMOVED | 2026-01-16 17:03:53 -05:00
  2b2542e6-99ba-4d3c-ae6a-b3e47d413ade | REMOVED | 2026-01-16 15:49:34 -05:00
  4a318b21-b9fb-436b-9e38-4a5959b7e19d | REMOVED | 2026-01-15 13:43:29 -05:00
```

**Analysis:**
- ⚠️ **Most recent deployment: 2026-01-16** (yesterday)
- ✅ Last deployment was SUCCESS
- ⚠️ **No recent deployments** (today's force deploys not showing in this list)
- **Note:** This is for the current service context (Redis), not scrapegoat/brainscraper

---

## 3. Nixpacks Build Plan

**Command:** `nixpacks plan scrapegoat/`

**RAW OUTPUT:**
```
nixpacks command failed or not installed
```

**Analysis:**
- ❌ `nixpacks` CLI not installed locally
- ✅ `requirements.txt` exists (verified separately)
- **Alternative:** Check Railway build logs to see Nixpacks plan

**Manual Verification:**
```bash
test -f scrapegoat/requirements.txt
# ✅ requirements.txt exists (file exists locally)
```

**Note:** Sandbox restrictions prevent reading file contents, but file exists.

---

## 4. Railway Status (Verbose)

**Command:** `railway status --verbose`

**RAW OUTPUT:**
```
error: unexpected argument '--verbose' found
```

**Alternative Command:** `railway status`

**RAW OUTPUT:**
```
Project: my-lead-engine
Environment: production
Service: Redis
```

**Analysis:**
- ✅ Project linked correctly
- ✅ Environment: `production`
- ⚠️ **Current service context: Redis** (not the services we're debugging)

---

## 5. Port Binding Check

**Command:** `railway run --service scrapegoat lsof -i :8080`

**RAW OUTPUT:**
```
lsof command failed or service not running
```

**Alternative Command:** `railway run --service scrapegoat netstat -tuln | grep 8080`

**RAW OUTPUT:**
```
netstat command failed or port not bound
```

**Alternative Command:** `railway run --service scrapegoat ps aux`

**RAW OUTPUT:**
```
[Shows local macOS processes, not Railway container processes]
```

**Analysis:**
- ⚠️ **CRITICAL:** `railway run` is executing locally, not in Railway container
- ❌ Cannot verify port binding (commands running on local machine)
- ⚠️ **Possible issues:**
  - Service crashed
  - Service not started
  - Port binding error
  - Wrong service context
  - **Railway CLI `run` command may not be executing in container context**

---

## Key Findings

### 1. Service Context Issue
- Railway CLI is currently linked to **Redis** service, not `scrapegoat` or `brainscraper`
- Need to switch service context to debug specific services

### 2. Missing CLI Tools
- `nixpacks` CLI not installed locally (need to check Railway build logs)
- `railway deployments` command doesn't exist (use Dashboard or API)

### 3. Port Binding Unknown
- Cannot verify if `scrapegoat` is listening on port 8080
- Service may not be running or crashed

---

## Recommended Next Steps

### 1. Switch Service Context
```bash
railway service  # List services
railway service <service-id>  # Switch to specific service
```

### 2. Check Build Logs via Dashboard
- Go to Railway Dashboard
- Check recent deployments for `scrapegoat-worker-swarm`
- Look for "Skipped" status and reason

### 3. Verify Service Status

**Command:** `railway logs --service scrapegoat-worker-swarm --tail 20`

**RAW OUTPUT:**
```
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8080 (Press CTRL+C to quit)
🔧 Redis URL configured: redis://:@:
INFO:     Started server process [1]
⚠️ Redis connection failed: Error 111 connecting to localhost:6379. Connection refused.
INFO:     100.64.0.2:36151 - "GET /health HTTP/1.1" 200 OK
```

**Analysis:**
- ✅ **Service IS running** (Uvicorn on port 8080)
- ✅ **Health check passing** (200 OK)
- ❌ **CRITICAL: Redis connection failing** - trying `localhost:6379` instead of Railway Redis
- ⚠️ **Redis URL misconfigured:** `redis://:@:` (empty/invalid URL)

**Command:** `railway logs --service brainscraper --tail 20`

**RAW OUTPUT:**
```
Starting Container
> brainscraper.io@1.0.0 start
> node server.js
🚀 Starting Next.js server on 0.0.0.0:3000
📝 Environment: production
✅ Next.js app prepared successfully
🎉 Server ready on http://0.0.0.0:3000
💚 Health check endpoint: /
```

**Analysis:**
- ✅ **Service IS running** (Next.js on port 3000)
- ✅ **Server started successfully**
- ✅ **Health check endpoint available**

### 4. Check Port Binding (After Service Context Switch)
```bash
railway run --service scrapegoat netstat -tuln
railway run --service scrapegoat ps aux
```

---

## Critical Observations

1. **Service Context:** Railway CLI is linked to Redis, not the services we're debugging
2. **Nixpacks:** Cannot verify build plan locally (need Railway build logs)
3. **Port Binding:** Cannot verify (service may not be running)
4. **Deployment History:** Need to check via Dashboard (CLI doesn't support it)

**Root Cause Hypothesis:**

### ✅ CONFIRMED: Services ARE Running
- **brainscraper:** ✅ Running on port 3000, health check passing
- **scrapegoat-worker-swarm:** ✅ Running on port 8080, health check passing

### ❌ CRITICAL ISSUE: Redis Configuration
- **scrapegoat-worker-swarm** has **invalid Redis URL:** `redis://:@:`
- Service trying to connect to `localhost:6379` instead of Railway Redis
- **Fix Required:** Set `REDIS_URL` environment variable in Railway Dashboard

### ⚠️ Watch Paths Issue (For Auto-Deploys)
- Watch paths not set in Dashboard (v2 builder ignores railway.toml)
- Manual `railway up` commands work (bypass watch paths)
- Auto-deploys from Git may still be skipped

---

## 🎯 IMMEDIATE ACTION REQUIRED

### Fix Redis Connection for scrapegoat-worker-swarm

**Railway Dashboard → scrapegoat-worker-swarm → Settings → Variables:**
1. **Set `REDIS_URL`** to: `${{redis-bridge.REDIS_URL}}` (Railway shared variable)
2. **Or** set to the actual Redis URL from Railway Dashboard
3. **Save**

**Current State:**
- Redis URL: `redis://:@:` (INVALID - empty)
- Service trying: `localhost:6379` (WRONG - should use Railway Redis)

**Expected State:**
- Redis URL: `redis://default:<password>@redis-bridge.railway.internal:6379` (or similar)
- Service should connect to Railway Redis successfully
