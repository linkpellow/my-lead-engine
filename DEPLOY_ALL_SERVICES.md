# Deploy All Services - Quick Guide

## 🚀 Current Status
- ✅ **Postgres**: Online
- ✅ **Redis**: Online  
- ❌ **brainscraper**: Build failed (2 minutes ago)
- ❌ **scrapegoat**: Build failed (1 hour ago)
- ❌ **scrapegoat-worker**: Build failed (1 hour ago)

## 📋 Deploy All Services via Railway Dashboard

### Step 1: Deploy BrainScraper
1. Go to Railway Dashboard: https://railway.com/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
2. Click on **`brainscraper`** service
3. Go to **Deployments** tab
4. Click **"Redeploy"** on the latest deployment
   - OR click **"New Deployment"** → **"Deploy Latest Commit"**
5. Verify **Root Directory** is set to `brainscraper`:
   - Settings → General → Root Directory: `brainscraper`

### Step 2: Deploy Scrapegoat
1. Click on **`scrapegoat`** service
2. Go to **Deployments** tab
3. Click **"Redeploy"** on the latest deployment
   - OR click **"New Deployment"** → **"Deploy Latest Commit"**
4. Verify **Root Directory** is set to `scrapegoat`:
   - Settings → General → Root Directory: `scrapegoat`

### Step 3: Deploy Scrapegoat Worker
1. Click on **`scrapegoat-worker-sw...`** service (the one with 5 replicas)
2. Go to **Deployments** tab
3. Click **"Redeploy"** on the latest deployment
   - OR click **"New Deployment"** → **"Deploy Latest Commit"**
4. Verify **Root Directory** is set to `scrapegoat`:
   - Settings → General → Root Directory: `scrapegoat`
5. Verify **Start Command** is set:
   - Settings → Deploy → Start Command: `python start_redis_worker.py`

## 🔍 Verify Configuration

### BrainScraper Settings
- **Root Directory**: `brainscraper`
- **Watch Paths**: `brainscraper/**` (optional)
- **Start Command**: `npm start`
- **Port**: `3000`

### Scrapegoat Settings
- **Root Directory**: `scrapegoat`
- **Watch Paths**: `scrapegoat/**` (optional)
- **Start Command**: (from `railway.toml`)
- **Port**: `8000`

### Scrapegoat Worker Settings
- **Root Directory**: `scrapegoat`
- **Watch Paths**: `scrapegoat/**` (optional)
- **Start Command**: `python start_redis_worker.py`
- **Port**: (not needed for worker)

## ✅ Latest Fixes Applied
- ✅ `brainscraper/package-lock.json` updated with `ioredis@5.9.2`
- ✅ `scrapegoat/runtime.txt` updated to `python-3.11.0`
- ✅ All changes committed and pushed to GitHub

## 🐛 If Builds Still Fail

### Check Build Logs
1. Click on each service
2. Go to **Deployments** tab
3. Click on the failed deployment
4. Check **Build Logs** for errors

### Common Issues
1. **Root Directory not set**: Must be `brainscraper` or `scrapegoat`
2. **Python version mismatch**: Should be 3.11.0 (already fixed)
3. **Missing dependencies**: Check `requirements.txt` and `package.json`
4. **Environment variables**: Ensure all required vars are set

## 🚀 Quick CLI Alternative

If you prefer CLI (from project root):

```bash
# Deploy scrapegoat (already linked)
cd scrapegoat
railway redeploy --yes

# Deploy brainscraper (need to link first)
cd ../brainscraper
railway service link brainscraper  # Interactive - select brainscraper
railway redeploy --yes
```

**Note**: Worker service must be redeployed via Dashboard as service name may differ.
