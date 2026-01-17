# Chimera Services - Complete Railway Configuration

## 🧠 Chimera Brain (chimera-brain-v1)

### Railway Dashboard Settings

**Service Name:** `chimera-brain-v1` (or `chimera-brain`)

**General Tab:**
- **Root Directory:** `chimera_brain` ⚠️ (NOT `chimera_brain/` or `chimera-brain`)
- **Watch Paths:** `chimera_brain/**` (optional, but recommended)

**Deploy Tab:**
- **Build Command:** (Auto-detected from Dockerfile)
- **Start Command:** `python server.py` (from `railway.toml`)
- **Healthcheck Path:** `/health`
- **Healthcheck Timeout:** `300` seconds
- **Restart Policy:** `ON_FAILURE`
- **Max Retries:** `10`

**Variables Tab (Environment Variables):**
```bash
PORT=8080
CHIMERA_BRAIN_PORT=50051
PYTHONUNBUFFERED=1
REDIS_URL=redis://default:ThYwwxhsoOhdYIjTUdxRtSyFctxpuvOi@redis.railway.internal:6379
CHIMERA_USE_SIMPLE=false
CHIMERA_VISION_DEVICE=auto
```

**Ports:**
- **HTTP Healthcheck:** `8080` (exposed to Railway)
- **gRPC Service:** `50051` (internal only, not exposed)

**Internal DNS:**
- **gRPC Endpoint:** `chimera-brain.railway.internal:50051`
- **HTTP Health:** `chimera-brain.railway.internal:8080`

**Build Time:** 3-5 minutes

---

## 🦾 Chimera Core (chimera-core)

### Railway Dashboard Settings

**Service Name:** `chimera-core` (or `chimera-core-v1`)

**General Tab:**
- **Root Directory:** `chimera-core` ⚠️ (NOT `chimera-core/` or `chimera_core`)
- **Watch Paths:** `chimera-core/**` (optional, but recommended)

**Deploy Tab:**
- **Build Command:** `cargo build --release` (from Dockerfile)
- **Start Command:** `./chimera-worker` (from `railway.toml`)
- **Healthcheck Path:** (none - worker service)
- **Healthcheck Timeout:** (not applicable)
- **Restart Policy:** `ON_FAILURE`
- **Max Retries:** `10`

**Variables Tab (Environment Variables):**
```bash
RUST_LOG=info
RAILWAY_ENVIRONMENT=production
CHIMERA_BRAIN_ADDRESS=http://chimera-brain.railway.internal:50051
WORKER_ID=auto
```

**Ports:**
- **None** (worker service, no exposed ports)

**Internal DNS:**
- **Connects to:** `chimera-brain.railway.internal:50051`

**Build Time:** 10-12 minutes ⚠️ (Rust compilation is slow)

---

## 📋 Quick Setup Checklist

### Chimera Brain Setup:

- [ ] Service created in Railway Dashboard
- [ ] Root Directory set to: `chimera_brain`
- [ ] Healthcheck Path set to: `/health`
- [ ] Environment Variables set:
  - [ ] `PORT=8080`
  - [ ] `CHIMERA_BRAIN_PORT=50051`
  - [ ] `PYTHONUNBUFFERED=1`
  - [ ] `REDIS_URL=...` (if using Hive Mind)
- [ ] Proto files exist in `chimera_brain/proto/` directory
- [ ] Deploy and wait for "Active" status

### Chimera Core Setup:

- [ ] Service created in Railway Dashboard
- [ ] Root Directory set to: `chimera-core`
- [ ] Environment Variables set:
  - [ ] `RUST_LOG=info`
  - [ ] `RAILWAY_ENVIRONMENT=production`
  - [ ] `CHIMERA_BRAIN_ADDRESS=http://chimera-brain.railway.internal:50051`
- [ ] **Wait for Chimera Brain to be "Active" first**
- [ ] Deploy and wait 10-12 minutes for build

---

## 🚨 Critical Notes

