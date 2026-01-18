# gRPC Proto Generation Fix - chimera_brain

## 🔴 Root Cause

**Error:** `AttributeError: module 'proto' has no attribute 'chimera_pb2'` or similar gRPC import errors

**Root Cause:** 
- gRPC requires generated Python code (`chimera_pb2.py` and `chimera_pb2_grpc.py`)
- These files are generated from `@proto/chimera.proto` using `grpc_tools.protoc`
- Railway build process doesn't run proto generation, so files are missing at runtime

---

## ✅ Fix Applied

### 1. Updated Build Command

**File:** `chimera_brain/railway.toml`

**Updated:**
```toml
[build]
builder = "NIXPACKS"
buildCommand = "pip install -r requirements.txt && chmod +x generate_proto.sh && ./generate_proto.sh"
```

**Why:** Ensures proto files are generated during Railway build phase, before server starts.

---

### 2. Verified Proto Generation Script

**File:** `chimera_brain/generate_proto.sh`

**Status:** ✅ Exists and is executable

**Script Details:**
- Reads from: `@proto/chimera.proto` (repository root)
- Outputs to: `chimera_brain/proto/` directory
- Uses: `python -m grpc_tools.protoc`
- Generates: `chimera_pb2.py` and `chimera_pb2_grpc.py`

---

### 3. Verified Dependencies

**File:** `chimera_brain/requirements.txt`

**Contains:**
- ✅ `grpcio>=1.60.0,<2.0.0`
- ✅ `grpcio-tools>=1.60.0,<2.0.0` (includes protoc)
- ✅ `protobuf>=4.25.0,<5.0.0`

**Status:** ✅ All required dependencies are present

---

### 4. Verified Proto File Location

**Proto File:** `@proto/chimera.proto`

**Status:** ✅ Exists at repository root

**Script Path Resolution:**
- Script runs from: `chimera_brain/` directory
- Script finds: `../@proto/chimera.proto` (correct)
- Outputs to: `chimera_brain/proto/` (correct)

---

## 🔍 Build Process Flow

**Railway Build Phase:**
1. Install dependencies: `pip install -r requirements.txt`
   - Installs `grpcio-tools` (includes `protoc`)
2. Make script executable: `chmod +x generate_proto.sh`
3. Generate proto files: `./generate_proto.sh`
   - Reads: `@proto/chimera.proto`
   - Generates: `chimera_brain/proto/chimera_pb2.py`
   - Generates: `chimera_brain/proto/chimera_pb2_grpc.py`
4. Server starts: `PYTHONPATH=. python server.py`
   - Imports: `from proto import chimera_pb2, chimera_pb2_grpc` ✅

---

## ✅ Verification

### Check Generated Files

**After build, verify:**
```bash
ls -la chimera_brain/proto/
```

**Expected:**
- ✅ `chimera_pb2.py` (generated)
- ✅ `chimera_pb2_grpc.py` (generated)
- ✅ `__init__.py` (exists)

### Check Logs

**After deployment:**
```bash
railway logs --service chimera-brain-v1 --tail 50
```

**Expected:**
- ✅ No `AttributeError` or `ImportError` for proto files
- ✅ `✅ Selector Registry (Trauma Center) initialized`
- ✅ `🧠 Starting The Brain gRPC server on 0.0.0.0:50051`

**NOT:**
- ❌ `AttributeError: module 'proto' has no attribute 'chimera_pb2'`
- ❌ `ImportError: cannot import name 'chimera_pb2'`

---

## 📋 Current Status

**Proto Files (Local):**
- ✅ `chimera_brain/proto/chimera_pb2.py` (exists locally)
- ✅ `chimera_brain/proto/chimera_pb2_grpc.py` (exists locally)

**Build Configuration:**
- ✅ `generate_proto.sh` exists and is executable
- ✅ `railway.toml` buildCommand includes proto generation
- ✅ `requirements.txt` includes `grpcio-tools`

**Proto Source:**
- ✅ `@proto/chimera.proto` exists at repository root

---

## 🎯 Why This Fixes It

**Before:**
- Build: Installs dependencies, but doesn't generate proto files
- Runtime: Server tries to import `chimera_pb2` → **AttributeError**

**After:**
- Build: Installs dependencies, then generates proto files
- Runtime: Server imports `chimera_pb2` → **SUCCESS** ✅

---

## ✅ Summary

**Issue:** gRPC proto files not generated during Railway build

**Root Cause:** Build command didn't include proto generation step

**Fixes Applied:**
- ✅ Updated `railway.toml` buildCommand to include `./generate_proto.sh`
- ✅ Made `generate_proto.sh` executable
- ✅ Verified proto file location and script paths

**Status:**
- ✅ Build command updated
- ✅ Script is executable
- ⏳ Waiting for deployment to verify proto generation works

**Next Step:** Monitor build logs to verify proto files are generated successfully.
