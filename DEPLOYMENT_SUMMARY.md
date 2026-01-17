# Deployment Guide - Complete Reference

## 🎯 What Needs to Be Done

To achieve successful deployment, you need to complete **6 phases**:

**Note:** This is the single source of truth for deployment. All other deployment docs have been consolidated here.

---

## ✅ PHASE 1: Infrastructure (2 Services)

**Create in Railway Dashboard:**
1. **Redis Database** → Name: `redis-bridge` (exact name required)
2. **PostgreSQL Database** → Name: `PostgreSQL` (default)

**Status Check:**
- [ ] Both services are online in Railway dashboard
- [ ] Both services show "Active" status

---

## ✅ PHASE 2: Service Configuration (3 Services)

### BrainScraper Service
**Railway Dashboard → Settings → General:**
- [ ] **Root Directory**: `brainscraper` ⚠️ (NOT root!)
- [ ] **Watch Paths**: `brainscraper/**` (optional)
- [ ] **Port**: `3000`
- [ ] **Start Command**: `npm start`

### Scrapegoat Service
**Railway Dashboard → Settings → General:**
- [ ] **Root Directory**: `scrapegoat` ⚠️ (NOT root!)
- [ ] **Watch Paths**: `scrapegoat/**` (optional)
- [ ] **Start Command**: `python main.py` (from railway.toml)

### Scrapegoat Worker Service
**Railway Dashboard → Settings → General:**
- [ ] **Root Directory**: `scrapegoat` (same as main service)
- [ ] **Start Command**: `python start_redis_worker.py` ⚠️ (Different!)
- [ ] **Scaling**: Set to **5 replicas** (Settings → Scaling)

---

## ✅ PHASE 3: Environment Variables

### BrainScraper Variables
**Set in Railway Dashboard → BrainScraper → Settings → Variables:**

```bash
REDIS_URL=${{redis-bridge.REDIS_URL}}
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_BASE_URL=https://brainscraper.io
DATA_DIR=/data
RAPIDAPI_KEY=your-actual-key-here
```

### Scrapegoat Variables
**Set in Railway Dashboard → Scrapegoat → Settings → Variables:**

```bash
DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
APP_DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
REDIS_URL=${{redis-bridge.REDIS_URL}}
APP_REDIS_URL=${{redis-bridge.REDIS_URL}}
APP_CELERY_BROKER_URL=${{redis-bridge.REDIS_URL}}/1
APP_CELERY_RESULT_BACKEND=${{redis-bridge.REDIS_URL}}/2
PYTHONUNBUFFERED=1
ENVIRONMENT=production
OPENAI_API_KEY=sk-proj-your-key-here
CENSUS_API_KEY=your-census-key-here
RAPIDAPI_KEY=your-rapidapi-key-here
```

### Scrapegoat Worker Variables
**Same as Scrapegoat** (copy all variables above)

**Quick Setup:**
```bash
./setup-railway-variables.sh  # Sets infrastructure vars
# Then manually set API keys via dashboard
```

---

## ✅ PHASE 4: Code Requirements

### ✅ Already Fixed:
- [x] `scrapegoat/start_redis_worker.py` - Created
- [x] `scrapegoat/app/workers/redis_queue_worker.py` - Created
- [x] `brainscraper/package.json` - Has `--webpack` build flag
- [x] `scrapegoat/railway.toml` - Has Playwright install command

### Verify:
- [ ] `brainscraper/server.js` exists
- [ ] `scrapegoat/main.py` has `/health` endpoint
- [ ] All files are committed to git

---

## ✅ PHASE 5: Deploy Services

**Via Railway Dashboard:**
1. Go to each service → **Deployments** tab
2. Click **"Redeploy"** or **"New Deployment"**
3. Monitor build logs for errors

**Or via CLI:**
```bash
cd brainscraper && railway up
cd scrapegoat && railway up
cd scrapegoat && railway service  # Select worker, then railway up
```

---

## ✅ PHASE 6: Verification

### Health Checks:
- [ ] BrainScraper: Visit service URL → Should show Next.js app
- [ ] Scrapegoat: Visit `/health` → Should return `{"status": "healthy"}`
- [ ] Worker: Check Railway dashboard → 5 replicas running

### Connectivity:
- [ ] All services can connect to Redis (check logs)
- [ ] Scrapegoat can connect to PostgreSQL (check logs)
- [ ] Queue status works: Visit Scrapegoat `/queue/status`

### End-to-End Test:
- [ ] Push test lead from BrainScraper
- [ ] Verify lead appears in queue (`/queue/status`)
- [ ] Verify worker processes lead (check worker logs)
- [ ] Verify lead is saved to database

---

## 🚨 Critical Issues to Avoid

### ❌ Wrong Root Directory
- **Symptom**: "Railpack could not determine" error
- **Fix**: Set Root Directory to `brainscraper` or `scrapegoat` in Railway dashboard

### ❌ Missing Worker File
- **Symptom**: Worker service fails to start
- **Fix**: ✅ Already created `scrapegoat/start_redis_worker.py`

### ❌ Wrong Variable Syntax
- **Symptom**: Services can't connect to Redis/PostgreSQL
- **Fix**: Use `${{service-name.VARIABLE_NAME}}` syntax (double curly braces)

### ❌ Missing Playwright
- **Symptom**: Scrapegoat crashes on startup
- **Fix**: ✅ Already in build command: `playwright install chromium`

---

## 📋 Quick Checklist

**Before Deployment:**
- [ ] Infrastructure services created (Redis, PostgreSQL)
- [ ] Root directories set correctly
- [ ] All environment variables set
- [ ] Worker file exists (`start_redis_worker.py`)
- [ ] All code committed to git

**After Deployment:**
- [ ] All services are online
- [ ] Health checks pass
- [ ] Services can communicate (Redis, PostgreSQL)
- [ ] Workers are processing queue
- [ ] End-to-end test passes

---

## 📚 Full Documentation

For detailed instructions, see:
- **`DEPLOYMENT_CHECKLIST.md`** - Complete step-by-step guide
- **`RAILWAY_COMPLETE_SETUP.md`** - Detailed setup walkthrough
- **`MONOREPO_RAILWAY_SETUP.md`** - Monorepo configuration
- **`RAILWAY_ENV_VARIABLES.md`** - Environment variable reference

---

## 🎯 Success Criteria

Deployment is successful when:
1. ✅ All 5 services are online (Redis, PostgreSQL, BrainScraper, Scrapegoat, Worker)
2. ✅ All services pass health checks
3. ✅ Services can communicate via Redis queue
4. ✅ Services can read/write to PostgreSQL
5. ✅ Workers are processing leads from queue
6. ✅ End-to-end lead flow works

---

## 🚀 Next Steps

1. **Complete Phase 1**: Create Redis and PostgreSQL in Railway dashboard
2. **Complete Phase 2**: Set root directories for all services
3. **Complete Phase 3**: Set all environment variables
4. **Complete Phase 4**: Verify code requirements (already done)
5. **Complete Phase 5**: Deploy all services
6. **Complete Phase 6**: Verify everything works

**Estimated Time**: 30-60 minutes (depending on build times)
