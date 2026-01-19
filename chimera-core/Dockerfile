FROM python:3.12-slim

# Instant cache bust: Railway sets RAILWAY_GIT_COMMIT_SHA at build; new commit = full rebuild. Local: "local".
ARG RAILWAY_GIT_COMMIT_SHA=local
RUN echo "cachebust rev=$RAILWAY_GIT_COMMIT_SHA"

# Install system dependencies for Playwright
# Note: Using manual deps list to avoid Debian Trixie package availability issues
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    fonts-noto \
    fonts-noto-cjk \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium (skip system deps as we installed manually)
RUN playwright install chromium

# Copy application code
COPY . .

# Generate proto files (gRPC stubs)
RUN bash ./generate_proto.sh || echo "Warning: Proto generation skipped"

# No exposed port (worker service, no HTTP server)
# Start Chimera Core worker swarm
CMD ["python", "main.py"]
