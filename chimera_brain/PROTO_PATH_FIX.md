# Proto Path Fix - chimera_brain

## 🔴 Root Cause

**Error:** `Error: chimera.proto not found at //@proto/chimera.proto`

**Root Cause:**
- Railway build context uses Root Directory = `chimera_brain/`
- Script tried to find proto file at `../@proto/chimera.proto` (relative to project root)
- Path resolution failed in containerized Railway build environment
- Build exited with code 1, preventing proto file generation

---

## ✅ Fix Applied

### 1. Copied Proto File Locally

**Action:** Copied `@proto/chimera.proto` to `chimera_brain/proto.chimera.proto`

**Why:** Ensures proto file is available in the build context without path resolution

**File Location:**
- ✅ `chimera_brain/proto.chimera.proto` (local, used by script)
- ✅ `@proto/chimera.proto` (repository root, source of truth)

---

### 2. Simplified generate_proto.sh

**Before:**
```bash
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
PROTO_DIR="$PROJECT_ROOT/@proto"
# Tried to find: ../@proto/chimera.proto
```

**After:**
```bash
PROTO_FILE="$SCRIPT_DIR/proto.chimera.proto"
# Uses local file: ./proto.chimera.proto
```

**Key Changes:**
- ✅ Removed complex path resolution (`../@proto/`)
- ✅ Uses direct local path (`proto.chimera.proto`)
- ✅ Works in both local development and Railway builds
- ✅ No dependency on repository root structure

---

### 3. Updated protoc Command

**Before:**
```bash
$PYTHON_CMD -m grpc_tools.protoc \
    --proto_path="$PROTO_DIR" \
    --python_out="$OUTPUT_DIR" \
    --grpc_python_out="$OUTPUT_DIR" \
    "$PROTO_DIR/chimera.proto"
```

**After:**
```bash
$PYTHON_CMD -m grpc_tools.protoc \
    --proto_path="$SCRIPT_DIR" \
    --python_out="$OUTPUT_DIR" \
    --grpc_python_out="$OUTPUT_DIR" \
    "$PROTO_FILE"
```

**Why:**
- Uses `$SCRIPT_DIR` (current directory) as proto path
- Uses local `proto.chimera.proto` file directly
- No path resolution needed

---

## 🔍 Build Process Flow

**Railway Build Phase:**
1. Install dependencies: `pip install -r requirements.txt`
2. Make script executable: `chmod +x generate_proto.sh`
3. Run proto generation: `./generate_proto.sh`
   - ✅ Finds `proto.chimera.proto` in current directory
   - ✅ Generates `proto/chimera_pb2.py`
   - ✅ Generates `proto/chimera_pb2_grpc.py`
4. Server starts: `PYTHONPATH=. python server.py`
   - ✅ Imports: `from proto import chimera_pb2, chimera_pb2_grpc` ✅

---

## ✅ Verification

### Local Test

**Run locally:**
```bash
cd chimera_brain
./generate_proto.sh
```

**Expected:**
```
✅ Successfully generated Python gRPC classes!
Output directory: /path/to/chimera_brain/proto
Generated files:
chimera_pb2.py
chimera_pb2_grpc.py
```

### Railway Build

**Check build logs:**
```bash
railway logs --service chimera-brain-v1 --tail 100
```

**Expected:**
- ✅ `Generating Python gRPC classes from proto.chimera.proto...`
- ✅ `✅ Successfully generated Python gRPC classes!`
- ✅ No `Error: proto.chimera.proto not found`

**NOT:**
- ❌ `Error: chimera.proto not found at //@proto/chimera.proto`
- ❌ `exit code: 1`

---

## 📋 File Structure

**Before:**
```
chimera_brain/
├── generate_proto.sh (looks for ../@proto/chimera.proto)
└── proto/
    └── __init__.py
```

**After:**
```
chimera_brain/
├── proto.chimera.proto ✅ (local copy)
├── generate_proto.sh (uses ./proto.chimera.proto)
└── proto/
    ├── __init__.py
    ├── chimera_pb2.py (generated)
    └── chimera_pb2_grpc.py (generated)
```

---

## 🎯 Why This Fixes It

**Before:**
- Build: Script tries to resolve `../@proto/chimera.proto` → **FAILS** (path not found)
- Result: Build exits with code 1, proto files not generated

**After:**
- Build: Script uses local `proto.chimera.proto` → **SUCCESS** ✅
- Result: Proto files generated, server starts successfully

---

## ✅ Summary

**Issue:** Proto file path resolution failed in Railway build context

**Root Cause:** Script tried to access `@proto/chimera.proto` relative to repository root, but Railway build context is `chimera_brain/`

**Fixes Applied:**
- ✅ Copied proto file to `chimera_brain/proto.chimera.proto`
- ✅ Simplified script to use local file directly
- ✅ Removed complex path resolution logic

**Status:**
- ✅ Proto file copied locally
- ✅ Script updated to use local path
- ✅ Local test successful
- ⏳ Waiting for Railway build to verify

**Next Step:** Monitor Railway build logs to confirm proto generation succeeds.
