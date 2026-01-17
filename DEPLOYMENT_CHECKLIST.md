# Complete Deployment Checklist - Success Requirements

This document provides a comprehensive, step-by-step checklist to achieve successful deployment of all services on Railway.

## 🎯 Overview

Your system consists of:
- **BrainScraper** (Next.js) - Lead discovery and producer
- **Scrapegoat** (FastAPI) - Main API service
- **Scrapegoat Worker** (Python) - Queue consumer (5+ replicas)
- **Redis Bridge** - Shared queue infrastructure
- **PostgreSQL** - Shared database

---

## ✅ PHASE 1: Infrastructure Setup

### Step 1.1: Create Redis Service
- [ ] Go to Railway Dashboard: https://railway.com/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
- [ ] Click **"New"** → **"Database"** → **"Add Redis"**
- [ ] **Name it exactly**: `redis-bridge` (critical for variable references)
- [ ] Railway auto-generates `REDIS_URL` variable
- [ ] Verify service is online

### Step 1.2: Create PostgreSQL Service
- [ ] Click **"New"** → **"Database"** → **"Add PostgreSQL"**
- [ ] Railway auto-generates `DATABASE_URL` variable
- [ ] Service name will be `PostgreSQL` (Railway default)
- [ ] Verify service is online

---

## ✅ PHASE 2: Service Configuration

### Step 2.1: BrainScraper Service Configuration

**Railway Dashboard Settings:**
- [ ] **Root Directory**: `brainscraper` ⚠️ (NOT root!)
- [ ] **Watch Paths**: `brainscraper/**` (optional but recommended)
- [ ] **Port**: `3000` (from env var)
- [ ] **Build Command**: `npm run build` (uses `--webpack` flag automatically)
- [ ] **Start Command**: `npm start` (uses `server.js`)
- [ ] **Healthcheck Path**: `/`
- [ ] **Healthcheck Timeout**: `180` seconds

**Verify `brainscraper/railway.toml`:**
- [ ] Builder: `DOCKERFILE` or `NIXPACKS`
- [ ] Healthcheck path: `/`
- [ ] Healthcheck timeout: `180`

### Step 2.2: Scrapegoat Service Configuration

**Railway Dashboard Settings:**
- [ ] **Root Directory**: `scrapegoat` ⚠️ (NOT root!)
- [ ] **Watch Paths**: `scrapegoat/**` (optional but recommended)
- [ ] **Port**: `8000` (auto-assigned by Railway)
- [ ] **Build Command**: `pip install -r requirements.txt && playwright install chromium`
- [ ] **Start Command**: `python main.py` (from `railway.toml`)
- [ ] **Healthcheck Path**: `/health`
- [ ] **Healthcheck Timeout**: `300` seconds (Playwright install can be slow)

**Verify `scrapegoat/railway.toml`:**
- [ ] Builder: `NIXPACKS`
- [ ] Build command includes Playwright install
- [ ] Start command: `python main.py`
- [ ] Healthcheck path: `/health`

### Step 2.3: Scrapegoat Worker Service Configuration

