# Railway CLI Recovery - chimera-core Python Migration

## ✅ Changes Made

1. **Deleted:** `chimera-core/Dockerfile` (Rust Dockerfile removed)
2. **Updated:** `chimera-core/railway.toml` (switched to Nixpacks, Python 3.12 config)

## 🚨 Railway CLI Commands to Run

**Note:** Railway CLI requires authentication. Run these commands after `railway login`.

### Step 1: Link to Project (if not already linked)
```bash
cd /Users/linkpellow/Desktop/my-lead-engine
railway link
```

### Step 2: Select chimera-core Service
```bash
railway service
# Select: chimera-core
```

### Step 3: Clear Dockerfile Path Setting
```bash
# Check current settings
railway variables

# If dockerfile-path exists, remove it via Railway Dashboard:
# Dashboard → chimera-core → Settings → Build → Clear "Dockerfile Path"
```

### Step 4: Verify Build Settings
```bash
# Check service configuration
railway service

# Verify root directory is set to: chimera-core
# Verify builder is: Nixpacks (not Dockerfile)
```

### Step 5: Test Nixpacks Build Locally
```bash
cd chimera-core
railway run nixpacks build .
```

### Step 6: Commit and Push Changes
```bash
cd /Users/linkpellow/Desktop/my-lead-engine
git add .
git commit -m "CLI FIX: Purge Rust and restore Nixpacks for chimera-core"
git push origin main
```

## ⚠️ Important Notes

1. **Python Entry Point Missing:** The `chimera-core/railway.toml` has a commented `startCommand`. You'll need to:
   - Create a Python entry point (e.g., `main.py` or `worker.py`)
   - Update `startCommand` in `railway.toml` to: `python main.py`

2. **Railway Dashboard Alternative:** If CLI doesn't work, use Railway Dashboard:
   - Go to: Railway Dashboard → chimera-core → Settings
   - Build Settings:
     - Builder: **Nixpacks** (not Dockerfile)
     - Root Directory: **chimera-core**
     - Dockerfile Path: **Leave empty/clear**
   - Deploy Settings:
     - Start Command: **python main.py** (after creating entry point)

3. **Service Status:** After clearing Dockerfile settings, Railway will automatically rebuild using Nixpacks when you push to main.

## 📋 Current Configuration

**chimera-core/railway.toml:**
```toml
[build]
# Using Nixpacks (default) - Python 3.12 project

[deploy]
# TODO: Update startCommand when Python entry point is created
# startCommand = "python main.py"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[env]
PYTHONUNBUFFERED = "1"
RAILWAY_ENVIRONMENT = "production"
CHIMERA_BRAIN_ADDRESS = "http://chimera-brain.railway.internal:50051"
```

## 🎯 Next Steps

1. Run Railway CLI commands above to clear Dockerfile settings
2. Create Python entry point in `chimera-core/` (e.g., `main.py`)
3. Update `startCommand` in `railway.toml`
4. Test build locally with `railway run nixpacks build .`
5. Commit and push changes
6. Monitor Railway deployment logs
