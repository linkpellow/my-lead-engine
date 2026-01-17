# Enrichment Pipeline Setup Guide

## 🎯 Overview

This guide covers setting up the complete LinkedIn → Phone enrichment pipeline.

```
LinkedIn Lead → Redis Queue → Scraper Enrichment → Phone Number
                                    ↓
                              People Search Sites
                              (FastPeopleSearch, ThatsThem, etc.)
```

---

## 📋 Required Environment Variables

### Scrapegoat Service

```bash
# Core
REDIS_URL=${{redis-bridge.REDIS_URL}}
DATABASE_URL=${{PostgreSQL.DATABASE_URL}}

# Proxy (for bypassing blocks)
DECODO_API_KEY=your-decodo-api-key
# OR
PROXY_URL=http://user:pass@proxy:port

# CAPTCHA Solving (for blocked sites)
CAPSOLVER_API_KEY=your-capsolver-api-key

# Optional: OpenAI for self-healing spiders
OPENAI_API_KEY=sk-...
```

### Scrapegoat Worker Service (same as above)

```bash
REDIS_URL=${{redis-bridge.REDIS_URL}}
DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
DECODO_API_KEY=your-decodo-api-key
CAPSOLVER_API_KEY=your-capsolver-api-key
```

### Auth Worker Service (NEW - for automated cookie harvesting)

```bash
REDIS_URL=${{redis-bridge.REDIS_URL}}

# Platform Credentials (at least one required)
LINKEDIN_EMAIL=your@email.com
LINKEDIN_PASSWORD=your-password

# Optional
FACEBOOK_EMAIL=your@email.com
FACEBOOK_PASSWORD=your-password
USHA_EMAIL=your@email.com
USHA_PASSWORD=your-password

# Settings
AUTH_REFRESH_INTERVAL_HOURS=6
PROXY_URL=http://user:pass@proxy:port
```

---

## 🚀 Railway Service Setup

### 1. Scrapegoat (Main API)
- **Root Directory:** `scrapegoat`
- **Build Command:** `pip install -r requirements.txt && playwright install chromium`
- **Start Command:** `python main.py`
- **Port:** 8000

### 2. Scrapegoat Worker (Redis Consumer)
- **Root Directory:** `scrapegoat`
- **Build Command:** `pip install -r requirements.txt && playwright install chromium`
- **Start Command:** `python start_redis_worker.py`
- **Replicas:** 5 (for throughput)

### 3. Auth Worker (Cookie Harvester) - NEW
- **Root Directory:** `scrapegoat`
- **Build Command:** `pip install -r requirements.txt && playwright install chromium`
- **Start Command:** `python start_auth_worker.py`
- **Replicas:** 1 (only need one)

---

## 🔧 People Search Site Status

| Site | URL Format | Protection | Status |
|------|------------|------------|--------|
| FastPeopleSearch | `/name/john-smith_miami-fl` | Cloudflare | ✅ Blueprint Ready |
| ThatsThem | `/name/John-Smith/Miami-FL` | CAPTCHA | ✅ Blueprint Ready |
| TruePeopleSearch | `?name=john+smith&citystatezip=miami,+fl` | Heavy Cloudflare | ⚠️ Needs Browser Mode |
| WhitePages | `/name/John-Smith/Miami-FL` | Heavy Protection | ⚠️ Often Blocked |

---

## 🧪 Testing the Pipeline

### 1. Test Blueprint Loading
```bash
curl http://localhost:8000/api/blueprints
```

### 2. Test HTML Fetching
```bash
curl -X POST http://localhost:8000/api/fetch-html \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.fastpeoplesearch.com/name/john-smith_miami-fl", "useStealth": true}'
```

### 3. Test Full Enrichment
```bash
curl -X POST http://localhost:8000/worker/process-lead \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "location": "Miami, Florida, United States",
    "linkedinUrl": "https://linkedin.com/in/johnsmith"
  }'
```

### 4. Check Queue Status
```bash
curl http://localhost:8000/queue/status
```

---

## 🛠️ Troubleshooting

### No Phone Found
1. Check if blueprints exist: `GET /api/blueprints`
2. Check if site is blocked: Look for CAPTCHA errors in logs
3. Try browser mode: Set `requiresBrowser: true` in blueprint

### CAPTCHA Blocks
1. Ensure `CAPSOLVER_API_KEY` is set
2. Ensure `DECODO_API_KEY` is set (residential proxy helps)
3. Check if browser mode is enabled for the site

### Blueprint Not Found
1. Blueprints should be in `scrapegoat/data/dojo-blueprints/`
2. Use Dojo to map new sites: BrainScraper → Dojo → Site Library

---

## 📊 Monitoring

### Check Auth Cookie Status
```bash
curl http://localhost:8000/auth/status
```

### Check DLQ (Failed Leads)
```bash
curl http://localhost:8000/dlq
```

### Retry Failed Leads
```bash
curl -X POST http://localhost:8000/dlq/retry-all
```

---

## 🔄 The Full Flow

```
1. BrainScraper scrapes LinkedIn
   ↓
2. Pushes lead to Redis queue: leads_to_enrich
   ↓
3. Scrapegoat Worker picks up lead
   ↓
4. Identity Resolution: "John Smith, Miami, FL" → firstName, lastName, city, state
   ↓
5. Scraper Enrichment:
   a. Build URL: fastpeoplesearch.com/name/john-smith_miami-fl
   b. Fetch HTML (stealth + proxy)
   c. Extract phone using CSS selector: a[href^='tel:']::text
   d. If CAPTCHA: retry with Browser Mode + CAPSOLVER
   e. If still blocked: fallback to skip-tracing API
   ↓
6. Telnyx Gatekeep: Validate phone (reject VOIP/Landline)
   ↓
7. DNC Scrub: Check Do-Not-Call registry
   ↓
8. Demographics: Add income/age from Census
   ↓
9. Save to PostgreSQL
```

---

## ✅ Checklist Before Go-Live

- [ ] `REDIS_URL` set in all services
- [ ] `DATABASE_URL` set in all services
- [ ] `DECODO_API_KEY` set (proxy)
- [ ] `CAPSOLVER_API_KEY` set (CAPTCHA)
- [ ] Blueprints exist in `scrapegoat/data/dojo-blueprints/`
- [ ] Worker replicas set to 5+
- [ ] Auth Worker deployed (if using LinkedIn cookies)
- [ ] Test enrichment on a sample lead
