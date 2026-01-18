# Pre-Flight Smoke Test - Complete Guide

## 🎯 Purpose

Run 5 test missions through the complete Chimera pipeline (V1→V4) and monitor for Trauma signals:
- **CAPTCHA_AGENT_FAILURE**: Autonomous agent failed to solve a visual challenge
- **NEEDS_OLMOCR_VERIFICATION**: Vision confidence consistently fell below 0.95
- **TIMEOUT**: Missions exceeding SMOKE_RESULTS_TIMEOUT (120s default)

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Start all services with infrastructure
docker compose up

# In another terminal, run smoke test
SMOKE_RESULTS_TIMEOUT=120 python3 scripts/preflight_smoke_test.py

# View logs
docker compose logs -f chimera-core
docker compose logs -f chimera-brain
```

### Option 2: Local Services (No Docker)

```bash
# Terminal 1: Redis
redis-server

# Terminal 2: PostgreSQL (if needed)
# brew services start postgresql@15

# Terminal 3: Chimera Brain
cd chimera_brain && python3 server.py

# Terminal 4: Chimera Core
cd chimera-core && python3 main.py

# Terminal 5: Smoke Test
REDIS_URL=redis://localhost:6379 \
CHIMERA_BRAIN_HTTP_URL=http://localhost:8080 \
SCRAPEGOAT_URL=http://localhost:8000 \
SMOKE_RESULTS_TIMEOUT=120 \
python3 scripts/preflight_smoke_test.py
```

### Option 3: Railway Production

```bash
# Use production URLs from .env
export REDIS_URL=redis://default:...@redis.railway.internal:6379
export CHIMERA_BRAIN_HTTP_URL=https://chimera-brain-v1-production.up.railway.app
export SCRAPEGOAT_URL=https://scrapegoat-production-8d0a.up.railway.app

python3 scripts/preflight_smoke_test.py
```

---

## 📊 Expected Output

### ✅ Clean Run (No Trauma)

```
Pre-Flight Smoke Test – 5 leads through chimera:missions (V4)

Redis: OK
Chimera Brain: OK
Scrapegoat: OK

Pushing 5 deep_search missions to chimera:missions…
  queued smoke_preflight_1768768892_0
  queued smoke_preflight_1768768892_1
  queued smoke_preflight_1768768892_2
  queued smoke_preflight_1768768892_3
  queued smoke_preflight_1768768892_4

Waiting on chimera:results (timeout=120s each)…
  smoke_preflight_1768768892_0: OK (status=completed, vision_confidence=0.87)
  smoke_preflight_1768768892_1: OK (status=completed, vision_confidence=0.91)
  smoke_preflight_1768768892_2: NEEDS_OLMOCR_VERIFICATION (vision_confidence=0.89)
  smoke_preflight_1768768892_3: OK (status=completed, vision_confidence=0.96)
  smoke_preflight_1768768892_4: OK (status=completed, vision_confidence=0.92)

============================================================
FINAL REVIEW – Trauma payloads (resilience signals):

  {
    "event": "NEEDS_OLMOCR_VERIFICATION",
    "mission_id": "smoke_preflight_1768768892_2",
    "vision_confidence": 0.89,
    "signal": "vision confidence fell below 0.95"
  }

By signal: {"NEEDS_OLMOCR_VERIFICATION": 1}

Total: 1 trauma(s). Fix before production.
```

### ❌ Infrastructure Failure

```
Pre-Flight Smoke Test – 5 leads through chimera:missions (V4)

[TRAUMA] Redis: [Errno 61] Connection refused
Redis: FAIL
[TRAUMA] Chimera Brain /health: <urlopen error [Errno 61] Connection refused>
Chimera Brain: FAIL
[TRAUMA] Scrapegoat /health: <urlopen error [Errno 61] Connection refused>
Scrapegoat: FAIL
Abort: Redis: [Errno 61] Connection refused
```

### ⏱️ Worker Not Running (TIMEOUT)

```
Waiting on chimera:results (timeout=120s each)…
  smoke_preflight_1768768892_0: TIMEOUT (exceeded 120s; Core may not be consuming)
  smoke_preflight_1768768892_1: TIMEOUT (exceeded 120s; Core may not be consuming)
  smoke_preflight_1768768892_2: TIMEOUT (exceeded 120s; Core may not be consuming)
  smoke_preflight_1768768892_3: TIMEOUT (exceeded 120s; Core may not be consuming)
  smoke_preflight_1768768892_4: TIMEOUT (exceeded 120s; Core may not be consuming)

