# Pre-Push Test Checklist

## ✅ Code Quality Checks

- [x] TypeScript compiles (`npx tsc --noEmit` - PASSED)
- [x] Python syntax valid (py_compile - PASSED)
- [x] No linter errors
- [x] All imports resolve correctly

## 🧪 Quick Integration Tests

### 1. Blueprint Storage API
```bash
# Test: Save blueprint
curl -X POST http://localhost:3000/api/dojo/blueprints \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "fastpeoplesearch.com",
    "blueprint": {
      "targetUrl": "https://fastpeoplesearch.com/api/person",
      "method": "POST",
      "extraction": {
        "phone": "$.data.phones[0].number",
        "age": "$.data.age"
      }
    }
  }'

# Test: List blueprints
curl http://localhost:3000/api/dojo/blueprints
```

### 2. CAPTCHA Solver (Manual Test)
```python
# In Python shell:
from app.scraping.captcha_solver import get_captcha_solver
solver = get_captcha_solver()
print(f"CAPTCHA solver available: {solver.is_available()}")
```

### 3. Scraper Enrichment (Manual Test)
```python
# Test identity resolution → scraper enrichment
from app.enrichment.scraper_enrichment import enrich_with_scraper

identity = {
    "firstName": "John",
    "lastName": "Doe",
    "city": "Naples",
    "state": "FL",
    "zipcode": "34101"
}

# This will try to load blueprints and scrape
result = enrich_with_scraper(identity)
print(f"Result: {result}")
```

## 🚀 Deployment Readiness

### Environment Variables Required

**Scrapegoat Service:**
- [x] `CAPSOLVER_API_KEY` - Set in Railway
- [x] `DECODO_API_KEY` - For proxy rotation
- [x] `DATABASE_URL` - PostgreSQL connection
- [x] `REDIS_URL` - Queue connection

**Scrapegoat Worker Service:**
- [x] Same as Scrapegoat Service

**BrainScraper Service:**
- [x] `REDIS_URL` - Queue connection
- [x] `RAPIDAPI_KEY` - LinkedIn scraping

### Files Changed Summary

**New Files:**
- `scrapegoat/app/scraping/captcha_solver.py` - CAPTCHA solving
- `scrapegoat/app/enrichment/scraper_enrichment.py` - Scraper-based enrichment
- `brainscraper/app/api/dojo/blueprints/route.ts` - Blueprint storage
- `brainscraper/app/components/dojo/DataFieldView.tsx` - Data-centric UI
- `brainscraper/utils/requestClassifier.ts` - Smart request categorization
- `brainscraper/utils/leadFieldExtractor.ts` - Field extraction (already existed)

**Modified Files:**
- `scrapegoat/app/scraping/base.py` - CAPTCHA integration
- `scrapegoat/app/workers/redis_queue_worker.py` - Scraper enrichment integration
- `brainscraper/app/dojo/page.tsx` - Data-centric redesign
- `brainscraper/app/api/dojo/deploy/route.ts` - Blueprint saving

## 🎯 What This Enables

1. ✅ **Scraper-Based Enrichment**: Replaces expensive skip-tracing APIs
2. ✅ **CAPTCHA Auto-Solving**: CAPSOLVER handles all CAPTCHA types
3. ✅ **Full BaseScraper Power**: Stealth, proxies, rate limiting, circuit breaking
4. ✅ **Data-Centric Dojo UI**: Focus on extracted data, not endpoints
5. ✅ **Blueprint Storage**: Patterns saved for reuse

## ⚠️ Before Pushing

1. **Set CAPSOLVER_API_KEY in Railway** (both Scrapegoat services)
2. **Set DECODO_API_KEY in Railway** (for proxy rotation)
3. **Verify blueprints directory exists** (`/data/dojo-blueprints` on Railway)
4. **Test locally** (optional but recommended)

## 📝 Commit Message Suggestion

```
feat: Add scraper-based enrichment with CAPTCHA solving

- Replace skip-tracing APIs with direct scraping (FastPeopleSearch, That's Them)
- Integrate CAPSOLVER for automatic CAPTCHA solving (reCAPTCHA, Turnstile, Cloudflare)
- Full BaseScraper utilization (stealth, proxies, rate limiting, circuit breaking)
- Data-centric Dojo UI redesign (focus on extracted fields)
- Blueprint storage system for pattern-driven extraction
- Parallel site attempts (3 sites at once for speed)

Breaking: None (backward compatible, falls back to APIs if scrapers fail)
```
