# 🚨 URGENT: Railway Dashboard Fix Required

## Problem
The deployment is still running the **old Rust code** instead of the new Python code. This means Railway is still using a Dockerfile build instead of Nixpacks.

## Solution: Clear Dockerfile Path in Dashboard

Railway Dashboard settings override `railway.toml`. You **MUST** clear the Dockerfile path manually:

### Steps:

1. **Go to Railway Dashboard:**
   - https://railway.app/dashboard
   - Select your project: **my-lead-engine**
   - Select service: **chimera-core**

2. **Go to Settings → Build:**
   - Look for: **"Dockerfile Path"** or **"Dockerfile"** setting
   - **DELETE/CLEAR** this field (leave it empty)
   - Ensure **"Builder"** is set to: **Nixpacks** (not Dockerfile)
   - Ensure **"Root Directory"** is: **chimera-core**

3. **Save Settings**

4. **Force Redeploy:**
   ```bash
   cd /Users/linkpellow/Desktop/my-lead-engine/chimera-core
   railway redeploy --service chimera-core
   ```

## Verification

After redeploy, check logs:
```bash
railway logs --service chimera-core --tail 50
```

**You should see:**
- ✅ "🦾 Chimera Core - The Body - Starting..."
- ✅ "Version: Python 3.12" (NOT "Version: 0.1.0")
- ✅ "🏥 Health check server started on 0.0.0.0:8080"
- ✅ "Chimera Core worker started"

**You should NOT see:**
- ❌ "Worker ID: [uuid]" (Rust format)
- ❌ "Testing stealth components" (Rust code)
- ❌ "Generated diffusion path" (Rust code)

## Why This Happened

Railway Dashboard build settings (Dockerfile Path) take precedence over `railway.toml`. Even though we:
- ✅ Deleted `Dockerfile`
- ✅ Updated `railway.toml` to use Nixpacks
- ✅ Created `requirements.txt`

Railway is still using the cached Dockerfile build because the dashboard setting wasn't cleared.

## Alternative: Delete and Recreate Service

If clearing the Dockerfile path doesn't work:

1. **Delete the service** in Railway Dashboard
2. **Create a new service** named `chimera-core`
3. **Set Root Directory:** `chimera-core`
4. **Deploy** - Railway will automatically detect `requirements.txt` and use Nixpacks
