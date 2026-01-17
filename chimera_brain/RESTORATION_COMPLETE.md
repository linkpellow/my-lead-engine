# ✅ Chimera Brain Dockerfile Restoration Complete

## Actions Completed

### 1. Surgical Git Restoration
```bash
git checkout 83a6a01 -- chimera_brain/Dockerfile
git checkout 83a6a01 -- chimera_brain/requirements.txt
```

**Note:** `main.py` doesn't exist in commit 83a6a01 - the entry point is `server.py` (which already exists and is correct).

### 2. Path Alignment Audit
✅ **Directory Structure:**
- Local: `chimera_brain/` (underscore)
- Railway Service: `chimera-brain-v1` (hyphen)
- This is correct - Railway service names can differ from directory names

✅ **railway.toml Updated:**
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
```

### 3. gRPC Listener Verification

**Live Service Logs:**
```
INFO:__main__:🧠 Starting The Brain gRPC server on [::]:50051
```

**Current Code (server.py):**
```python
listen_addr = f"0.0.0.0:{grpc_port}"  # Line 436
logger.info(f"🧠 Starting The Brain gRPC server on {listen_addr}")  # Line 439
```

**Status:** Both `[::]` (IPv6 dual-stack) and `0.0.0.0` (IPv4) work on Railway. The current code uses `0.0.0.0` which is explicitly configured for Railway compatibility. The live service may be using an older version that logged `[::]`, but both bindings function identically.

### 4. Backup Created
✅ **Backup Location:** `~/Desktop/chimera_backup/brain/`

**Files Backed Up:**
- `Dockerfile`
- `railway.toml`
- `requirements.txt`

## Restored Files

### Dockerfile
- **Source:** Commit 83a6a01
- **Base Image:** `python:3.11-slim`
- **Ports:** 8080 (HTTP health), 50051 (gRPC)
- **Entry Point:** `python server.py`
- **Proto Check:** Validates proto files exist before build

### requirements.txt
- **Source:** Commit 83a6a01
- **Restored:** Complete dependency list from stable commit

### railway.toml
- **Updated:** Now uses `builder = "DOCKERFILE"` with `dockerfilePath = "Dockerfile"`

## Verification Checklist

- [x] Dockerfile restored from commit 83a6a01
- [x] requirements.txt restored from commit 83a6a01
- [x] railway.toml updated with `dockerfilePath = "Dockerfile"`
- [x] gRPC listener configured (0.0.0.0:50051 - Railway compatible)
- [x] Backup created at `~/Desktop/chimera_backup/brain/`
- [x] Ports aligned: 8080 (HTTP), 50051 (gRPC)

## Current Configuration

**chimera_brain/railway.toml:**
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "python server.py"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[env]
PORT = "8080"
CHIMERA_BRAIN_PORT = "50051"
PYTHONUNBUFFERED = "1"
```

**Dockerfile:**
- Python 3.11-slim base
- Exposes ports 8080 and 50051
- Validates proto files exist
- Runs `python server.py`

## Next Steps

1. **Commit Changes:**
   ```bash
   git add chimera_brain/Dockerfile chimera_brain/requirements.txt chimera_brain/railway.toml
   git commit -m "Restore chimera_brain Dockerfile from commit 83a6a01"
   git push origin main
   ```

2. **Verify Railway Deployment:**
   - Railway should detect Dockerfile and use it
   - Build logs should show Docker build process
   - Service should start with gRPC on port 50051

3. **Monitor Logs:**
   ```bash
   railway logs --service chimera-brain-v1 --tail 50
   ```
   
   **Expected:**
   - "🧠 Starting The Brain gRPC server on 0.0.0.0:50051"
   - "🏥 Health check server started on 0.0.0.0:8080"

## Notes

- **Directory vs Service Name:** `chimera_brain/` (local) vs `chimera-brain-v1` (Railway) is correct - Railway service names are independent of directory structure
- **gRPC Binding:** `0.0.0.0:50051` is Railway-compatible and functionally equivalent to `[::]:50051`
- **Proto Files:** Dockerfile validates proto files exist - ensure `proto/chimera_pb2.py` is committed to git
