# Complete Railway Setup Guide - Professional Cloud Configuration

This guide ensures your BrainScraper and Scrapegoat services are properly configured with Railway's shared variable references, replacing all localhost values with cloud infrastructure connections.

## 🎯 Goal

Replace all localhost database/Redis connections with Railway's shared variable references (`${{service-name.VARIABLE_NAME}}`) so all services connect to the same cloud infrastructure.

## ✅ Prerequisites

- [x] Railway project created: `scrapeshifter`
- [x] BrainScraper service created
- [ ] Redis service created (name: `redis-bridge`)
- [ ] PostgreSQL service created
- [ ] Scrapegoat service created
- [ ] Scrapegoat Worker service created

## 📋 Step-by-Step Configuration

### Step 1: Add Infrastructure Services

**In Railway Dashboard:**

1. **Add Redis Database:**
   - Go to: https://railway.com/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
   - Click "New" → "Database" → "Add Redis"
   - **Name it exactly**: `redis-bridge`
   - Railway will auto-generate `REDIS_URL`

2. **Add PostgreSQL Database:**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will auto-generate `DATABASE_URL`
   - Service name will be `PostgreSQL` (Railway default)

### Step 2: Configure BrainScraper Service Variables

**Via CLI (from project root):**
```bash
cd brainscraper
railway service  # Ensure linked to brainscraper service

# Infrastructure (Shared Variables)
railway variables --set "REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "NODE_ENV=production"
railway variables --set "PORT=3000"
railway variables --set "NEXT_PUBLIC_BASE_URL=https://brainscraper.io"
railway variables --set "DATA_DIR=/data"

# API Keys (Set your actual keys)
railway variables --set "RAPIDAPI_KEY=your-actual-rapidapi-key"
```

**Via Dashboard:**
1. Go to BrainScraper service → Settings → Variables
2. Add each variable using the `${{redis-bridge.REDIS_URL}}` syntax
3. Railway will auto-complete available service references

### Step 3: Configure Scrapegoat Service Variables

**Via CLI:**
```bash
cd scrapegoat
railway service  # Ensure linked to scrapegoat service

# Infrastructure (Shared Variables)
railway variables --set "DATABASE_URL=\${{PostgreSQL.DATABASE_URL}}"
railway variables --set "APP_DATABASE_URL=\${{PostgreSQL.DATABASE_URL}}"
railway variables --set "REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "APP_REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "APP_CELERY_BROKER_URL=\${{redis-bridge.REDIS_URL}}/1"
railway variables --set "APP_CELERY_RESULT_BACKEND=\${{redis-bridge.REDIS_URL}}/2"
railway variables --set "PYTHONUNBUFFERED=1"

# API Keys (Set your actual keys)
railway variables --set "OPENAI_API_KEY=sk-proj-k8Co9..."
railway variables --set "CENSUS_API_KEY=b4f15ee777..."
```

**Via Dashboard:**
1. Go to Scrapegoat service → Settings → Variables
2. Add all variables using Railway's variable reference syntax
3. Use `${{PostgreSQL.DATABASE_URL}}` for database
4. Use `${{redis-bridge.REDIS_URL}}` for Redis connections

### Step 4: Configure Scrapegoat Worker Service Variables

**Same as Scrapegoat Service** (all variables above)

**Plus ensure:**
- Start command is set to: `python start_redis_worker.py`
- Service is scaled to 5 replicas (Settings → Scaling)

### Step 5: Verify Configuration

**Check BrainScraper:**
```bash
cd brainscraper
railway variables
```

Should show:
- ✅ `REDIS_URL=${{redis-bridge.REDIS_URL}}`
- ✅ `NODE_ENV=production`
- ✅ `PORT=3000`
- ✅ `NEXT_PUBLIC_BASE_URL=https://brainscraper.io`
- ✅ `DATA_DIR=/data`
- ✅ `RAPIDAPI_KEY=...` (your key)

**Check Scrapegoat:**
```bash
cd scrapegoat
railway variables
```

Should show:
- ✅ `DATABASE_URL=${{PostgreSQL.DATABASE_URL}}`
- ✅ `APP_DATABASE_URL=${{PostgreSQL.DATABASE_URL}}`
- ✅ `REDIS_URL=${{redis-bridge.REDIS_URL}}`
- ✅ `APP_REDIS_URL=${{redis-bridge.REDIS_URL}}`
- ✅ `APP_CELERY_BROKER_URL=${{redis-bridge.REDIS_URL}}/1`
- ✅ `APP_CELERY_RESULT_BACKEND=${{redis-bridge.REDIS_URL}}/2`
- ✅ `PYTHONUNBUFFERED=1`
- ✅ `OPENAI_API_KEY=...` (your key)
- ✅ `CENSUS_API_KEY=...` (your key)

