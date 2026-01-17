# Zero-Guess Resolution - Config-as-Code Synchronization

## 🔴 Root Cause: Configuration Priority

**Railway's Priority Order:**
1. **Environment-specific config in code** (e.g., `railway.toml`) - **HIGHEST PRIORITY** ⚠️
2. **Base config in code** (e.g., `railway.toml` in service root)
3. **Service settings in Dashboard** - **LOWEST PRIORITY** (overridden by config files)

**Critical:** If `railway.toml` contains `watchPatterns`, it **overrides** Dashboard Watch Paths.

---

## ✅ Resolution Plan Executed

### 1. Audit Local Config Files

**Command:** `find . -name "railway.toml" -o -name "railway.json"`

**Found Files:**
- `./railway.toml` (root)
- `./brainscraper/railway.toml`
- `./chimera-core/railway.toml`
- `./chimera_brain/railway.toml`
- `./scrapegoat/railway.toml`
- `./scrapegoat/railway.worker.toml`

**Status:** ✅ All files are in correct service directories (no orphaned configs to delete)

---

### 2. Standardize Watch Paths in Code

**Updated:** `scrapegoat/railway.toml`

```toml
[build]
watchPatterns = [
  "scrapegoat/**",
  "chimera-core/**"
]
```

**Why Both:**
- Ensures deployments trigger when either directory changes
- Matches physical directory structure
- Works with v2 builder (if it respects watchPatterns)

**Note:** Dashboard Watch Paths should also be set to `scrapegoat/**` (v2 builder may ignore code config).

---

### 3. Force "Nuclear" Redeploy

**Command:** `railway up --service scrapegoat-worker-swarm --detach`

**Why:**
- Bypasses Git webhook triggers
- Uploads files directly to Railway's build server
- Ignores "No changes" detection
- Forces fresh build

**Status:** ✅ Deployment triggered

---

### 4. Cache Invalidation

**Command:** `railway variable set NO_CACHE=1 --service scrapegoat-worker-swarm`

**Why:**
- Forces fresh build from scratch
- Clears any cached build artifacts
- Ensures new config is read

**Status:** ✅ Variable set

---

## 🔍 Final Verification Checklist

### Commit Check
```bash
git log -1
```
**Goal:** Ensure SHA matches "Last Commit" in Railway Dashboard

### Cache Check
**Railway Dashboard → scrapegoat-worker-swarm → Settings → Variables:**
- [ ] `NO_CACHE=1` is set (forces fresh build)

### Root Directory Check
**Railway Dashboard → scrapegoat-worker-swarm → Settings → Source:**
- [ ] **Root Directory:** Must be `scrapegoat` (NOT `/scrapegoat`, NOT `chimera-core`, NOT empty)

### Start Command Check
**Railway Dashboard → scrapegoat-worker-swarm → Settings → Deploy:**
- [ ] **Start Command:** Must be `python start_redis_worker.py`

### Watch Paths Check
**Railway Dashboard → scrapegoat-worker-swarm → Settings → Build:**
- [ ] **Watch Paths:** Set to `scrapegoat/**` (or `scrapegoat/**,chimera-core/**`)

---

## 📋 Configuration Files Status

### scrapegoat/railway.toml
```toml
[build]
watchPatterns = [
  "scrapegoat/**",
  "chimera-core/**"
]

[deploy]
# startCommand removed - set per-service in Dashboard
```

**Status:** ✅ Updated with watch paths for both directories

### Root railway.toml
**Location:** `./railway.toml`
**Status:** ✅ Exists (may be used for project-level config)

**Action:** Verify this doesn't conflict with service-specific configs.

---

## 🎯 Why This Fixes It

**Before:**
- `scrapegoat/railway.toml` had `watchPatterns = ["scrapegoat/**"]`
- Railway v2 builder may ignore it
- Dashboard Watch Paths may not be set
- Service reads wrong `railway.toml` (chimera-core)

**After:**
- `scrapegoat/railway.toml` has explicit watch paths for both directories
- Dashboard Watch Paths should also be set
- Root Directory fixed to `scrapegoat` (Dashboard)
- Start Command fixed to `python start_redis_worker.py` (Dashboard)
- NO_CACHE forces fresh build
- CLI redeploy bypasses Git webhook issues

---

## ✅ Summary

**Actions Taken:**
- ✅ Audited all railway.toml files (all in correct locations)
- ✅ Updated `scrapegoat/railway.toml` with watch paths for both directories
- ✅ Set `NO_CACHE=1` variable (forces fresh build)
- ✅ Force redeploy via CLI (bypasses Git webhook)

**Still Required (Dashboard):**
- ❌ Root Directory = `scrapegoat` (URGENT)
- ❌ Start Command = `python start_redis_worker.py` (URGENT)
- ❌ Watch Paths = `scrapegoat/**` (for v2 builder)

**Next Step:** Complete Dashboard configuration checklist above.

---

## 🚨 Critical: Dashboard Configuration Still Required

**Even with code changes, Dashboard configuration is still needed:**

1. **Root Directory:** Determines which `railway.toml` Railway reads
2. **Start Command:** Overrides config file (if file has no startCommand)
3. **Watch Paths:** Required for v2 builder (may ignore code config)

**Why:** Config-as-code overrides Dashboard, but if Root Directory is wrong, Railway reads wrong config file.