============================================================
FINAL REVIEW – Trauma payloads (resilience signals):

  {
    "event": "TIMEOUT",
    "mission_id": "smoke_preflight_1768768892_0",
    "key": "chimera:results:smoke_preflight_1768768892_0",
    "timeout_s": 120,
    "signal": "mission exceeded SMOKE_RESULTS_TIMEOUT"
  }
  ... (4 more)

By signal: {"TIMEOUT": 5}

Total: 5 trauma(s). Fix before production.
```

### 🚨 CAPTCHA Agent Failure

```
  smoke_preflight_1768768892_2: CAPTCHA_AGENT_FAILURE (failed, captcha_solved=False)

============================================================
FINAL REVIEW – Trauma payloads (resilience signals):

  {
    "event": "CAPTCHA_AGENT_FAILURE",
    "mission_id": "smoke_preflight_1768768892_2",
    "captcha_solved": false,
    "status": "failed",
    "signal": "autonomous agent failed to solve challenge"
  }

By signal: {"CAPTCHA_AGENT_FAILURE": 1}

Total: 1 trauma(s). Fix before production.
```

---

## 🔍 Troubleshooting

### Redis Connection Refused

```bash
# Start Redis locally
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### Chimera Brain Connection Refused

```bash
# Check if Python dependencies are installed
cd chimera_brain
pip install -r requirements.txt

# Generate proto files
bash generate_proto.sh

# Start server
python3 server.py
```

### Chimera Core Not Consuming

```bash
# Check queue length
redis-cli LLEN chimera:missions

# Should decrease as Core processes missions
# If stuck at 15 (or increasing), Core is not running or has errors

# Start Core
cd chimera-core
pip install -r requirements.txt
bash generate_proto.sh
python3 main.py
```

### Check Container Health (Docker)

```bash
# View all containers
docker compose ps

# Check specific service logs
docker compose logs chimera-brain --tail 50
docker compose logs chimera-core --tail 50
docker compose logs scrapegoat --tail 50

# Restart a failed service
docker compose restart chimera-brain
```

---

## 📋 Environment Variables

For local Docker runs, create `.env.local` or export:

```bash
# Minimal for smoke test
export REDIS_URL=redis://redis:6379
export DATABASE_URL=postgresql://postgres:postgres@postgres:5432/railway
export CAPSOLVER_API_KEY=your-key
export OPENAI_API_KEY=your-key

# For production smoke test (Railway)
export REDIS_URL=redis://default:...@redis.railway.internal:6379
export CHIMERA_BRAIN_HTTP_URL=https://chimera-brain-v1-production.up.railway.app
export SCRAPEGOAT_URL=https://scrapegoat-production-8d0a.up.railway.app
```

---

## 🎯 What the Test Validates

1. **Redis queue operations** (LPUSH to `chimera:missions`, BRPOP from `chimera:results`)
2. **Chimera Core worker consumption** (15 missions → should decrease)
3. **Vision processing** (confidence scores; olmOCR trigger when < 0.95)
4. **CAPTCHA handling** (Tier 2 VLM agent + Tier 3 Capsolver fallback)
5. **Mission timeout resilience** (120s default; adjust with SMOKE_RESULTS_TIMEOUT)

---

## 🚨 Current Queue Status

```bash
redis-cli LLEN chimera:missions
# Output: 15 (5 smoke test + 10 bootstrap missions waiting)
```

The test missions are already queued. When you start Chimera Core, it will consume them immediately and push results to `chimera:results:{mission_id}`. Re-running the smoke test will queue 5 more missions (total 20 in queue).
