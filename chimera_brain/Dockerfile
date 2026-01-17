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

# Proto files should already be generated and committed in proto/ directory
# If they don't exist, the server will fail to start (which is expected)
# Proto files are generated locally via generate_proto.sh and committed to git
RUN if [ ! -f proto/chimera_pb2.py ]; then \
        echo "ERROR: Proto files not found! Run ./generate_proto.sh locally and commit proto/ directory."; \
        exit 1; \
    else \
        echo "✅ Proto files found: $(ls proto/*.py)"; \
    fi

# Expose both ports
EXPOSE 8080
EXPOSE 50051

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV CHIMERA_BRAIN_PORT=50051

# Start the Brain server
CMD ["python", "server.py"]
