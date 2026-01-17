# Config-as-Code Fix - Railway.toml Override Issue

## 🔴 Root Cause Confirmed

**Problem:** Railway's config-as-code (railway.toml files) **overrides Dashboard settings**.

**Current Issue:**
- `scrapegoat-worker-swarm` is reading from `chimera-core/railway.toml` (has `startCommand = "python3 main.py"`)
- Service Root Directory is likely wrong, causing Railway to find wrong `railway.toml` first
- Config-as-code takes precedence over Dashboard settings

**Evidence:**
- Logs show Chimera Core code running
- Service context shows project root (`/Users/linkpellow/Desktop/my-lead-engine`)
- Railway is finding `chimera-core/railway.toml` before `scrapegoat/railway.toml`

---

## ✅ Solution: Fix Root Directory

**Railway CLI cannot set Root Directory.** This MUST be done in Dashboard.

**Railway Dashboard → scrapegoat-worker-swarm → Settings → General:**

1. **Root Directory:**
   - **Current:** Likely empty, `chimera-core`, or project root
   - **Set to:** `scrapegoat` (exactly this, no leading slash)
   - **Save**

**Why:** Root Directory determines which `railway.toml` Railway reads. If wrong, Railway finds wrong config file.

---

## 📋 Configuration Files Status

### scrapegoat/railway.toml
```toml
[build]
builder = "NIXPACKS"
buildCommand = "pip install -r requirements.txt && playwright install chromium"

[deploy]
# startCommand removed - set per-service in Dashboard
healthcheckPath = "/health"
```

**Status:** ✅ Correct - startCommand removed to allow Dashboard override

### chimera-core/railway.toml
```toml
[deploy]
startCommand = "python3 main.py"  # For Chimera Core
```

**Status:** ✅ Correct for chimera-core, but being read by wrong service

### scrapegoat/railway.worker.toml
```toml
[deploy]
startCommand = "python start_redis_worker.py"  # For worker
```

**Status:** ⚠️ Railway may not auto-detect this file (only reads `railway.toml`)

---

## 🎯 Why Config-as-Code Overrides Dashboard

**Railway's Priority Order:**
1. **Config-as-Code** (railway.toml files) - Highest priority
2. **Dashboard Settings** - Lower priority (overridden by config files)
3. **Auto-detection** - Lowest priority

**Implication:**
- If `railway.toml` has `startCommand`, Dashboard cannot override it
- Root Directory determines which `railway.toml` Railway reads
- Wrong Root Directory = wrong `railway.toml` = wrong start command

---

## ✅ Complete Fix

### Step 1: Fix Root Directory (Dashboard)

**Railway Dashboard → scrapegoat-worker-swarm → Settings → General:**
- **Root Directory:** `scrapegoat`
- **Save**

### Step 2: Set Start Command (Dashboard)

**Railway Dashboard → scrapegoat-worker-swarm → Settings → Deploy:**
- **Start Command:** `python start_redis_worker.py`
- **Save**

**Why Dashboard:** Even though config-as-code overrides, Dashboard can set it if `scrapegoat/railway.toml` doesn't have `startCommand` (which it doesn't).

### Step 3: Verify Context

After fix, Railway should:
- Read from `scrapegoat/railway.toml` (because Root Directory = `scrapegoat`)
- Use Dashboard Start Command (because `scrapegoat/railway.toml` doesn't have `startCommand`)
- NOT read from `chimera-core/railway.toml` (because Root Directory is `scrapegoat`)

---

## 🔍 Verification

**Check Build Context:**
```bash
railway run --service scrapegoat-worker-swarm pwd
# Should show: /app (or similar, not project root)
```

**Check Files:**
```bash
railway run --service scrapegoat-worker-swarm ls -la
# Should show scrapegoat/ files, not project root files
```

**Check Logs:**
```bash
railway logs --service scrapegoat-worker-swarm --tail 30
# Should show: 🚀 SCRAPEGOAT TRI-CORE SYSTEM
# NOT: 🦾 Chimera Core
```

---

## 📝 Alternative: Add startCommand to scrapegoat/railway.toml

**If Dashboard doesn't work**, we could add `startCommand` to `scrapegoat/railway.toml`:

```toml
[deploy]
startCommand = "python start_redis_worker.py"  # For worker
```

**But:** This would break `scrapegoat` (main) service which needs `python3 main.py`.

**Better Solution:** Keep `startCommand` removed from `scrapegoat/railway.toml` and set it per-service in Dashboard.

---

## ✅ Summary

**Issue:** Config-as-code override - Railway reading wrong railway.toml

**Root Cause:** Wrong Root Directory causing Railway to find `chimera-core/railway.toml` first

**Fix:** Set Root Directory to `scrapegoat` in Dashboard (CLI cannot do this)

**Status:**
- ✅ `scrapegoat/railway.toml` is correct (no startCommand)
- ❌ Root Directory needs Dashboard fix (URGENT)
- ❌ Start Command needs Dashboard fix (URGENT)

**Next Step:** Fix Root Directory in Railway Dashboard → scrapegoat-worker-swarm → Settings → General
