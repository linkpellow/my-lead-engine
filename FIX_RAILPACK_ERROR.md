# Fix: Railpack Error - Monorepo Configuration

## 🔴 Problem

**Error**: `✖ Railpack could not determine how to build the app`

**Cause**: Railway's auto-detection sees multiple application folders (`brainscraper/` and `scrapegoat/`) at the root and doesn't know which to build.

## ✅ Solution: Configure Root Directories

Railway CLI doesn't support setting root directories directly. You must configure this via the **Railway Dashboard**.

## 🚀 Step-by-Step Fix

### Step 1: Fix Existing BrainScraper Service

1. **Go to Railway Dashboard**
   - https://railway.com/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
   - Click on **BrainScraper** service

2. **Set Root Directory**
   - Go to **Settings** → **General**
   - Find **"Root Directory"** field
   - Set to: `brainscraper`
   - Click **"Save"**

3. **Configure Watch Paths** (Optional but recommended)
   - In same Settings → General
   - Find **"Watch Paths"** or **"Ignore Paths"**
   - Set to: `brainscraper/**`
   - This ensures only changes in `brainscraper/` trigger rebuilds

### Step 2: Create Scrapegoat Service (if not exists)

1. **In Railway Dashboard**
   - Click **"New"** → **"GitHub Repo"**
   - Select: `linkpellow/scrapeshifter`
   - Service will be created

2. **Set Root Directory**
   - Go to **Settings** → **General**
   - Set **"Root Directory"** to: `scrapegoat`
   - Click **"Save"**

3. **Configure Watch Paths**
   - Set **"Watch Paths"** to: `scrapegoat/**`
   - This ensures only changes in `scrapegoat/` trigger rebuilds

4. **Set Start Command** (if needed)
   - Go to **Settings** → **Deploy**
   - **Start Command**: Leave default (Railway will detect from `railway.toml`)

### Step 3: Create Scrapegoat Worker Service

1. **In Railway Dashboard**
   - Click **"New"** → **"GitHub Repo"**
   - Select: `linkpellow/scrapeshifter`
   - Name it: `scrapegoat-worker`

2. **Set Root Directory**
   - **Settings** → **General** → **"Root Directory"**: `scrapegoat`

3. **Set Watch Paths**
   - **Watch Paths**: `scrapegoat/**`

4. **Set Start Command**
   - **Settings** → **Deploy** → **Start Command**: `python start_redis_worker.py`

### Step 4: Verify Configuration

After setting root directories, Railway should:
- ✅ Detect Next.js in `brainscraper/` folder
- ✅ Detect Python/FastAPI in `scrapegoat/` folder
- ✅ Build each service independently
- ✅ Only rebuild when files in respective folders change

## 📋 Configuration Checklist

### BrainScraper Service
- [ ] Root Directory: `brainscraper`
- [ ] Watch Paths: `brainscraper/**`
- [ ] Port: `3000` (from environment variable)
- [ ] Build Command: Auto-detected (or `npm run build`)
- [ ] Start Command: Auto-detected (or `npm start`)

### Scrapegoat Service
- [ ] Root Directory: `scrapegoat`
- [ ] Watch Paths: `scrapegoat/**`
- [ ] Port: `8000` (from Railway or environment)
- [ ] Build Command: Auto-detected (or from `railway.toml`)
- [ ] Start Command: Auto-detected (or from `railway.toml`)

### Scrapegoat Worker Service
- [ ] Root Directory: `scrapegoat`
- [ ] Watch Paths: `scrapegoat/**`
- [ ] Start Command: `python start_redis_worker.py`
- [ ] Scaling: 5 replicas (Settings → Scaling)

## 🔧 Alternative: Railway Configuration Files

You can also configure root directories using Railway's configuration. However, the dashboard method above is more reliable.

### Using `railway.json` (if supported)

Create/update `railway.json` in each service directory:

**`brainscraper/railway.json`:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "rootDirectory": "brainscraper"
}
```

**Note**: Root directory in `railway.json` may not be supported. Use dashboard method instead.

## 🚨 Important Notes

### Why Root Directory is Required

Without root directories:
- Railway sees both `package.json` (Node.js) and `requirements.txt` (Python) at root
- Railway sees both `brainscraper/` and `scrapegoat/` folders
- Railpack can't determine which builder to use
- Build fails with "could not determine how to build" error

With root directories:
- Each service knows exactly which folder to build
- Railway uses correct builder (Nixpacks for Node.js, Nixpacks for Python)
- Services build independently
- Watch paths prevent unnecessary rebuilds

### Watch Paths Benefits

Setting watch paths ensures:
- Changes to `scrapegoat/` don't trigger `brainscraper` rebuilds
- Changes to `brainscraper/` don't trigger `scrapegoat` rebuilds
- Faster deployments (only affected service rebuilds)
- Lower build costs

## ✅ Verification

After configuration:

1. **Trigger a deployment** (push to GitHub or manual deploy)
2. **Check build logs** - should show:
   - BrainScraper: Building Next.js app from `brainscraper/`
   - Scrapegoat: Building Python app from `scrapegoat/`
3. **Verify services start** - check Railway logs
4. **Test endpoints** - verify services are accessible

## 🐛 Troubleshooting

### Still Getting Railpack Error

1. **Verify root directory is set correctly**
   - Check Settings → General → Root Directory
   - Must be exactly `brainscraper` or `scrapegoat` (no leading slash)

2. **Check service is linked to correct repo**
   - Settings → General → Source
   - Should be: `linkpellow/scrapeshifter`

3. **Verify build files exist**
   - `brainscraper/package.json` should exist
   - `scrapegoat/requirements.txt` should exist

4. **Clear build cache** (if needed)
   - Settings → Deploy → Clear Build Cache
   - Redeploy

### Service Not Detecting Correct Builder

1. **Check `railway.toml` or `railway.json`** in service directory
2. **Verify builder is specified**: `builder = "NIXPACKS"`
3. **Check for conflicting config files** at root level

## 📚 Reference

- Railway Monorepo Guide: https://docs.railway.com/guides/monorepos
- Railway Build Configuration: https://docs.railway.com/develop/builds
- Project Dashboard: https://railway.com/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
