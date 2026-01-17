# Quick Start: The Brain Server

## 🚀 Immediate Checklist

### Step 1: Install Dependencies

```bash
cd chimera_brain
pip install grpcio grpcio-tools torch transformers sentence-transformers redis
```

**Note:** If you get permission errors, use:
```bash
pip install --user grpcio grpcio-tools torch transformers sentence-transformers redis
```

### Step 2: Generate Proto Files

```bash
./generate_proto.sh
```

**Expected Output:**
```
✅ Successfully generated Python gRPC classes!
Output directory: proto/
Generated files:
chimera_pb2.py
chimera_pb2_grpc.py
```

### Step 3: Start The Brain Server

```bash
python server.py
```

**Expected Output:**
```
🧠 Starting The Brain gRPC server on [::]:50051
   - Vision Service: Simple (or Full VLM)
   - Hive Mind: Enabled (or Disabled)
```

---

## ✅ Verification

### Test 1: Check Server is Listening

```bash
# In another terminal
lsof -i :50051
```

Should show Python process listening on port 50051.

### Test 2: Test gRPC Connection (Python)

```python
import grpc
from proto import chimera_pb2, chimera_pb2_grpc

channel = grpc.insecure_channel('localhost:50051')
stub = chimera_pb2_grpc.BrainStub(channel)

# Test ProcessVision
request = chimera_pb2.ProcessVisionRequest(
    screenshot=b'fake_image_data',
    text_command="Click the button"
)

try:
    response = stub.ProcessVision(request)
    print(f"✅ Server responding! Found: {response.found}")
except Exception as e:
    print(f"❌ Error: {e}")
```

---

## 🔧 Troubleshooting

### Issue: "Proto files not generated"

**Solution:**
```bash
# Make sure you're in chimera_brain directory
cd chimera_brain

# Check if proto directory exists
ls -la proto/

# If not, run generation script
./generate_proto.sh
```

### Issue: "ModuleNotFoundError: No module named 'grpc_tools'"

**Solution:**
```bash
pip install grpcio-tools
```

### Issue: "Address already in use" (port 50051)

**Solution:**
```bash
# Find process using port 50051
lsof -i :50051

# Kill it or use different port
PORT=50052 python server.py
```

### Issue: "Hive Mind initialization failed"

**Solution:**
- Check `REDIS_URL` environment variable
- For local dev, start Redis: `redis-server`
- Or disable Hive Mind by not setting `REDIS_URL`

---

## 🎯 Next Steps

Once The Brain is running:

1. **Update Rust Body** to connect to `chimera-brain.railway.internal:50051`
2. **Test CreepJS validation** with screenshot → Brain → coordinates flow
3. **Verify 100% Human trust score** on all 5 workers

---

## 📋 Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `50051` | Server listening port |
| `CHIMERA_BRAIN_PORT` | `50051` | Alternative port override |
| `CHIMERA_USE_SIMPLE` | `false` | Use simple detector (set to "true") |
| `REDIS_URL` | `redis://localhost:6379` | Redis for Hive Mind |
| `CHIMERA_VISION_MODEL` | `None` | VLM model name (optional) |
| `CHIMERA_VISION_DEVICE` | `auto` | Device: "cuda" or "cpu" |

---

## 🎉 Success!

When you see:
```
🧠 Starting The Brain gRPC server on [::]:50051
   - Vision Service: Simple
   - Hive Mind: Enabled
```

**The Brain is online and ready to receive requests from The Body (Rust)!**
