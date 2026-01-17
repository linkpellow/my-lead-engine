# Chimera Brain - Python gRPC Server
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Generate proto files (if not already generated)
RUN if [ ! -f proto/chimera_pb2.py ]; then \
    python -m grpc_tools.protoc \
        --proto_path=../@proto \
        --python_out=./proto \
        --grpc_python_out=./proto \
        ../@proto/chimera.proto || true; \
    fi

# Expose gRPC port
EXPOSE 50051

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=50051

# Start the Brain server
CMD ["python", "server.py"]
