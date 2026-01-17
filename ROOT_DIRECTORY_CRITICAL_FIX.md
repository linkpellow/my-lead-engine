# Root Directory Critical Fix - Config-as-Code Override

## 🔴 Confirmed: Config-as-Code Overrides Dashboard

**Railway's Priority:**
1. **Config-as-Code** (railway.toml files) - **HIGHEST PRIORITY** ⚠️
2. Dashboard Settings - Lower priority (overridden by config files)
3. Auto-detection - Lowest priority

**Current Problem:**
- `scrapegoat-worker-swarm` is reading from `chimera-core/railway.toml` (has `startCommand = "python3 main.py"`)
- Root Directory is likely wrong, causing Railway to find wrong `railway.toml` first
- Config-as-code takes precedence, so Dashboard cannot override

---

## ✅ Solution: Fix Root Directory in Dashboard

**Railway CLI cannot set Root Directory.** This MUST be done in Railway Dashboard.

**Railway Dashboard → scrapegoat-worker-swarm → Settings → General:**

1. **Root Directory:**
   - **Current:** Likely empty, `chimera-core`, or project root
   - **Set to:** `scrapegoat` (exactly this, no leading slash, no trailing slash)
   - **Save**

**Why This Fixes It:**
- Root Directory determines which `railway.toml` Railway reads
- If Root Directory = `scrapegoat`, Railway reads `scrapegoat/railway.toml`
- If Root Directory = `chimera-core`, Railway reads `chimera-core/railway.toml` ❌
- If Root Directory = empty/root, Railway may find wrong file first ❌

---

## 📋 Configuration Files Status

### scrapegoat/railway.toml
```toml
[deploy]
# startCommand removed - set per-service in Dashboard
```

**Status:** ✅ Correct - no startCommand, allows Dashboard override

### chimera-core/railway.toml
```toml
[deploy]
startCommand = "python3 main.py"  # For Chimera Core
```

**Status:** ✅ Correct for chimera-core, but being read by wrong service

**Issue:** Railway is reading this file for `scrapegoat-worker-swarm` because Root Directory is wrong.

---

## 🎯 Why Root Directory Matters

**Railway's File Resolution:**
1. Railway sets build context to Root Directory
2. Railway looks for `railway.toml` in that directory
3. If found, Railway uses it (config-as-code)
4. Config-as-code **overrides** Dashboard settings

**Current Behavior:**
- Root Directory = wrong (likely `chimera-core` or empty)
- Railway finds `chimera-core/railway.toml` first
- Railway uses `startCommand = "python3 main.py"` from that file
- Dashboard Start Command is **ignored** (overridden by config-as-code)

**After Fix:**
- Root Directory = `scrapegoat`
- Railway finds `scrapegoat/railway.toml` (no startCommand)
- Railway uses Dashboard Start Command (`python start_redis_worker.py`)
- Service runs correct code ✅

---

## ✅ Complete Fix Checklist

**Railway Dashboard → scrapegoat-worker-swarm → Settings:**

1. **General → Root Directory:**
   - [ ] Set to: `scrapegoat`
   - [ ] **Save**

2. **Deploy → Start Command:**
   - [ ] Set to: `python start_redis_worker.py`
   - [ ] **Save**

3. **Build → Watch Paths:**
   - [ ] Set to: `scrapegoat/**`
   - [ ] **Save**

4. **Variables:** (Already fixed ✅)
   - [x] `REDIS_URL` = `redis://redis.railway.internal:6379`
   - [x] `APP_REDIS_URL` = `redis://redis.railway.internal:6379`

---

## 🔍 Verification

**After Root Directory fix, Railway should:**
- Read from `scrapegoat/railway.toml` (not `chimera-core/railway.toml`)
- Use Dashboard Start Command (because `scrapegoat/railway.toml` has no startCommand)
- Run `python start_redis_worker.py` (correct worker entry point)

**Check Logs:**
```bash
railway logs --service scrapegoat-worker-swarm --tail 30
```

**Expected:**
```
🚀 SCRAPEGOAT TRI-CORE SYSTEM
✅ All Systems Operational: [Factory] [Driver] [Keymaster]
```

**NOT:**
```
🦾 Chimera Core - The Body - Starting...
```

---

## 📝 Why CLI Cannot Fix This

**Railway CLI Limitations:**
- ❌ Cannot set Root Directory (Dashboard-only setting)
- ❌ Cannot override config-as-code startCommand
- ❌ Cannot force Railway to read different railway.toml file

**Dashboard Required:**
- ✅ Only way to set Root Directory
- ✅ Only way to override config-as-code (if railway.toml has no startCommand)

---

## ✅ Summary

**Issue:** Config-as-code override - Railway reading wrong railway.toml

**Root Cause:** Wrong Root Directory causing Railway to find `chimera-core/railway.toml` first

**Fix:** Set Root Directory to `scrapegoat` in Dashboard (CLI cannot do this)

**Status:**
- ✅ `scrapegoat/railway.toml` is correct (no startCommand, allows Dashboard override)
- ✅ Redis variables fixed
- ❌ Root Directory needs Dashboard fix (URGENT - this is the blocker)
- ❌ Start Command needs Dashboard fix (after Root Directory is fixed)

**Next Step:** Fix Root Directory in Railway Dashboard → scrapegoat-worker-swarm → Settings → General → Root Directory = `scrapegoat`