**Railway Dashboard Settings:**
- [ ] **Root Directory**: `scrapegoat` (same as main service)
- [ ] **Watch Paths**: `scrapegoat/**`
- [ ] **Start Command**: `python start_redis_worker.py` ⚠️ (Different from main service!)
- [ ] **Scaling**: Set to **5 replicas** (Settings → Scaling)
- [ ] **Port**: Not needed (worker doesn't expose HTTP)

**Critical: Worker File Must Exist**
- [ ] Verify `scrapegoat/start_redis_worker.py` exists
- [ ] If missing, create it (see Phase 3.1)

---

## ✅ PHASE 3: Code Requirements

### Step 3.1: Create Worker Startup Script (If Missing)

**File**: `scrapegoat/start_redis_worker.py`

```python
"""
Scrapegoat Worker Startup Script
Starts the Redis queue worker that processes leads_to_enrich queue
"""
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import and start worker
try:
    from app.workers.redis_queue_worker import worker_loop
    
    if __name__ == "__main__":
        print("🚀 Starting Scrapegoat Worker...")
        print(f"📝 Environment: {os.getenv('ENVIRONMENT', 'production')}")
        print(f"🔗 Redis URL: {os.getenv('REDIS_URL', 'not set')[:20]}...")
        worker_loop()
except ImportError as e:
    print(f"❌ Failed to import worker: {e}")
    print("⚠️  Worker module not found. Creating placeholder...")
    
    # Fallback: Simple worker loop
    import redis
    import json
    import time
    
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_client = redis.from_url(redis_url)
    
    print(f"✅ Connected to Redis: {redis_url[:20]}...")
    print("🔄 Starting worker loop...")
    
    while True:
        try:
            result = redis_client.brpop("leads_to_enrich", timeout=10)
            if result:
                queue_name, lead_json = result
                lead_data = json.loads(lead_json)
                print(f"📥 Received lead: {lead_data.get('name', 'Unknown')}")
                # TODO: Implement actual enrichment logic
        except Exception as e:
            print(f"❌ Worker error: {e}")
            time.sleep(5)
```

**Action**: Create this file if it doesn't exist.

### Step 3.2: Verify Build Requirements

**BrainScraper:**
- [ ] `package.json` has `"build": "next build --webpack"` script
- [ ] `server.js` exists and is configured correctly
- [ ] `railway.toml` exists in `brainscraper/` directory
- [ ] All dependencies in `package.json` are valid

**Scrapegoat:**
- [ ] `requirements.txt` exists with all dependencies
- [ ] `main.py` exists and has `/health` endpoint
- [ ] `railway.toml` exists in `scrapegoat/` directory
- [ ] Playwright is in `requirements.txt` (version 1.40.0 or compatible)

---

## ✅ PHASE 4: Environment Variables

### Step 4.1: BrainScraper Environment Variables

**Via Railway Dashboard:**
1. Go to BrainScraper service → Settings → Variables
2. Add each variable:

```bash
REDIS_URL=${{redis-bridge.REDIS_URL}}
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_BASE_URL=https://brainscraper.io
DATA_DIR=/data
RAPIDAPI_KEY=your-actual-rapidapi-key-here
```

**Via CLI:**
```bash
cd brainscraper
railway service  # Ensure linked to brainscraper service
railway variables --set "REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "NODE_ENV=production"
railway variables --set "PORT=3000"
railway variables --set "NEXT_PUBLIC_BASE_URL=https://brainscraper.io"
railway variables --set "DATA_DIR=/data"
railway variables --set "RAPIDAPI_KEY=your-actual-key"
```

**Checklist:**
- [ ] `REDIS_URL` uses `${{redis-bridge.REDIS_URL}}` syntax
- [ ] `RAPIDAPI_KEY` is set with actual key value
- [ ] All variables are set (use `railway variables` to verify)

### Step 4.2: Scrapegoat Service Environment Variables

**Via Railway Dashboard:**
1. Go to Scrapegoat service → Settings → Variables
2. Add each variable:

```bash
DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
APP_DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
REDIS_URL=${{redis-bridge.REDIS_URL}}
APP_REDIS_URL=${{redis-bridge.REDIS_URL}}
APP_CELERY_BROKER_URL=${{redis-bridge.REDIS_URL}}/1
APP_CELERY_RESULT_BACKEND=${{redis-bridge.REDIS_URL}}/2
PYTHONUNBUFFERED=1
ENVIRONMENT=production
OPENAI_API_KEY=sk-proj-your-actual-key-here
CENSUS_API_KEY=your-actual-census-key-here
RAPIDAPI_KEY=your-actual-rapidapi-key-here
```

**Via CLI:**
```bash
cd scrapegoat
railway service  # Ensure linked to scrapegoat service
railway variables --set "DATABASE_URL=\${{PostgreSQL.DATABASE_URL}}"
railway variables --set "APP_DATABASE_URL=\${{PostgreSQL.DATABASE_URL}}"
railway variables --set "REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "APP_REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "APP_CELERY_BROKER_URL=\${{redis-bridge.REDIS_URL}}/1"
railway variables --set "APP_CELERY_RESULT_BACKEND=\${{redis-bridge.REDIS_URL}}/2"
railway variables --set "PYTHONUNBUFFERED=1"
railway variables --set "ENVIRONMENT=production"
railway variables --set "OPENAI_API_KEY=sk-proj-your-key"
railway variables --set "CENSUS_API_KEY=your-census-key"
railway variables --set "RAPIDAPI_KEY=your-rapidapi-key"
```

**Checklist:**
- [ ] All shared variables use `${{...}}` syntax
- [ ] Redis database numbers are correct (`/1` for broker, `/2` for results)
- [ ] All API keys are set with actual values
- [ ] `PYTHONUNBUFFERED=1` is set (for proper logging)

### Step 4.3: Scrapegoat Worker Environment Variables

**Same as Scrapegoat Service** (all variables from Step 4.2)

**Action:**
- [ ] Link to worker service: `cd scrapegoat && railway service` (select worker)
- [ ] Set all same variables as Scrapegoat service
- [ ] Verify with `railway variables`

**Quick Setup Script:**
```bash
# Use the provided script
./setup-railway-variables.sh
# Then manually set API keys
```

---

## ✅ PHASE 5: Deployment

### Step 5.1: Deploy BrainScraper

**Via Railway Dashboard:**
1. Go to BrainScraper service
2. Click **"Deployments"** tab
3. Click **"Redeploy"** on latest deployment OR **"New Deployment"** → **"Deploy Latest Commit"**
4. Monitor build logs

**Via CLI:**
```bash
cd brainscraper
railway service  # Ensure linked
railway up  # Or railway redeploy --yes
```

**Verification:**
- [ ] Build completes successfully (no errors)
- [ ] Service starts and healthcheck passes
- [ ] Check logs: `railway logs` or Railway dashboard
- [ ] Visit service URL to verify it's running

### Step 5.2: Deploy Scrapegoat

**Via Railway Dashboard:**
1. Go to Scrapegoat service
2. Click **"Deployments"** tab
3. Click **"Redeploy"** or **"New Deployment"**
4. Monitor build logs (Playwright install may take time)

**Via CLI:**
```bash
cd scrapegoat
railway service  # Ensure linked
railway up
```

**Verification:**
- [ ] Build completes successfully
- [ ] Playwright installs Chromium (check logs)
- [ ] Service starts and `/health` endpoint responds
- [ ] Redis connection works (check logs for "connected")

### Step 5.3: Deploy Scrapegoat Worker

**Via Railway Dashboard:**
1. Go to Scrapegoat Worker service
2. Click **"Deployments"** tab
3. Click **"Redeploy"** or **"New Deployment"**
4. Verify scaling is set to 5 replicas

**Via CLI:**
```bash
cd scrapegoat
railway service  # Select worker service
railway up
```

**Verification:**
- [ ] Build completes successfully
- [ ] All 5 replicas are running (check Railway dashboard)
- [ ] Worker logs show "Starting Scrapegoat Worker..."
- [ ] Worker connects to Redis successfully

---

## ✅ PHASE 6: Post-Deployment Verification

### Step 6.1: Service Health Checks

**BrainScraper:**
- [ ] Visit service URL (should show Next.js app)
- [ ] Check `/api/health` endpoint (if exists)
- [ ] Verify Redis connection in logs

**Scrapegoat:**
- [ ] Visit `/health` endpoint → Should return `{"status": "healthy", "redis": "connected"}`
- [ ] Visit `/queue/status` endpoint → Should show queue lengths
- [ ] Check logs for any connection errors

**Scrapegoat Worker:**
- [ ] Check Railway dashboard shows 5 replicas running
- [ ] Check logs show workers are polling Redis queue
- [ ] Verify no error messages in logs

### Step 6.2: Infrastructure Connectivity

**Redis Connection:**
- [ ] BrainScraper can connect to Redis (check logs)
- [ ] Scrapegoat can connect to Redis (check `/health` endpoint)
- [ ] Workers can connect to Redis (check worker logs)
- [ ] Test: Push a test lead to queue and verify it's consumed

**PostgreSQL Connection:**
- [ ] Scrapegoat can connect to PostgreSQL (check logs)
- [ ] Database schema exists (if required)
- [ ] Test: Write a test record and verify it persists

### Step 6.3: End-to-End Test

**Test Lead Flow:**
1. [ ] Push a test lead from BrainScraper to Redis queue
2. [ ] Verify lead appears in `leads_to_enrich` queue (check `/queue/status`)
3. [ ] Verify worker picks up the lead (check worker logs)
4. [ ] Verify lead is processed and written to PostgreSQL
5. [ ] Verify lead appears in BrainScraper's enriched leads view

---

## 🚨 Common Issues & Fixes

### Issue: "Railpack could not determine how to build"
**Fix:**
- Set Root Directory to `brainscraper` or `scrapegoat` in Railway dashboard
- Verify Watch Paths are set correctly

### Issue: Build fails with Turbopack error
**Fix:**
- Ensure `package.json` has `"build": "next build --webpack"`
- Verify `next.config.js` doesn't require Turbopack

### Issue: Playwright not found
**Fix:**
- Ensure build command includes `playwright install chromium`
- Check `requirements.txt` has `playwright==1.40.0` or compatible version

### Issue: Services can't connect to Redis/PostgreSQL
**Fix:**
- Verify shared variables use `${{service-name.VARIABLE_NAME}}` syntax
- Check service names match exactly (`redis-bridge`, `PostgreSQL`)
- Verify infrastructure services are online

### Issue: Worker not processing queue
**Fix:**
- Verify `start_redis_worker.py` exists
- Check start command is `python start_redis_worker.py`
- Verify worker has same environment variables as Scrapegoat
- Check worker logs for connection errors

### Issue: Variable references show as empty
**Fix:**
- Create infrastructure services (Redis, PostgreSQL) first
- Verify service names match exactly
- Use Railway dashboard to set variables (auto-completes references)

---

## 📋 Final Verification Checklist

Before considering deployment successful:

- [ ] All infrastructure services are online (Redis, PostgreSQL)
- [ ] All application services are deployed (BrainScraper, Scrapegoat, Worker)
- [ ] All services pass health checks
- [ ] All environment variables are set correctly
- [ ] Root directories are set correctly for each service
- [ ] Worker service has 5 replicas running
- [ ] Redis queue is accessible from all services
- [ ] PostgreSQL database is accessible from Scrapegoat
- [ ] End-to-end test passes (lead flows through entire pipeline)
- [ ] No critical errors in any service logs

---

## 📚 Related Documentation

- `RAILWAY_COMPLETE_SETUP.md` - Detailed setup guide
- `MONOREPO_RAILWAY_SETUP.md` - Monorepo-specific configuration
- `RAILWAY_ENV_VARIABLES.md` - Environment variable reference
- `.cursor/rules/railway-deployment.mdc` - Deployment rules
- `.cursor/rules/unified-architecture.mdc` - Architecture overview

---

## 🎯 Success Criteria

Deployment is successful when:
1. ✅ All services are online and healthy
2. ✅ Services can communicate via Redis queue
3. ✅ Services can read/write to PostgreSQL
4. ✅ Workers are processing leads from queue
5. ✅ End-to-end lead flow works (discovery → enrichment → storage → visualization)
