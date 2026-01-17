# Chimera Services Offline - Diagnosis Guide

## 🔍 Quick Diagnosis Steps

### Step 1: Check if Services Are Deployed

**In Railway Dashboard:**
1. Go to your project
2. Check if `chimera-brain-v1` and `chimera-core` services exist
3. If they don't exist → **They need to be created first**

**If services don't exist:**
- Click **"New"** → **"GitHub Repo"**
- Select your repository
- Set **Root Directory** to `chimera_brain` (for Brain) or `chimera-core` (for Core)
- Railway will auto-deploy

---

### Step 2: Check Build Status

**In Railway Dashboard:**
1. Click on `chimera-brain-v1` service
2. Go to **"Deployments"** tab
3. Check the latest deployment status:
   - ✅ **Active** = Running
   - ⚠️ **Building** = Still building (wait)
   - ❌ **Failed** = Build failed (check logs)

**Common Build Failures:**

#### Chimera Brain Build Failures:
1. **Proto files not found**
   - **Error:** `Proto files not generated! Run ./generate_proto.sh first.`
   - **Fix:** Proto files should be committed to git. Check if `chimera_brain/proto/chimera_pb2.py` exists in repo.

2. **Root Directory wrong**
   - **Error:** `Could not read requirements.txt`
   - **Fix:** Set Root Directory to `chimera_brain` (not `chimera_brain/`)

3. **Dockerfile proto path issue**
   - **Error:** `../@proto/chimera.proto: No such file or directory`
   - **Fix:** Proto files must be in `chimera_brain/proto/` directory (already generated)

#### Chimera Core Build Failures:
1. **Proto file not found**
   - **Error:** `../@proto/chimera.proto: No such file or directory`
   - **Fix:** Root Directory must be `chimera-core` (not `chimera-core/`)

2. **Rust build timeout**
   - **Error:** Build takes >15 minutes
   - **Fix:** This is normal, just wait. Don't push during build.

---

### Step 3: Check Startup Logs

**View logs in Railway Dashboard:**
1. Click on service
2. Go to **"Logs"** tab
3. Look for startup messages

**Expected Success Messages:**

#### Chimera Brain:
```
🏥 Health check server started on [::]:8080
🧠 Starting The Brain gRPC server on [::]:50051
   - Vision Service: Full VLM (or Simple)
   - Hive Mind: Enabled (or Disabled)
```

#### Chimera Core:
```
🦾 Chimera Core - The Body - Starting...
   Worker ID: <id>
✅ Connected to The Brain at: http://chimera-brain.railway.internal:50051
📸 Testing vision processing...
✅ Brain responded successfully!
```

**Common Startup Failures:**

#### Chimera Brain:
1. **Proto import error**
   ```
   ModuleNotFoundError: No module named 'proto.chimera_pb2'
   ```
   **Fix:** Proto files must be in `chimera_brain/proto/` directory

2. **Port binding error**
   ```
   Address already in use: [::]:8080
   ```
   **Fix:** Check if PORT environment variable conflicts

3. **Missing dependencies**
   ```
   ModuleNotFoundError: No module named 'grpc'
   ```
   **Fix:** Check `requirements.txt` is correct

#### Chimera Core:
1. **Can't connect to Brain**
   ```
   ❌ Vision processing failed: Connection refused
   ```
   **Fix:** 
   - Chimera Brain must be running first
   - Check `CHIMERA_BRAIN_ADDRESS` environment variable
   - Verify service name matches internal DNS

2. **Proto compilation error**
   ```
   error: failed to compile proto file
   ```
   **Fix:** Check `@proto/chimera.proto` exists in repo

---

### Step 4: Check Healthcheck Status

**Railway marks services as "offline" if healthchecks fail:**

#### Chimera Brain:
- **Healthcheck Path:** `/health` (HTTP)
- **Healthcheck Port:** `8080` (PORT env var)
- **Expected Response:** `{"status":"healthy","service":"chimera-brain"}`

