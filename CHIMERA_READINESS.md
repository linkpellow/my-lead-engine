# Chimera Deployment Readiness Checklist

## ✅ COMPLETED FIXES

### 1. Chimera Core Dockerfile
- **Fixed:** Proto path typo (`../@proto/@proto/` → `../@proto/`)
- **Status:** ✅ Ready for build

### 2. Chimera Brain HTTP Health Endpoint
- **Added:** HTTP healthcheck server on PORT (8080) for Railway
- **Added:** gRPC server on CHIMERA_BRAIN_PORT (50051) for service communication
- **Status:** ✅ Ready for deployment

### 3. Railway Configuration
- **Updated:** `chimera_brain/railway.toml` to use PORT=8080 for healthchecks
- **Updated:** `chimera_brain/railway.toml` to use CHIMERA_BRAIN_PORT=50051 for gRPC
- **Status:** ✅ Configured

---

## 📋 DEPLOYMENT CHECKLIST

### Chimera Brain Service

**Railway Dashboard Settings:**
- **Root Directory:** `chimera_brain`
- **Watch Paths:** `chimera_brain/**`
- **Port:** `8080` (for healthchecks)
- **Build Command:** (from Dockerfile)
- **Start Command:** `python server.py`
- **Healthcheck Path:** `/health`
- **Healthcheck Timeout:** `300`

**Environment Variables (Required):**
```bash
PORT=8080                          # HTTP healthcheck port
CHIMERA_BRAIN_PORT=50051           # gRPC server port
PYTHONUNBUFFERED=1
REDIS_URL=redis://default:ThYwwxhsoOhdYIjTUdxRtSyFctxpuvOi@redis.railway.internal:6379
CHIMERA_USE_SIMPLE=false           # Use full VLM (not simple detector)
CHIMERA_VISION_DEVICE=auto         # Auto-detect GPU/CPU
```

**Internal DNS:**
- gRPC endpoint: `chimera-brain.railway.internal:50051`
- HTTP health: `chimera-brain.railway.internal:8080`

---

### Chimera Core Service

**Railway Dashboard Settings:**
- **Root Directory:** `chimera-core`
- **Watch Paths:** `chimera-core/**`
- **Port:** (none - worker service)
- **Build Command:** `cargo build --release` (from Dockerfile)
- **Start Command:** `./chimera-worker`
- **Restart Policy:** `ON_FAILURE`
- **Max Retries:** `10`

**Environment Variables (Required):**
```bash
RUST_LOG=info
RAILWAY_ENVIRONMENT=production
CHIMERA_BRAIN_ADDRESS=http://chimera-brain.railway.internal:50051
WORKER_ID=auto                     # Railway will set this
```

**Build Time:** ~10-12 minutes (Rust compilation)

---

## ⚠️ PRE-DEPLOYMENT REQUIREMENTS

### 1. Proto Files Generation
**Status:** ⚠️ Needs verification

The Dockerfile will auto-generate proto files during build, but verify:
```bash
cd chimera_brain
./generate_proto.sh
ls proto/*.py  # Should see chimera_pb2.py and chimera_pb2_grpc.py
```

### 2. Railway Service Creation
- [ ] Create `chimera-brain-v1` service in Railway Dashboard
- [ ] Create `chimera-core` service in Railway Dashboard
- [ ] Set Root Directories correctly
- [ ] Set all environment variables

### 3. Service Dependencies
- [ ] Redis service must be running (for Hive Mind)
- [ ] Chimera Brain must start before Chimera Core (for gRPC connection)

---

## 🔗 SERVICE COMMUNICATION

### Communication Flow:
```
Chimera Core (Rust) 
    ↓ gRPC
Chimera Brain (Python)
    ↓ Redis
Hive Mind (Vector Memory)
```

### Internal DNS Addresses:
- **Chimera Brain gRPC:** `http://chimera-brain.railway.internal:50051`
- **Chimera Brain HTTP:** `http://chimera-brain.railway.internal:8080`
- **Redis:** `redis.railway.internal:6379`

---

## ✅ VERIFICATION STEPS

After deployment, verify:

1. **Chimera Brain:**
   ```bash
   curl https://chimera-brain-production-*.up.railway.app/health
   # Should return: {"status":"healthy","service":"chimera-brain"}
   ```

2. **Chimera Core:**
   - Check logs for: `✅ Connected to The Brain at: http://chimera-brain.railway.internal:50051`
   - Check logs for: `✅ Brain responded successfully!`
   - Check logs for: `✅ All stealth components operational`

3. **gRPC Connection:**
   - Chimera Core logs should show successful connection
   - No connection errors in either service

---

## 🚨 KNOWN ISSUES / TODO

### Proto Files
- **Issue:** Proto files may not be generated locally
- **Fix:** Dockerfile auto-generates during build
- **Status:** ✅ Handled by Dockerfile

### Healthcheck Port Conflict
- **Issue:** Railway uses PORT for healthchecks, but gRPC needs 50051
- **Fix:** Use PORT=8080 for HTTP health, CHIMERA_BRAIN_PORT=50051 for gRPC
- **Status:** ✅ Fixed

### Build Time
- **Issue:** Rust build takes 10-12 minutes
- **Fix:** Be patient, don't push during build
- **Status:** ⚠️ Expected behavior

---

## 📊 DEPLOYMENT ORDER

1. **Deploy Chimera Brain first** (3-5 minutes)
   - Wait for healthcheck to pass
   - Verify gRPC server is listening

2. **Deploy Chimera Core** (10-12 minutes)
   - Will connect to Chimera Brain on startup
   - Verify connection in logs

3. **Verify Integration**
   - Check both services are healthy
   - Test gRPC communication
   - Verify Hive Mind connection (if Redis configured)

---

## 🎯 SUCCESS CRITERIA

Chimera is ready when:
- ✅ Chimera Brain healthcheck returns 200
- ✅ Chimera Brain gRPC server listening on port 50051
- ✅ Chimera Core connects to Brain successfully
- ✅ Vision processing test passes
- ✅ Stealth components operational
- ✅ No connection errors in logs

---

## 📝 NOTES

- **Dual-Stack Networking:** Both services use `[::]` binding for IPv6/IPv4 compatibility
- **Healthchecks:** Railway requires HTTP endpoints, not gRPC
- **Internal DNS:** Services communicate via Railway's private network
- **Proto Contract:** Shared at `@proto/chimera.proto` across all services