## 🔑 Required API Keys

Set these in the appropriate services:

### BrainScraper Service
- `RAPIDAPI_KEY` - Required for LinkedIn scraping

### Scrapegoat Service & Worker
- `OPENAI_API_KEY` - For AI-native extraction and self-healing (format: `sk-proj-...`)
- `CENSUS_API_KEY` - For US income and demographic enrichment (format: `b4f15ee777...`)

### Optional (Scrapegoat)
- `SCRAPERAPI_KEY` - For ScraperAPI integration
- `SCRAPINGBEE_API_KEY` - For ScrapingBee integration

## ⚠️ Important Notes

### Variable Reference Syntax
- **Must use**: `${{service-name.VARIABLE_NAME}}` (double curly braces)
- **Service names must match exactly**:
  - Redis: `redis-bridge` (if you named it that)
  - PostgreSQL: `PostgreSQL` (Railway default) or your custom name
- Railway will auto-complete available references in the dashboard

### Redis Database Numbers
- Main queue: `/0` (default, used by `REDIS_URL`)
- Celery broker: `/1` (used by `APP_CELERY_BROKER_URL`)
- Celery results: `/2` (used by `APP_CELERY_RESULT_BACKEND`)

### Database URL Format
- Railway provides: `postgresql://user:pass@host:port/db`
- Scrapegoat's start command automatically converts to: `postgresql+psycopg://...`
- No manual conversion needed

## 🚀 Quick Setup Script

After all services are created, run:

```bash
./setup-railway-variables.sh
```

This will set all infrastructure variables. You'll still need to set API keys manually.

## 📊 Variable Reference Table

| Variable | BrainScraper | Scrapegoat | Scrapegoat Worker | Source |
|----------|--------------|------------|-------------------|--------|
| `REDIS_URL` | ✅ | ✅ | ✅ | `${{redis-bridge.REDIS_URL}}` |
| `APP_REDIS_URL` | ❌ | ✅ | ✅ | `${{redis-bridge.REDIS_URL}}` |
| `DATABASE_URL` | ❌ | ✅ | ✅ | `${{PostgreSQL.DATABASE_URL}}` |
| `APP_DATABASE_URL` | ❌ | ✅ | ✅ | `${{PostgreSQL.DATABASE_URL}}` |
| `APP_CELERY_BROKER_URL` | ❌ | ✅ | ✅ | `${{redis-bridge.REDIS_URL}}/1` |
| `APP_CELERY_RESULT_BACKEND` | ❌ | ✅ | ✅ | `${{redis-bridge.REDIS_URL}}/2` |
| `PYTHONUNBUFFERED` | ❌ | ✅ | ✅ | `1` |
| `RAPIDAPI_KEY` | ✅ | ❌ | ❌ | Your key |
| `OPENAI_API_KEY` | ❌ | ✅ | ✅ | Your key |
| `CENSUS_API_KEY` | ❌ | ✅ | ✅ | Your key |

## ✅ Verification Checklist

- [ ] Redis service created and named `redis-bridge`
- [ ] PostgreSQL service created
- [ ] BrainScraper variables set with `${{redis-bridge.REDIS_URL}}`
- [ ] Scrapegoat variables set with database and Redis references
- [ ] Scrapegoat Worker variables set (same as Scrapegoat)
- [ ] All API keys set (RAPIDAPI_KEY, OPENAI_API_KEY, CENSUS_API_KEY)
- [ ] Worker service start command: `python start_redis_worker.py`
- [ ] Worker service scaled to 5 replicas
- [ ] All services deployed and healthy
- [ ] Queue processing verified (check Redis: `LLEN leads_to_enrich`)

## 🐛 Troubleshooting

### Variables Show as Empty
- **Cause**: Referenced service doesn't exist yet
- **Fix**: Create the service first (Redis, PostgreSQL), then set variables

### Variable Reference Not Working
- **Cause**: Service name mismatch
- **Fix**: Check exact service names in Railway dashboard, update references

### Database Connection Fails
- **Cause**: URL format issue
- **Fix**: Scrapegoat's start command handles conversion automatically

### Redis Connection Fails
- **Cause**: Wrong service name or URL format
- **Fix**: Verify service is named `redis-bridge` and use `${{redis-bridge.REDIS_URL}}`

## 📚 Reference Documents

- Environment Variables Guide: `RAILWAY_ENV_VARIABLES.md`
- Setup Status: `RAILWAY_SETUP_STATUS.md`
- Full Deployment Guide: `RAILWAY_DEPLOYMENT.md`
