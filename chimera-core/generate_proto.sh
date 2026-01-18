#!/bin/bash
# Generate the gRPC python files in the current directory (root, NOT proto/ subfolder)
# Bulletproof version - uses local paths only

set -e

echo "🔧 Generating gRPC Python classes from chimera.proto..."

# Use current directory (where script is located)
cd "$(dirname "$0")"

# Verify proto file exists
if [ ! -f "chimera.proto" ]; then
    echo "❌ ERROR: chimera.proto not found in current directory"
    echo "   Current directory: $(pwd)"
    echo "   Files in directory:"
    ls -la *.proto 2>/dev/null || echo "   (no .proto files found)"
    exit 1
fi

# Generate Python code directly to root directory (NOT proto/ subfolder)
# Try python3 first, fallback to python
if command -v python3 &> /dev/null; then
    PYTHON_CMD=python3
elif command -v python &> /dev/null; then
    PYTHON_CMD=python
else
    echo "❌ ERROR: Python not found"
    exit 1
fi

$PYTHON_CMD -m grpc_tools.protoc \
    -I. \
    --python_out=. \
    --grpc_python_out=. \
    chimera.proto

# Verify generation succeeded
if [ $? -eq 0 ] && [ -f "chimera_pb2.py" ] && [ -f "chimera_pb2_grpc.py" ]; then
    echo "✅ Successfully generated gRPC classes:"
    echo "   - chimera_pb2.py"
    echo "   - chimera_pb2_grpc.py"
else
    echo "❌ ERROR: Proto generation failed or files not created"
    exit 1
fi

echo "✅ Proto generation complete!"
