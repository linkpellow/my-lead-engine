#!/bin/bash
# Run Pre-Flight Smoke Test - Complete Sovereign Neural Pipeline Validation
# This script starts the required services and runs the smoke test with Trauma monitoring.

set -e

echo "🚀 Sovereign Neural Pipeline - Pre-Flight Smoke Test"
echo "=" | head -c 60
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SMOKE_TIMEOUT="${SMOKE_RESULTS_TIMEOUT:-120}"
USE_DOCKER="${USE_DOCKER:-true}"

# Check if Redis is running
echo -n "Checking Redis... "
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
    REDIS_OK=true
else
    echo -e "${RED}NOT RUNNING${NC}"
    REDIS_OK=false
fi

# Determine run mode
if [[ "$USE_DOCKER" == "true" ]]; then
    echo
    echo "🐳 Starting services with Docker Compose..."
    echo "   (This may take 1-2 minutes for initial build)"
    echo
    
    # Start infrastructure + services
    docker compose up -d redis postgres 2>&1 | grep -v "version.*obsolete" || true
    sleep 3
    
    docker compose up -d chimera-brain 2>&1 | grep -v "version.*obsolete" || true
    sleep 5
    
    docker compose up -d chimera-core scrapegoat 2>&1 | grep -v "version.*obsolete" || true
    sleep 5
    
    # Wait for health checks
    echo
    echo "⏳ Waiting for services to be healthy..."
    for i in {1..30}; do
        BRAIN_HEALTH=$(docker compose exec -T chimera-brain python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health', timeout=2)" 2>&1 | grep -c "200" || echo "0")
        SCRAPE_HEALTH=$(docker compose exec -T scrapegoat python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=2)" 2>&1 | grep -c "200" || echo "0")
        
        if [[ "$BRAIN_HEALTH" == "1" ]] && [[ "$SCRAPE_HEALTH" == "1" ]]; then
            echo -e "${GREEN}✅ All services healthy${NC}"
            break
        fi
        
        echo -n "."
        sleep 2
    done
    echo
    
    # Set environment for smoke test (Docker network addresses)
    export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
    export CHIMERA_BRAIN_HTTP_URL="http://localhost:8080"
    export SCRAPEGOAT_URL="http://localhost:8000"
else
    echo
    echo "🖥️  Using local services (no Docker)"
    echo
    
    if [[ "$REDIS_OK" != "true" ]]; then
        echo -e "${RED}❌ Redis is not running. Start with: redis-server${NC}"
        exit 1
    fi
    
    # Check for local services
    if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Chimera Brain not running on localhost:8080${NC}"
    fi
    
    if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Scrapegoat not running on localhost:8000${NC}"
    fi
    
    export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
    export CHIMERA_BRAIN_HTTP_URL="${CHIMERA_BRAIN_HTTP_URL:-http://localhost:8080}"
    export SCRAPEGOAT_URL="${SCRAPEGOAT_URL:-http://localhost:8000}"
fi

# Display queue status
echo
echo "📊 Queue Status:"
QUEUE_LEN=$(redis-cli LLEN chimera:missions 2>/dev/null || echo "?")
echo "   chimera:missions: $QUEUE_LEN missions waiting"
echo

# Run smoke test
echo "🧪 Running Pre-Flight Smoke Test (5 missions, ${SMOKE_TIMEOUT}s timeout each)..."
echo "   Monitoring for Trauma signals:"
echo "     - CAPTCHA_AGENT_FAILURE"
echo "     - NEEDS_OLMOCR_VERIFICATION"
echo "     - TIMEOUT"
echo
echo "=" | head -c 60
echo

export SMOKE_RESULTS_TIMEOUT="$SMOKE_TIMEOUT"
python3 scripts/preflight_smoke_test.py
TEST_EXIT=$?

# Cleanup
if [[ "$USE_DOCKER" == "true" ]]; then
    echo
    echo "🧹 Cleanup: docker compose down (or keep running for more tests)"
    read -p "Stop containers? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose down
    fi
fi

exit $TEST_EXIT
