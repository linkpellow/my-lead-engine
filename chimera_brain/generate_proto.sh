#!/bin/bash
# Generate Python gRPC classes from chimera.proto

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Generating Python gRPC classes from chimera.proto...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
PROTO_DIR="$PROJECT_ROOT/@proto"
OUTPUT_DIR="$SCRIPT_DIR/proto"

# Check if proto file exists
if [ ! -f "$PROTO_DIR/chimera.proto" ]; then
    echo -e "${YELLOW}Error: chimera.proto not found at $PROTO_DIR/chimera.proto${NC}"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Create __init__.py in proto directory if it doesn't exist
if [ ! -f "$OUTPUT_DIR/__init__.py" ]; then
    touch "$OUTPUT_DIR/__init__.py"
fi

# Generate Python code
echo -e "${GREEN}Running protoc...${NC}"
# Try python3 first, fallback to python
if command -v python3 &> /dev/null; then
    PYTHON_CMD=python3
elif command -v python &> /dev/null; then
    PYTHON_CMD=python
else
    echo -e "${YELLOW}Error: Python not found. Please install Python 3.11+${NC}"
    exit 1
fi

$PYTHON_CMD -m grpc_tools.protoc \
    --proto_path="$PROTO_DIR" \
    --python_out="$OUTPUT_DIR" \
    --grpc_python_out="$OUTPUT_DIR" \
    "$PROTO_DIR/chimera.proto"

# Check if generation was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully generated Python gRPC classes!${NC}"
    echo -e "${GREEN}Output directory: $OUTPUT_DIR${NC}"
    echo -e "${GREEN}Generated files:${NC}"
    ls -la "$OUTPUT_DIR"/*.py 2>/dev/null || echo "No .py files found"
else
    echo -e "${YELLOW}❌ Error generating gRPC classes${NC}"
    exit 1
fi

# Create __init__.py if it doesn't exist
if [ ! -f "$OUTPUT_DIR/__init__.py" ]; then
    touch "$OUTPUT_DIR/__init__.py"
    echo -e "${GREEN}Created __init__.py in proto directory${NC}"
fi

echo -e "${GREEN}Done!${NC}"
