# Quick Railway Variables Check

Since Railway CLI requires interactive service selection, use the **Railway Dashboard**:

## 🔗 Direct Links (if you're logged in):
1. Go to: https://railway.app/dashboard
2. Select your project
3. Click each service → Settings → Variables

## ✅ What to Verify:

### BrainScraper Service:
- ✅ REDIS_URL (should use ${{redis-bridge.REDIS_URL}})
- ✅ RAPIDAPI_KEY (your actual key)
- ✅ NODE_ENV=production
- ✅ PORT=3000

### Scrapegoat Service:
- ✅ DATABASE_URL (${{PostgreSQL.DATABASE_URL}})
- ✅ REDIS_URL (${{redis-bridge.REDIS_URL}})
- ✅ CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD ⭐ NEW
- ✅ DECODO_API_KEY (for proxy rotation)
- ✅ OPENAI_API_KEY
- ✅ CENSUS_API_KEY

### Scrapegoat Worker Service:
- ✅ ALL same as Scrapegoat Service
- ✅ CAPSOLVER_API_KEY ⭐ CRITICAL (must be set here too)
- ✅ DECODO_API_KEY

## 🚨 Most Important NEW Variables:
1. **CAPSOLVER_API_KEY** - Set in BOTH Scrapegoat AND Worker
2. **DECODO_API_KEY** - Set in BOTH Scrapegoat AND Worker

See RAILWAY_VARS_CHECKLIST.md for complete list.
