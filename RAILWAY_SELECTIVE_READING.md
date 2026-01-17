# Railway's Selective Reading from railway.toml

## ✅ Confirmed: Railway IS Reading from Git

**Evidence:** Railway Dashboard shows "The value is set in **scrapegoat/railway.toml**" for build commands.

This confirms Railway **DOES read** `railway.toml` from Git, but **selectively** - some fields work, others don't.

---

## What Works vs. What Doesn't (New Builder v2)

### ✅ WORKS (Read from railway.toml)
- `buildCommand` - ✅ Railway reads and uses this
- `builder = "NIXPACKS"` - ✅ Railway respects this
- `startCommand` - ✅ Railway reads this (but Dashboard can override)
- `healthcheckPath` - ✅ Railway reads this
- `healthcheckTimeout` - ✅ Railway reads this
- `restartPolicyType` - ✅ Railway reads this
- `[env]` variables - ✅ Railway reads these

### ❌ DOESN'T WORK (Ignored by New Builder)
- `watchPatterns` - ❌ **IGNORED** by new builder v2
- Watch path detection - ❌ **BROKEN** in new builder
- Conditional deployments based on file changes - ❌ **NOT SUPPORTED**

---

## Why This Happens

**Railway's New Builder (v2) is unmaintained and has incomplete feature support:**

1. **Selective Field Reading:**
   - New builder reads most `railway.toml` fields ✅
   - But specifically ignores `watchPatterns` ❌
   - This is a known bug/limitation, not a configuration error

2. **Watch Paths Require Dashboard:**
   - `watchPatterns` in `railway.toml` = Ignored by new builder
   - Watch Paths in Dashboard = Works with new builder
   - This is why Dashboard configuration is required

3. **Legacy Builder Works:**
   - If you use legacy builder, `watchPatterns` in `railway.toml` work ✅
   - But new builder is often auto-selected by Railway

---

## Current Status

**scrapegoat/railway.toml:**
```toml
[build]
builder = "NIXPACKS"
buildCommand = "pip install -r requirements.txt && playwright install chromium"  # ✅ READ BY RAILWAY
watchPatterns = ["scrapegoat/**"]  # ❌ IGNORED BY NEW BUILDER

[deploy]
startCommand = "python3 main.py"  # ✅ READ BY RAILWAY (but Dashboard can override)
healthcheckPath = "/health"  # ✅ READ BY RAILWAY
```

**Railway Dashboard:**
- Build Command: Shows "set in scrapegoat/railway.toml" ✅
- Watch Paths: **MUST be set in Dashboard** (not read from railway.toml) ❌

---

## Solution

### Option 1: Use Dashboard for Watch Paths (RECOMMENDED)
1. Railway Dashboard → Service → Settings → Build
2. **Watch Paths:** Set to `scrapegoat/**` (or `**` temporarily)
3. Save

**Why:** Dashboard settings work with new builder, `railway.toml` doesn't.

### Option 2: Switch to Legacy Builder
1. Railway Dashboard → Service → Settings → Build
2. Look for "Use New Builder" toggle
3. **Disable** new builder (use legacy)
4. Save

**Why:** Legacy builder reads `watchPatterns` from `railway.toml` ✅

---

## Summary

**You're correct:** Railway IS reading from Git (`buildCommand` works).

**But:** Railway's new builder selectively ignores `watchPatterns` from `railway.toml`.

**Fix:** Set Watch Paths in Railway Dashboard (they work with new builder) OR switch to legacy builder (watchPatterns in toml work).

---

## References

- Railway Station: [watch-paths-are-ignored](https://station.railway.com/questions/watch-paths-are-ignored-82e84cb5)
- Railway Station: [watchpath-is-ignored](https://station.railway.com/questions/watchpath-is-ignored-c152ced3)
- Railway Station: [building-even-with-watch-paths-configured](https://station.railway.com/questions/building-even-with-watch-paths-configured-b141e73e)
