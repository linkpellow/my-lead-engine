# CAPSOLVER API Key Setup

## 🎯 Where to Put CAPSOLVER_API_KEY

**Answer: Scrapegoat ONLY** (not BrainScraper)

The CAPTCHA solving happens in `scrapegoat/app/scraping/captcha_solver.py`, which is used by BaseScraper during enrichment.

---

## 📍 Railway Configuration

### Option 1: Railway Dashboard (Easiest)

1. Go to Railway Dashboard
2. Select **Scrapegoat Service**
3. Go to **Settings** → **Variables**
4. Add variable:
   ```
   CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD
   ```

5. **Also add to Scrapegoat Worker Service** (same steps, but select "scrapegoat-worker" service):
   ```
   CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD
   ```

### Option 2: Railway CLI

```bash
# Set for Scrapegoat Service
cd scrapegoat
railway service  # Ensure linked to scrapegoat service
railway variables --set "CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD"

# Set for Scrapegoat Worker Service
railway service  # Switch to scrapegoat-worker service
railway variables --set "CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD"
```

---

## ✅ Services That Need It

| Service | Needs CAPSOLVER_API_KEY? | Why |
|---------|-------------------------|-----|
| **BrainScraper** | ❌ NO | CAPTCHA solving happens in scrapegoat workers |
| **Scrapegoat** | ✅ YES | Main FastAPI service (if it runs scrapers) |
| **Scrapegoat Worker** | ✅ YES | **CRITICAL** - Workers do the enrichment with scrapers |

---

## 🔍 Verification

After setting the variable, check logs:

```bash
# In Scrapegoat Worker logs, you should see:
✅ Connected to Redis
🔄 Processing lead: John Doe
🔍 Step 2: Scraper-Based Enrichment
🌐 Attempting: fastpeoplesearch.com (stealth + proxy)

# If CAPTCHA encountered:
🧩 CAPTCHA detected (cloudflare_challenge) - solving...
✅ CAPTCHA solved - retrying request

# If CAPSOLVER_API_KEY missing:
⚠️ CAPSOLVER_API_KEY not set - CAPTCHA solving disabled
❌ Scraping failed: Client Error 403
```

---

## 📋 Complete Environment Variables for Scrapegoat

```bash
# Infrastructure (Shared)
DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
APP_DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
REDIS_URL=${{redis-bridge.REDIS_URL}}
APP_REDIS_URL=${{redis-bridge.REDIS_URL}}
APP_CELERY_BROKER_URL=${{redis-bridge.REDIS_URL}}/1
APP_CELERY_RESULT_BACKEND=${{redis-bridge.REDIS_URL}}/2
PYTHONUNBUFFERED=1

# API Keys
OPENAI_API_KEY=sk-proj-...
CENSUS_API_KEY=b4f15ee777...
CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD

# Proxy (Optional but recommended)
DECODO_API_KEY=your-decodo-key
DECODO_USER=user
```

---

## 🚨 Important Notes

1. **Set in BOTH services**: Scrapegoat service AND Scrapegoat Worker service
2. **Worker is critical**: Workers do the enrichment, so they MUST have the key
3. **No quotes needed**: Railway handles values directly (don't use quotes around the key)
4. **Case sensitive**: Must be exactly `CAPSOLVER_API_KEY` (all caps, underscores)

---

## 🔄 After Setting

1. **Redeploy** the services (Railway auto-deploys on variable changes)
2. **Check logs** to verify CAPTCHA solving is enabled
3. **Test** by scraping a site that requires CAPTCHA (you'll see solving in logs)

---

## ✅ Quick Checklist

- [ ] Added `CAPSOLVER_API_KEY` to **Scrapegoat Service**
- [ ] Added `CAPSOLVER_API_KEY` to **Scrapegoat Worker Service**
- [ ] Verified in logs (no "CAPTCHA solving disabled" warnings)
- [ ] Tested with a site that requires CAPTCHA
