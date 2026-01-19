# Railway Environment Variables Configuration

This document provides the complete environment variable configuration for all services using Railway's shared variable references.

## 🔗 Railway Variable Reference Syntax

Railway uses `${{service-name.VARIABLE_NAME}}` syntax to reference variables from other services. This ensures all services connect to the same cloud infrastructure.

## 📋 Service Configurations

### BrainScraper Service (Next.js Producer)

**Infrastructure Variables:**
```bash
REDIS_URL=${{redis-bridge.REDIS_URL}}
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_BASE_URL=https://brainscraper.io
DATA_DIR=/data
```

**API Keys:**
```bash
RAPIDAPI_KEY=your-rapidapi-key-here
```

**Optional:**
```bash
USHA_JWT_TOKEN=your-token (or use COGNITO_REFRESH_TOKEN)
CRON_SECRET=your-secret
NODE_VERSION=20
```

### Scrapegoat Service (FastAPI Consumer)

**Infrastructure Variables (Shared):**
```bash
DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
APP_DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
REDIS_URL=${{redis-bridge.REDIS_URL}}
APP_REDIS_URL=${{redis-bridge.REDIS_URL}}
APP_CELERY_BROKER_URL=${{redis-bridge.REDIS_URL}}/1
APP_CELERY_RESULT_BACKEND=${{redis-bridge.REDIS_URL}}/2
PYTHONUNBUFFERED=1
```

**API Keys:**
```bash
OPENAI_API_KEY=sk-proj-k8Co9... (for AI-native extraction and self-healing)
CENSUS_API_KEY=b4f15ee777... (for US income and demographic enrichment)
CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD (for CAPTCHA solving)
```

**Chimera Brain (Hive Mind, used by Chimera Deep Search station):**
At least one of these must be set for `predict-path` and `store-pattern` to work.
```bash
CHIMERA_BRAIN_HTTP_URL=https://chimera-brain-v1-production.up.railway.app
# or (gRPC address; if set and contains 50051, HTTP URL is derived as :8080):
CHIMERA_BRAIN_ADDRESS=chimera-brain.railway.internal:50051
```

**Proxy & Scraping:**
```bash
DECODO_API_KEY=your-decodo-key (for residential proxy rotation)
DECODO_USER=user (optional, defaults to "user")
```

**Optional ScraperAPI Keys:**
```bash
SCRAPERAPI_KEY=your-key
SCRAPERAPI_KEY_1=your-key-1
SCRAPERAPI_KEY_2=your-key-2
SCRAPINGBEE_API_KEY=your-key
```

### Scrapegoat Worker Service

**Same as Scrapegoat Service** (all variables above)

**Plus:**
- Ensure start command is: `python start_redis_worker.py`

## 🚀 Setting Variables via CLI

### BrainScraper Service
```bash
cd brainscraper
railway variables --set "REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "RAPIDAPI_KEY=your-key"
railway variables --set "NODE_ENV=production"
railway variables --set "PORT=3000"
railway variables --set "NEXT_PUBLIC_BASE_URL=https://brainscraper.io"
railway variables --set "DATA_DIR=/data"
```

### Scrapegoat Service
```bash
cd scrapegoat
railway variables --set "DATABASE_URL=\${{PostgreSQL.DATABASE_URL}}"
railway variables --set "APP_DATABASE_URL=\${{PostgreSQL.DATABASE_URL}}"
railway variables --set "REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "APP_REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "APP_CELERY_BROKER_URL=\${{redis-bridge.REDIS_URL}}/1"
railway variables --set "APP_CELERY_RESULT_BACKEND=\${{redis-bridge.REDIS_URL}}/2"
railway variables --set "PYTHONUNBUFFERED=1"
railway variables --set "OPENAI_API_KEY=sk-proj-k8Co9..."
railway variables --set "CENSUS_API_KEY=b4f15ee777..."
```

## 📝 Setting Variables via Railway Dashboard

1. Go to Railway Dashboard → Your Service → Settings → Variables
2. Click "New Variable"
3. Enter variable name and value
4. For shared variables, use the `${{service-name.VARIABLE_NAME}}` syntax
5. Railway will auto-complete available service references

## ⚠️ Important Notes

### Variable Reference Syntax
- Use `${{service-name.VARIABLE_NAME}}` (double curly braces)
- Service names must match exactly (case-sensitive)
- Railway auto-provides these for database services:
  - `${{PostgreSQL.DATABASE_URL}}` (for PostgreSQL)
  - `${{redis-bridge.REDIS_URL}}` (for Redis, if service is named `redis-bridge`)

### Database URL Format
- Railway provides PostgreSQL URLs in format: `postgresql://...`
- Scrapegoat's start command automatically converts to `postgresql+psycopg://` format
- No manual conversion needed

### Redis Database Numbers
- Celery broker uses database `/1`
- Celery result backend uses database `/2`
- Main queue uses database `/0` (default)

### Service Naming
Ensure your Railway services are named exactly:
- Redis: `redis-bridge`
- PostgreSQL: `PostgreSQL` (Railway default) or your custom name
- If names differ, update variable references accordingly

## ✅ Verification

After setting variables, verify they're correct:

```bash
# Check BrainScraper variables
cd brainscraper
railway variables

# Check Scrapegoat variables
cd ../scrapegoat
railway variables
```

## 🔄 Updating Variables

To update a variable:
```bash
railway variables --set "KEY=new-value"
```

To delete a variable:
```bash
# Via dashboard: Settings → Variables → Delete
# Or via CLI (if supported in your version)
```

## 📚 Reference

- Railway Variable Docs: https://docs.railway.com/develop/variables
- Railway CLI Variables: `railway variables --help`
