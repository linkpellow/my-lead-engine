# 🚨 CRITICAL: Watch Paths Must Be Set in Railway Dashboard

## The Problem

Railway keeps saying **"No changes to watched files"** for `scrapegoat-worker-swarm` even though we've:
- ✅ Modified `scrapegoat/start_redis_worker.py`
- ✅ Modified `scrapegoat/railway.toml` multiple times
- ✅ Created `scrapegoat/.railway_trigger` file
- ✅ Added `watchPatterns = ["**"]` to railway.toml

## Why This Happens

**Railway's NEW Builder (v2) IGNORES `watchPatterns` in railway.toml!**

This is a documented limitation:
- Legacy builder: Supports `watchPatterns` in railway.toml ✅
- New builder: Ignores `watchPatterns` in railway.toml ❌
- New builder: Requires watch paths in Dashboard ✅

## The Solution (Dashboard Only)

**Railway CLI cannot set watch paths.** They MUST be configured in the Railway Dashboard.

### Step-by-Step Fix

1. **Go to Railway Dashboard:**
   - https://railway.com/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
   - Click on **scrapegoat-worker-swarm** service

2. **Set Watch Paths:**
   - Settings → **Build** → **Watch Paths**
   - **Set to:** `**` (temporarily to catch all changes)
   - **Or:** `scrapegoat/**` (permanent, only watch scrapegoat directory)
   - **Click Save**

3. **Verify Root Directory:**
   - Settings → **General** → **Root Directory**
   - **Should be:** `scrapegoat` (not empty, not `/`)
   - If wrong, fix it and **Save**

4. **Verify Start Command:**
   - Settings → **Deploy** → **Start Command**
   - **Should be:** `python start_redis_worker.py` (not `python3 main.py`)
   - If wrong, fix it and **Save**

## Why Code Changes Don't Work

Even though we've modified files in `scrapegoat/`:
- `scrapegoat/start_redis_worker.py` ✅ Modified
- `scrapegoat/railway.toml` ✅ Modified  
- `scrapegoat/.railway_trigger` ✅ Created

Railway still says "No changes to watched files" because:
- **Watch paths in Dashboard are empty or wrong**
- **New builder ignores watchPatterns in railway.toml**
- **Railway evaluates watch paths from Dashboard, not config files**

## Verification

After setting watch paths in Dashboard:
1. Make any change to a file in `scrapegoat/`
2. Commit and push
3. Check Railway Dashboard → Deployments
4. Should show **"Building..."** not **"Skipped"**

## Files We've Changed (For Reference)

Recent commits that changed `scrapegoat/` files:
- `f0aa21a` - Modified `scrapegoat/start_redis_worker.py`
- `9a1e3f0` - Created `scrapegoat/.railway_trigger`
- `3acdb78` - Modified `scrapegoat/railway.toml`
- `2002715` - Modified `scrapegoat/railway.toml`
- `8b10332` - Modified `scrapegoat/railway.toml`

**All of these should have triggered deployments, but were skipped because watch paths aren't set in Dashboard.**

## Summary

**The Issue:** Watch paths are not configured in Railway Dashboard.

**The Fix:** Set watch paths in Dashboard (cannot be done via CLI or config files).

**Why It Keeps Happening:** Railway's new builder ignores `watchPatterns` in railway.toml, so Dashboard configuration is required.

**Next Step:** Go to Railway Dashboard and set watch paths for scrapegoat-worker-swarm service.
