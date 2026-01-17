# Monorepo Railway Setup - Complete Guide

## 🎯 Overview

This guide ensures your monorepo (`brainscraper/` + `scrapegoat/`) deploys correctly on Railway with proper service isolation and independent builds.

## 📁 Project Structure

```
my-lead-engine/
├── brainscraper/          # Next.js service (Port 3000)
│   ├── package.json
│   ├── railway.toml
│   └── ...
├── scrapegoat/            # FastAPI service (Port 8000)
│   ├── requirements.txt
│   ├── railway.toml
│   └── ...
└── docker-compose.yml     # Local development only
```

## ✅ Required Configuration

### Service 1: BrainScraper

**Railway Dashboard Settings:**
- **Root Directory**: `brainscraper`
- **Watch Paths**: `brainscraper/**`
- **Port**: `3000` (from env var)
- **Build Command**: `npm run build` (auto-detected)
- **Start Command**: `npm start` (auto-detected)

**Environment Variables:**
```
NODE_ENV=production
PORT=3000
REDIS_URL=${{redis-bridge.REDIS_URL}}
NEXT_PUBLIC_BASE_URL=https://brainscraper.io
DATA_DIR=/data
RAPIDAPI_KEY=your-key
```

### Service 2: Scrapegoat

**Railway Dashboard Settings:**
- **Root Directory**: `scrapegoat`
- **Watch Paths**: `scrapegoat/**`
- **Port**: `8000` (auto-assigned by Railway)
- **Build Command**: Auto-detected from `railway.toml`
- **Start Command**: Auto-detected from `railway.toml`

**Environment Variables:**
```
PYTHONUNBUFFERED=1
DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
APP_DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
REDIS_URL=${{redis-bridge.REDIS_URL}}
APP_REDIS_URL=${{redis-bridge.REDIS_URL}}
APP_CELERY_BROKER_URL=${{redis-bridge.REDIS_URL}}/1
APP_CELERY_RESULT_BACKEND=${{redis-bridge.REDIS_URL}}/2
OPENAI_API_KEY=sk-proj-k8Co9...
CENSUS_API_KEY=b4f15ee777...
```

### Service 3: Scrapegoat Worker

**Railway Dashboard Settings:**
- **Root Directory**: `scrapegoat`
- **Watch Paths**: `scrapegoat/**`
- **Start Command**: `python start_redis_worker.py`
- **Scaling**: 5 replicas

**Environment Variables:**
(Same as Scrapegoat service)

## 🔧 Quick Fix Commands

### Via Railway Dashboard (Recommended)

1. **Open Dashboard**: https://railway.com/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195

2. **For each service:**
   - Click service → Settings → General
   - Set **Root Directory**: `brainscraper` or `scrapegoat`
   - Set **Watch Paths**: `brainscraper/**` or `scrapegoat/**`
   - Save

### Verify via CLI

```bash
# Check current service
railway status

# View service configuration (if available)
railway service info  # May not show root directory

# Deploy to verify
railway up
```

## 📊 Service Dependencies

```
BrainScraper (Producer)
    ↓ (pushes to Redis)
Redis Bridge
    ↓ (consumes from Redis)
Scrapegoat Worker (Consumer)
    ↓ (uses)
PostgreSQL Database
```

## 🚀 Deployment Flow

1. **BrainScraper** builds from `brainscraper/` folder
2. **Scrapegoat** builds from `scrapegoat/` folder
3. **Worker** uses same `scrapegoat/` folder but different start command
4. All services connect via shared Redis and PostgreSQL

## ✅ Success Indicators

After proper configuration:
- ✅ No more "Railpack could not determine" errors
- ✅ Each service builds independently
- ✅ Build logs show correct root directory
- ✅ Services start successfully
- ✅ Redis bridge works (check queue: `LLEN leads_to_enrich`)

## 📚 Related Documents

- **Fix Guide**: `FIX_RAILPACK_ERROR.md` - Detailed fix instructions
- **Complete Setup**: `RAILWAY_COMPLETE_SETUP.md` - Full deployment guide
- **CLI Commands**: `RAILWAY_CLI_COMMANDS.md` - CLI reference
