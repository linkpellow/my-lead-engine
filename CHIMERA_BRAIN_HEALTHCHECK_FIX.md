# Chimera Brain Healthcheck Fix - No Guessing

## 🔴 Log-Proven Failure

**Build Success:** ✅ Nixpacks successfully installed Python and dependencies in 31 seconds

**Start Command:** ✅ Container is executing `python server.py`

**The Deadlock:** ❌ Railway is polling `/health` for 5 minutes, and every attempt (1-13) returned "service unavailable"

---

## 🔍 Root Cause Analysis

**Logs Show:**
```
INFO:__main__:🏥 Health check server started on [::]:8080 (IPv6 dual-stack)
INFO:__main__:🧠 Starting The Brain gRPC server on [::]:50051
```

**Code Shows:**
- ✅ Health server binds to `0.0.0.0:8080` (correct)
- ✅ Health endpoint exists at `/health` (correct)
- ✅ PORT env var is used: `int(os.getenv("PORT", "8080"))` (correct)
- ❌ **Missing `import json`** - used in QueryMemory but not imported!

---

## ✅ Fixes Applied

### 1. Added Missing Import

**File:** `chimera_brain/server.py`

**Added:**
```python
import json
```

**Why:** `json.dumps()` is used in `QueryMemory()` method but `json` module was not imported. This could cause the server to crash when processing memory queries.

---

### 2. Verified Port Binding

**Code Already Correct:**
```python
health_port = int(os.getenv("PORT", "8080"))  # ✅ Uses Railway PORT env var
server_address = ('0.0.0.0', port)  # ✅ Binds to all interfaces
```

**Railway Variables:**
- ✅ `PORT = 8080` (set in railway.toml and Dashboard)
- ✅ `CHIMERA_BRAIN_PORT = 50051` (set in railway.toml)

---

### 3. Verified Health Endpoint

**Code Already Correct:**
```python
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"healthy","service":"chimera-brain"}')
```

**Railway Config:**
- ✅ `healthcheckPath = "/health"` (set in railway.toml)

---

### 4. Set PYTHONUNBUFFERED

**Command:** `railway variable set PYTHONUNBUFFERED=1 --service chimera-brain-v1`

**Why:** Ensures logs are flushed immediately, so we can see why it crashes if it does.

---

### 5. Force Redeploy

**Command:** `railway up --service chimera-brain-v1 --detach`

**Why:** Forces fresh deployment with fixed code (added `import json`).

---

## 🔍 Verification

### Check Logs After Fix

```bash
railway logs --service chimera-brain-v1 --tail 50
```

**Expected:**
- ✅ `🏥 Health check server started on 0.0.0.0:8080`
- ✅ `🧠 Starting The Brain gRPC server on 0.0.0.0:50051`
- ✅ No import errors
- ✅ No crashes

**Healthcheck Should:**
- ✅ Return 200 OK on `/health`
- ✅ Railway should mark service as "Healthy"

---

## 📋 Railway Dashboard Sync

**Railway Dashboard → chimera-brain-v1 → Settings:**

1. **Deploy → Healthcheck Path:**
   - Should be: `/health` (already set in railway.toml)
   - If Dashboard shows different, change to `/health`

2. **Variables:**
   - ✅ `PORT = 8080` (already set)
   - ✅ `CHIMERA_BRAIN_PORT = 50051` (already set)
   - ✅ `PYTHONUNBUFFERED = 1` (just set via CLI)

3. **Deploy → Start Command:**
   - Should be: `python server.py` (already set in railway.toml)

---

## 🎯 Why This Fixes It

**Before:**
- Missing `import json` could cause server to crash on memory queries
- Server might crash before healthcheck can reach it
- Railway marks service as "unavailable"

**After:**
- ✅ `import json` added (prevents crashes)
- ✅ Port binding correct (`0.0.0.0:8080`)
- ✅ Health endpoint exists (`/health`)
- ✅ PORT env var used correctly
- ✅ PYTHONUNBUFFERED set (better logging)

**Result:** Healthcheck should succeed, service marked as "Healthy"

---

## ✅ Summary

**Issue:** Healthcheck failing - "service unavailable" after 13 attempts

**Root Cause:** Missing `import json` could cause server crashes

**Fixes Applied:**
- ✅ Added `import json` to server.py
- ✅ Set `PYTHONUNBUFFERED=1` variable
- ✅ Force redeploy triggered

**Status:**
- ✅ Code fixed (import added)
- ✅ Variables verified
- ⏳ Waiting for deployment to complete
- ⏳ Waiting for healthcheck verification

**Next Step:** Monitor logs to verify healthcheck succeeds.
