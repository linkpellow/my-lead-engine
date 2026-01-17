# Final Dashboard Fix Checklist - scrapegoat-worker-swarm

## 🎯 Complete Fix Required

All fixes must be done in **Railway Dashboard** - CLI cannot set these per-service settings.

---

## ✅ Checklist

### 1. Root Directory (CRITICAL)

**Railway Dashboard → scrapegoat-worker-swarm → Settings → General:**

- [ ] **Root Directory:** Set to `scrapegoat` (NOT `chimera-core`, NOT empty, NOT `/`)
- [ ] **Save**

**Why:** Determines which `railway.toml` Railway reads. Wrong directory = wrong config.

---

### 2. Start Command (CRITICAL)

**Railway Dashboard → scrapegoat-worker-swarm → Settings → Deploy:**

- [ ] **Start Command:** Set to `python start_redis_worker.py`
- [ ] **NOT:** `python3 main.py` (this is for chimera-core)
- [ ] **NOT:** `python main.py` (this is for scrapegoat main service)
- [ ] **Save**

**Why:** This is the correct entry point for the Scrapegoat worker loop.

---

### 3. Watch Paths (For Auto-Deploys)

**Railway Dashboard → scrapegoat-worker-swarm → Settings → Build:**

- [ ] **Watch Paths:** Set to `scrapegoat/**`
- [ ] **Save**

**Why:** Prevents "Skipped" deployments. v2 builder ignores railway.toml watchPatterns.

---

### 4. Redis Variables (Already Fixed ✅)

**Railway Dashboard → scrapegoat-worker-swarm → Settings → Variables:**

- [x] `REDIS_URL` = `redis://redis.railway.internal:6379` ✅
- [x] `APP_REDIS_URL` = `redis://redis.railway.internal:6379` ✅
- [x] `PYTHONUNBUFFERED` = `1` ✅

**Status:** Already fixed via CLI ✅

---

## 🔍 Verification After Fix

### 1. Check Logs

```bash
railway logs --service scrapegoat-worker-swarm --tail 30
```

**Expected:**
```
🚀 SCRAPEGOAT TRI-CORE SYSTEM
✅ All Systems Operational: [Factory] [Driver] [Keymaster]
🏭 Starting Enrichment Factory...
```

**NOT:**
```
🦾 Chimera Core - The Body - Starting...
```

---

### 2. Check Service Status

**Railway Dashboard → scrapegoat-worker-swarm → Deployments:**
- ✅ Should show "Success" (green)
- ✅ Service should be "Running"

---

## 📝 Summary

**What's Fixed:**
- ✅ Redis variables (via CLI)

**What Needs Dashboard Fix:**
- ❌ Root Directory (must be `scrapegoat`)
- ❌ Start Command (must be `python start_redis_worker.py`)
- ❌ Watch Paths (must be `scrapegoat/**`)

**Why Dashboard Only:**
- Railway CLI cannot set per-service Root Directory
- Railway CLI cannot set per-service Start Command
- These are Dashboard-only settings

**Next Step:** Go to Railway Dashboard and complete the checklist above.