### Root Directory Rules:
- ✅ **Correct:** `chimera_brain` (no trailing slash)
- ❌ **Wrong:** `chimera_brain/`
- ❌ **Wrong:** `chimera-brain`
- ❌ **Wrong:** `chimera_brain/` (with trailing slash)

- ✅ **Correct:** `chimera-core` (no trailing slash)
- ❌ **Wrong:** `chimera-core/`
- ❌ **Wrong:** `chimera_core`
- ❌ **Wrong:** `chimera-core/` (with trailing slash)

### Service Name → Internal DNS Mapping:
Railway converts service names to internal DNS:
- Service: `chimera-brain-v1` → DNS: `chimera-brain.railway.internal`
- Service: `chimera-core` → DNS: `chimera-core.railway.internal`

**Important:** Railway converts:
- Hyphens (`-`) → dots (`.`)
- Underscores (`_`) → dots (`.`)
- All lowercase

### Deployment Order:
1. **Deploy Chimera Brain first** (3-5 min)
2. **Wait for "Active" status**
3. **Then deploy Chimera Core** (10-12 min)
4. **Chimera Core will connect to Brain on startup**

### Proto Files:
- **Chimera Brain:** Proto files must exist in `chimera_brain/proto/` directory
  - Files: `chimera_pb2.py`, `chimera_pb2_grpc.py`
  - These should be committed to git
- **Chimera Core:** Proto file is copied during Docker build
  - Source: `@proto/chimera.proto`
  - Copied to: `./proto/chimera.proto` in build context

---

## 🔍 Verification Steps

### After Chimera Brain Deployment:

1. **Check Status:**
   - Railway Dashboard → Service → Should show "Active"

2. **Check Logs:**
   ```
   🏥 Health check server started on [::]:8080
   🧠 Starting The Brain gRPC server on [::]:50051
   ```

3. **Test Healthcheck:**
   ```bash
   curl https://chimera-brain-production-*.up.railway.app/health
   # Should return: {"status":"healthy","service":"chimera-brain"}
   ```

### After Chimera Core Deployment:

1. **Check Status:**
   - Railway Dashboard → Service → Should show "Active"

2. **Check Logs:**
   ```
   ✅ Connected to The Brain at: http://chimera-brain.railway.internal:50051
   ✅ Brain responded successfully!
   ✅ All stealth components operational
   ```

3. **Verify Connection:**
   - No connection errors in logs
   - Vision processing test passes

---

## 📊 Expected Timeline

- **Chimera Brain:** 3-5 minutes (Python build + startup)
- **Chimera Core:** 10-12 minutes (Rust compilation)

**⚠️ DO NOT push during builds - it resets the timer!**

---

## 🆘 Common Issues

### Issue: "Service is offline"
**Possible Causes:**
1. Root Directory not set correctly
2. Build failed (check deployment logs)
3. Healthcheck failing (Brain only)
4. Startup crash (check logs)

### Issue: "Proto files not found"
**Fix:**
- Ensure proto files are committed to git
- For Brain: `chimera_brain/proto/chimera_pb2.py` must exist
- For Core: `@proto/chimera.proto` must exist in repo

### Issue: "Connection refused" (Core)
**Fix:**
1. Deploy Brain first and wait for "Active"
2. Verify `CHIMERA_BRAIN_ADDRESS` is set correctly
3. Check service name matches internal DNS pattern

---

## 📝 Summary Table

| Setting | Chimera Brain | Chimera Core |
|---------|--------------|--------------|
| **Root Directory** | `chimera_brain` | `chimera-core` |
| **Build Time** | 3-5 min | 10-12 min |
| **Healthcheck** | `/health` on port 8080 | None |
| **Exposed Ports** | 8080 (HTTP) | None |
| **Internal Ports** | 50051 (gRPC) | N/A |
| **Start Command** | `python server.py` | `./chimera-worker` |
| **Key Env Vars** | `PORT=8080`, `CHIMERA_BRAIN_PORT=50051` | `CHIMERA_BRAIN_ADDRESS=...` |
| **Depends On** | None | Chimera Brain (must be Active) |
