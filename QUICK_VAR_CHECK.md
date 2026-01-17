# Quick Railway Variables Check

Since Railway CLI requires interactive service selection, here's the fastest way to check:

## 🚀 Quick Commands (Run These)

### 1. Check BrainScraper
```bash
cd brainscraper
railway service  # Select "brainscraper" when prompted
railway variables
```

**Look for:**
- ✅ `REDIS_URL` (should show `${{redis-bridge.REDIS_URL}}`)
- ✅ `RAPIDAPI_KEY` (your actual key)
- ✅ `NODE_ENV=production`
- ✅ `PORT=3000`

---

### 2. Check Scrapegoat
```bash
cd scrapegoat
railway service  # Select "scrapegoat" when prompted
railway variables
```

**Look for:**
- ✅ `DATABASE_URL` (should show `${{PostgreSQL.DATABASE_URL}}`)
- ✅ `REDIS_URL` (should show `${{redis-bridge.REDIS_URL}}`)
- ✅ `CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD` ⭐ **NEW**
- ✅ `DECODO_API_KEY` (for proxy rotation)
- ✅ `OPENAI_API_KEY`
- ✅ `CENSUS_API_KEY`
- ✅ `PYTHONUNBUFFERED=1`

---

### 3. Check Scrapegoat Worker
```bash
cd scrapegoat
railway service  # Select "scrapegoat-worker" when prompted
railway variables
```

**Look for (SAME AS SCRAPEGOAT):**
- ✅ `DATABASE_URL`
- ✅ `REDIS_URL`
- ✅ `CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD` ⭐ **CRITICAL**
- ✅ `DECODO_API_KEY`
- ✅ `OPENAI_API_KEY`
- ✅ `CENSUS_API_KEY`
- ✅ `PYTHONUNBUFFERED=1`

---

## 🚨 If CAPSOLVER_API_KEY is Missing

Set it immediately:

```bash
# For Scrapegoat Service
cd scrapegoat
railway service  # Select "scrapegoat"
railway variables --set "CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD"

# For Scrapegoat Worker Service
railway service  # Select "scrapegoat-worker"
railway variables --set "CAPSOLVER_API_KEY=CAP-2540716108BC4D181465BF715D674904421D53CB7CE512D511EC80DEDB3744DD"
```

---

## 🚨 If DECODO_API_KEY is Missing

Set it for proxy rotation:

```bash
# For Scrapegoat Service
cd scrapegoat
railway service  # Select "scrapegoat"
railway variables --set "DECODO_API_KEY=your-decodo-key"

# For Scrapegoat Worker Service
railway service  # Select "scrapegoat-worker"
railway variables --set "DECODO_API_KEY=your-decodo-key"
```

---

## ✅ Verification Checklist

After checking, mark these:

- [ ] BrainScraper: REDIS_URL, RAPIDAPI_KEY set
- [ ] Scrapegoat: DATABASE_URL, REDIS_URL set
- [ ] Scrapegoat: CAPSOLVER_API_KEY set ⭐
- [ ] Scrapegoat: DECODO_API_KEY set
- [ ] Scrapegoat Worker: CAPSOLVER_API_KEY set ⭐ **CRITICAL**
- [ ] Scrapegoat Worker: DECODO_API_KEY set
- [ ] All shared variables use `${{...}}` syntax

---

## 📋 Complete Variable Reference

See `RAILWAY_VARS_CHECKLIST.md` for the complete list of all variables.
