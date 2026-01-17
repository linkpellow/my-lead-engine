# Railway Environment Variables Checklist

## 🔍 How to Check Variables

### Option 1: Railway Dashboard (Easiest)
1. Go to https://railway.app/dashboard
2. Select your project
3. Click on each service → **Settings** → **Variables**
4. Verify all variables below

### Option 2: Railway CLI (Interactive)
```bash
# Check BrainScraper
cd brainscraper
railway service  # Select brainscraper service
railway variables

# Check Scrapegoat
cd ../scrapegoat
railway service  # Select scrapegoat service
railway variables

# Check Scrapegoat Worker
railway service  # Select scrapegoat-worker service
railway variables
```

---

## ✅ BrainScraper Service Variables

### Required:
- [ ] `REDIS_URL` = `${{redis-bridge.REDIS_URL}}`
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `3000`
- [ ] `RAPIDAPI_KEY` = `your-actual-key`
- [ ] `NEXT_PUBLIC_BASE_URL` = `https://brainscraper.io`
- [ ] `DATA_DIR` = `/data`

### Optional:
- [ ] `USHA_JWT_TOKEN` = `your-token`
- [ ] `CRON_SECRET` = `your-secret`
- [ ] `NODE_VERSION` = `20`

---

## ✅ Scrapegoat Service Variables

### Infrastructure (Shared):
- [ ] `DATABASE_URL` = `${{PostgreSQL.DATABASE_URL}}`
- [ ] `APP_DATABASE_URL` = `${{PostgreSQL.DATABASE_URL}}`
- [ ] `REDIS_URL` = `${{redis-bridge.REDIS_URL}}`
- [ ] `APP_REDIS_URL` = `${{redis-bridge.REDIS_URL}}`
- [ ] `APP_CELERY_BROKER_URL` = `${{redis-bridge.REDIS_URL}}/1`
- [ ] `APP_CELERY_RESULT_BACKEND` = `${{redis-bridge.REDIS_URL}}/2`
- [ ] `PYTHONUNBUFFERED` = `1`

### API Keys:
- [ ] `OPENAI_API_KEY` = `sk-proj-...`
- [ ] `CENSUS_API_KEY` = `b4f15ee777...`
- [ ] `CAPSOLVER_API_KEY` = `CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD` ⭐ **NEW**
- [ ] `RAPIDAPI_KEY` = `your-key` (for skip-tracing fallback)

### Proxy (Recommended):
- [ ] `DECODO_API_KEY` = `your-decodo-key`
- [ ] `DECODO_USER` = `user` (optional, defaults to "user")

### Optional:
- [ ] `TELNYX_API_KEY` = `your-telnyx-key`
- [ ] `USHA_JWT_TOKEN` = `your-token`

---

## ✅ Scrapegoat Worker Service Variables

**CRITICAL: Must have ALL the same variables as Scrapegoat Service**

### Required (Same as Scrapegoat):
- [ ] `DATABASE_URL` = `${{PostgreSQL.DATABASE_URL}}`
- [ ] `REDIS_URL` = `${{redis-bridge.REDIS_URL}}`
- [ ] `CAPSOLVER_API_KEY` = `CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD` ⭐ **CRITICAL**
- [ ] `DECODO_API_KEY` = `your-decodo-key` (for proxy rotation)
- [ ] `OPENAI_API_KEY` = `sk-proj-...`
- [ ] `CENSUS_API_KEY` = `b4f15ee777...`
- [ ] `PYTHONUNBUFFERED` = `1`

### Start Command:
- [ ] `python start_redis_worker.py`

---

## 🚨 Critical Variables for New Features

### CAPTCHA Solving (NEW):
- [ ] `CAPSOLVER_API_KEY` in **Scrapegoat Service**
- [ ] `CAPSOLVER_API_KEY` in **Scrapegoat Worker Service**

### Proxy Rotation (NEW):
- [ ] `DECODO_API_KEY` in **Scrapegoat Service**
- [ ] `DECODO_API_KEY` in **Scrapegoat Worker Service**

---

## 🔧 Quick Fix Commands

If any variables are missing, set them:

### BrainScraper:
```bash
cd brainscraper
railway service  # Select brainscraper
railway variables --set "REDIS_URL=\${{redis-bridge.REDIS_URL}}"
railway variables --set "RAPIDAPI_KEY=your-key"
```

### Scrapegoat:
```bash
cd scrapegoat
railway service  # Select scrapegoat
railway variables --set "CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD"
railway variables --set "DECODO_API_KEY=your-key"
```

### Scrapegoat Worker:
```bash
cd scrapegoat
railway service  # Select scrapegoat-worker
railway variables --set "CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD"
railway variables --set "DECODO_API_KEY=your-key"
```

---

## ⚠️ Common Issues

### Issue 1: Variable shows as `${{service.VAR}}` literally
**Problem**: Service name doesn't match or service doesn't exist
**Fix**: Verify service names match exactly (case-sensitive)

### Issue 2: CAPTCHA solving not working
**Problem**: `CAPSOLVER_API_KEY` missing in worker service
**Fix**: Set in BOTH Scrapegoat AND Scrapegoat Worker services

### Issue 3: Proxy rotation not working
**Problem**: `DECODO_API_KEY` not set
**Fix**: Set `DECODO_API_KEY` in Scrapegoat services

### Issue 4: Database connection fails
**Problem**: `DATABASE_URL` not using `${{PostgreSQL.DATABASE_URL}}` syntax
**Fix**: Use Railway's shared variable syntax

---

## ✅ Verification

After setting variables, verify in logs:

**Scrapegoat Worker logs should show:**
```
✅ Connected to Redis
🔄 Processing lead: ...
🔍 Step 2: Scraper-Based Enrichment
🌐 Attempting: fastpeoplesearch.com (stealth + proxy)
```

**If CAPSOLVER_API_KEY is set:**
- No "CAPTCHA solving disabled" warnings
- CAPTCHAs auto-solved when encountered

**If DECODO_API_KEY is set:**
- Logs show: "🌐 Proxy configured: gate.decodo.com:7000"

---

## 📝 Notes

- **Shared variables** use `${{service-name.VARIABLE_NAME}}` syntax
- **Service names** must match exactly (case-sensitive)
- **Worker service** needs ALL the same variables as main service
- **CAPSOLVER_API_KEY** is NEW and required for CAPTCHA solving
- **DECODO_API_KEY** is recommended for proxy rotation
