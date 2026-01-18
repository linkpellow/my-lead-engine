#!/bin/bash
# Generate the gRPC python files in the current directory (root, NOT proto/ subfolder)
# Bulletproof version - uses local paths only

set -e

# Brand stdout so proto-gen lines don't merge with other services.
SERVICE_NAME="$(printf "%s" "${RAILWAY_SERVICE_NAME:-}" | tr '[:upper:]' '[:lower:]' | xargs || true)"
TAG="${CHIMERA_LOG_TAG:-}"
if [ -z "$TAG" ]; then
  if [ "$SERVICE_NAME" = "chimera-core" ] || printf "%s" "$SERVICE_NAME" | grep -q "chimera-core"; then
    TAG="CHIMERA-BODY"
  elif printf "%s" "$SERVICE_NAME" | grep -q "scrapegoat-worker-swarm" || printf "%s" "$SERVICE_NAME" | grep -q "worker-swarm"; then
    TAG="CHIMERA-SWARM"
  else
    TAG="CHIMERA"
  fi
fi

log() {
  printf "[%s] %s\n" "$TAG" "$1"
}

log "🔧 Generating gRPC Python classes from chimera.proto..."

# Use current directory (where script is located)
cd "$(dirname "$0")"

# Verify proto file exists
if [ ! -f "chimera.proto" ]; then
    log "❌ ERROR: chimera.proto not found in current directory"
    log "   Current directory: $(pwd)"
    log "   Files in directory:"
    ls -la *.proto 2>/dev/null || echo "   (no .proto files found)"
    exit 1
fi

# Generate Python code directly to root directory (NOT proto/ subfolder)
# IMPORTANT (Railway/Nixpacks):
# - Dependencies are installed into the venv at /opt/venv during build.
# - At runtime, PATH may not include /opt/venv/bin, so prefer it explicitly.
if [ -x "/opt/venv/bin/python" ]; then
    PYTHON_CMD="/opt/venv/bin/python"
elif [ -x "/opt/venv/bin/python3" ]; then
    PYTHON_CMD="/opt/venv/bin/python3"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
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
    log "✅ Successfully generated gRPC classes:"
    log "   - chimera_pb2.py"
    log "   - chimera_pb2_grpc.py"
else
    log "❌ ERROR: Proto generation failed or files not created"
    exit 1
fi

log "✅ Proto generation complete!"
