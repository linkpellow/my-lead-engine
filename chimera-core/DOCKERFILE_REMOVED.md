# ✅ Dockerfile Removed from Git - Nixpacks Forced

## Actions Completed

1. ✅ **Removed Dockerfile from git tracking:**
   ```bash
   git rm chimera-core/Dockerfile
   ```

2. ✅ **Committed changes:**
   ```bash
   git commit -m "FORCE NIXPACKS: Remove Dockerfile from git, add complete Python requirements"
   ```

3. ✅ **Pushed to main:**
   ```bash
   git push origin main
   ```

4. ✅ **Verified Dockerfile removed from git:**
   ```bash
   git ls-files chimera-core/ | grep -i docker
   # Returns: (empty - Dockerfile no longer tracked)
   ```

## Why This Fixes the Issue

**Railway's Internal Logic:**
- If a Dockerfile exists in the Root Directory (even in git), Railway uses it and ignores NIXPACKS config
- Railway pulls code from GitHub, so even if Dockerfile was deleted locally, it was still in the repository

**Solution:**
- Removed Dockerfile from git tracking (`git rm`)
- Committed and pushed the deletion
- Now Railway will pull code without Dockerfile
- Railway will automatically detect `requirements.txt` and use Nixpacks

## Verification

After Railway pulls the new code, check:

1. **Railway Dashboard:**
   - Service: chimera-core
   - Build Engine: Should show **Nixpacks** (not Dockerfile)
   - Build logs: Should show "Using Nixpacks" or "Detected Python project"

2. **Build Logs:**
   ```bash
   railway logs --service chimera-core --deployment --tail 100
   ```
   
   **Should see:**
   - ✅ "Using Nixpacks"
   - ✅ "Detected Python project"
   - ✅ "Installing dependencies from requirements.txt"
   - ✅ "playwright install chromium"
   
   **Should NOT see:**
   - ❌ "Dockerfile does not exist"
   - ❌ "Building Docker image"
   - ❌ Any Rust/Cargo references

3. **Runtime Logs:**
   ```bash
   railway logs --service chimera-core --tail 50
   ```
   
   **Should see:**
   - ✅ "🦾 Chimera Core - The Body - Starting..."
   - ✅ "Version: Python 3.12"
   - ✅ "🏥 Health check server started on 0.0.0.0:8080"
   
   **Should NOT see:**
   - ❌ "Version: 0.1.0" (Rust version)
   - ❌ "Worker ID: [uuid]" (Rust format)
   - ❌ "Testing stealth components" (Rust code)

## Current Configuration

**chimera-core/railway.toml:**
```toml
[build]
builder = "NIXPACKS"
buildCommand = "pip install -r requirements.txt && playwright install chromium"

[deploy]
startCommand = "python main.py"
healthcheckPath = "/health"
```

**chimera-core/requirements.txt:**
- Complete production dependencies (50+ lines)
- Includes: grpcio, playwright, Pillow, numpy, redis, loguru, etc.

**Git Status:**
- ✅ Dockerfile: **REMOVED** from git
- ✅ requirements.txt: **ADDED** to git
- ✅ main.py: **ADDED** to git
- ✅ railway.toml: **UPDATED** with NIXPACKS config

## Next Steps

1. **Wait for Railway to detect the push** (usually automatic)
2. **Monitor build logs** to verify Nixpacks is being used
3. **Check runtime logs** to verify Python code is running (not Rust)

If Railway still shows "Dockerfile" after 5 minutes:
- Check Railway Dashboard → Settings → Build
- Manually clear any cached Dockerfile path
- Force redeploy: `railway redeploy --service chimera-core`
