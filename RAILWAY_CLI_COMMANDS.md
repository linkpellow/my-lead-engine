# Railway CLI Commands - chimera-core Recovery

## ✅ Files Prepared

1. **Created:** `chimera-core/main.py` - Python 3.12 entry point with healthcheck
2. **Created:** `chimera-core/requirements.txt` - Python dependencies (grpcio, protobuf)
3. **Updated:** `chimera-core/railway.toml` - Nixpacks config, startCommand set
4. **Deleted:** `chimera-core/Dockerfile` - Rust artifact removed
5. **Created:** `chimera-core/fix-railway.sh` - Automated recovery script

## 🚀 Run These Commands (In Your Terminal)

Since Railway CLI requires interactive prompts, run these commands manually in your terminal:

### Step 1: Navigate to chimera-core
```bash
cd /Users/linkpellow/Desktop/my-lead-engine/chimera-core
```

### Step 2: Link to chimera-core Service
```bash
railway link --service chimera-core
# When prompted, select your workspace and project
```

### Step 3: Clear Dockerfile Path (via Dashboard)
**Option A: Railway Dashboard (Recommended)**
1. Go to: https://railway.app/dashboard
2. Select your project → chimera-core service
3. Go to: Settings → Build
4. Clear/remove any "Dockerfile Path" setting
5. Ensure "Builder" is set to: **Nixpacks** (not Dockerfile)

**Option B: CLI (if variable exists)**
```bash
# Check if RAILWAY_DOCKERFILE_PATH exists
railway variables | grep DOCKERFILE

# If it exists, remove it (this may not work if it's a build setting, not a variable)
railway variables --unset RAILWAY_DOCKERFILE_PATH
```

### Step 4: Deploy (Nuclear Option - No Cache)
**Note:** Railway automatically detects `requirements.txt` and uses Nixpacks - no need to test build manually.
```bash
railway up --detach --service chimera-core
```

**Alternative (if above doesn't work):**
```bash
# Push to trigger fresh build
cd /Users/linkpellow/Desktop/my-lead-engine
git add .
git commit -m "CLI FIX: Purge Rust and restore Nixpacks for chimera-core"
git push origin main
```

### Step 6: Verify Deployment
```bash
# Check service status
railway status

# View logs
railway logs --service chimera-core --tail 50
```

**Expected Logs:**
```
🦾 Chimera Core - The Body - Starting...
   Version: Python 3.12
   Environment: production
   Brain Address: http://chimera-brain.railway.internal:50051
🏥 Health check server started on 0.0.0.0:8080
✅ Chimera Core worker started
```

## 🎯 Verification Checklist

After running commands, verify in Railway Dashboard:

- [ ] **Service:** chimera-core
- [ ] **Build Engine:** Nixpacks (NOT Dockerfile)
- [ ] **Root Directory:** chimera-core
- [ ] **Start Command:** `python main.py`
- [ ] **Status:** Active/Deployed
- [ ] **Health Check:** Passing (200 OK on /health)

## 📋 Current Configuration

**chimera-core/railway.toml:**
```toml
[build]
# Using Nixpacks (default) - Python 3.12 project

[deploy]
startCommand = "python main.py"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
healthcheckPath = "/health"
healthcheckTimeout = 300

[env]
PYTHONUNBUFFERED = "1"
RAILWAY_ENVIRONMENT = "production"
CHIMERA_BRAIN_ADDRESS = "http://chimera-brain.railway.internal:50051"
```

## 🚨 Troubleshooting

### "Dockerfile does not exist" Error
**Solution:** Clear Dockerfile path in Railway Dashboard:
- Dashboard → chimera-core → Settings → Build
- Remove any "Dockerfile Path" setting
- Ensure Builder = Nixpacks

### "No service linked" Error
**Solution:** Run `railway link --service chimera-core` and select workspace/project

### Build Still Using Dockerfile
**Solution:** 
1. Check Railway Dashboard build settings
2. Ensure no Dockerfile path is set
3. Force redeploy: `railway redeploy --service chimera-core`

### Health Check Failing
**Solution:** Verify main.py is running:
```bash
railway logs --service chimera-core --tail 20
# Should see: "🏥 Health check server started on 0.0.0.0:8080"
```

## ✅ Success Criteria

Your deployment is successful when:

1. ✅ Railway Dashboard shows: **Build Engine = Nixpacks**
2. ✅ Logs show: **"Using Nixpacks"** (not "Dockerfile")
3. ✅ Service status: **Active**
4. ✅ Health check: **200 OK** on `/health`
5. ✅ Logs show: **"Chimera Core worker started"**

## 📝 Quick Reference

**Files Created:**
- `chimera-core/main.py` - Python entry point
- `chimera-core/requirements.txt` - Dependencies
- `chimera-core/fix-railway.sh` - Recovery script

**Files Updated:**
- `chimera-core/railway.toml` - Nixpacks config

**Files Deleted:**
- `chimera-core/Dockerfile` - Rust artifact