**If healthcheck fails:**
1. Check if HTTP server started: Look for `🏥 Health check server started on [::]:8080`
2. Check PORT environment variable: Should be `8080`
3. Check healthcheck path in Railway: Should be `/health`

#### Chimera Core:
- **No healthcheck** (worker service)
- Railway may mark as "offline" if it crashes on startup

---

### Step 5: Check Environment Variables

**Required for Chimera Brain:**
```bash
PORT=8080                          # HTTP healthcheck port
CHIMERA_BRAIN_PORT=50051           # gRPC server port
PYTHONUNBUFFERED=1
REDIS_URL=redis://default:ThYwwxhsoOhdYIjTUdxRtSyFctxpuvOi@redis.railway.internal:6379
```

**Required for Chimera Core:**
```bash
RUST_LOG=info
RAILWAY_ENVIRONMENT=production
CHIMERA_BRAIN_ADDRESS=http://chimera-brain.railway.internal:50051
```

**Check in Railway Dashboard:**
1. Click on service
2. Go to **"Variables"** tab
3. Verify all required variables are set

---

## 🚨 Most Common Issues

### Issue 1: Services Not Created Yet
**Symptom:** Services don't appear in Railway dashboard
**Fix:** Create services via Railway Dashboard → New → GitHub Repo

### Issue 2: Root Directory Not Set
**Symptom:** Build fails with "file not found" errors
**Fix:** 
- Railway Dashboard → Service → Settings → General
- Set Root Directory: `chimera_brain` (for Brain) or `chimera-core` (for Core)

### Issue 3: Proto Files Missing
**Symptom:** `ModuleNotFoundError: No module named 'proto.chimera_pb2'`
**Fix:** 
- Proto files should be in `chimera_brain/proto/` directory
- They should be committed to git
- Check: `ls chimera_brain/proto/chimera_pb2.py`

### Issue 4: Chimera Core Can't Connect to Brain
**Symptom:** `Connection refused` or `Failed to connect`
**Fix:**
1. Deploy Chimera Brain first
2. Wait for it to be "Active"
3. Set `CHIMERA_BRAIN_ADDRESS=http://chimera-brain.railway.internal:50051`
4. Verify service name matches (Railway converts to lowercase with dots)

### Issue 5: Healthcheck Failing
**Symptom:** Service shows as "offline" even though it's running
**Fix:**
1. Check PORT environment variable (should be `8080` for Brain)
2. Check healthcheck path (should be `/health`)
3. Check logs for HTTP server startup message

---

## ✅ Quick Fix Checklist

- [ ] Services created in Railway Dashboard
- [ ] Root Directory set correctly (`chimera_brain` or `chimera-core`)
- [ ] Proto files exist in `chimera_brain/proto/` directory
- [ ] Environment variables set (see Step 5)
- [ ] Chimera Brain deployed and "Active" before deploying Core
- [ ] Healthcheck path set to `/health` (for Brain)
- [ ] PORT environment variable set to `8080` (for Brain)

---

## 🔧 Manual Fix Commands

### Check Proto Files Exist:
```bash
ls -la chimera_brain/proto/chimera_pb2.py
ls -la chimera_brain/proto/chimera_pb2_grpc.py
```

### Generate Proto Files (if missing):
```bash
cd chimera_brain
./generate_proto.sh
git add proto/
git commit -m "feat: add generated proto files"
git push
```

### Check Service Names:
```bash
railway service list
# Or check Railway Dashboard
```

---

## 📊 Expected Timeline

- **Chimera Brain:** 3-5 minutes (Python build)
- **Chimera Core:** 10-12 minutes (Rust compilation)

**Don't push during builds - it resets the timer!**

---

## 🆘 Still Offline?

1. **Check Railway Dashboard logs** for specific error messages
2. **Verify Root Directory** is set correctly
3. **Check environment variables** are all set
4. **Ensure proto files** are committed to git
5. **Deploy Chimera Brain first**, then Core

If still failing, share the specific error message from Railway logs!
