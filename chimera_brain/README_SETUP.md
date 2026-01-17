# Chimera Brain Setup Guide

## ✅ Completed Steps

1. **Proto Contract Created**: `@proto/chimera.proto` defines the unified gRPC contract
2. **Generation Script Created**: `generate_proto.sh` will generate Python gRPC classes
3. **Server Updated**: `server.py` now:
   - Listens on port **50051** (Railway standard)
   - Integrates **VisionService** into `ProcessVision` handler
   - Integrates **HiveMind** into `QueryMemory` handler
   - Handles both coordinate detection and general vision processing

## 🔧 Next Steps

### 1. Install Dependencies

```bash
cd chimera_brain
pip install grpcio grpcio-tools
# Or if using requirements.txt:
pip install -r requirements.txt
```

### 2. Generate Proto Files

```bash
./generate_proto.sh
```

This will create:
- `proto/chimera_pb2.py` - Message classes
- `proto/chimera_pb2_grpc.py` - Service classes

### 3. Verify Server

```bash
python server.py
```

You should see:
```
🧠 Starting The Brain gRPC server on [::]:50051
   - Vision Service: Simple (or Full VLM)
   - Hive Mind: Enabled (or Disabled)
```

## 📋 Server Configuration

### Environment Variables

- `PORT` - Server port (default: 50051)
- `CHIMERA_BRAIN_PORT` - Alternative port override
- `CHIMERA_USE_SIMPLE` - Use simple detector (set to "true")
- `CHIMERA_VISION_MODEL` - VLM model name (optional)
- `CHIMERA_VISION_DEVICE` - Device for VLM ("cuda" or "cpu")
- `REDIS_URL` - Redis connection for Hive Mind

### Command Line Options

```bash
# Use simple detector
python server.py --simple

# Or set environment variable
CHIMERA_USE_SIMPLE=true python server.py
```

## 🔗 Integration Points

### ProcessVision Handler
- **Input**: `ProcessVisionRequest` with `screenshot` (bytes) and optional `text_command`
- **Output**: `VisionResponse` with coordinates or description
- **Uses**: `VisualIntentProcessor` or `SimpleCoordinateDetector`

### QueryMemory Handler
- **Input**: `QueryMemoryRequest` with `query`, `ax_tree_summary`, `screenshot_hash`
- **Output**: `MemoryResponse` with cached action plans
- **Uses**: `HiveMind.recall_experience()` for experience recall

## 🚀 Railway Deployment

The server is configured to:
- Listen on port 50051 (Railway will map this)
- Use Railway's private network for service-to-service communication
- Connect to Redis via `REDIS_URL` environment variable

## ✅ Verification

Once running, test with:

```python
import grpc
from proto import chimera_pb2, chimera_pb2_grpc

channel = grpc.insecure_channel('localhost:50051')
stub = chimera_pb2_grpc.BrainStub(channel)

# Test ProcessVision
request = chimera_pb2.ProcessVisionRequest(
    screenshot=b'...',  # PNG bytes
    text_command="Click the submit button"
)
response = stub.ProcessVision(request)
print(f"Found: {response.found}, Coordinates: ({response.x}, {response.y})")
```
