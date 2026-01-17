# Railway Configuration Review - All Services

## ✅ Configuration Status

### 1. **chimera_brain/railway.toml**
- ✅ Builder: `NIXPACKS` (correct)
- ✅ Start Command: `python server.py` (correct)
- ✅ Ports: `8080` (HTTP healthcheck), `50051` (gRPC)
- ✅ Healthcheck: `/health` (correct)
- ⚠️ **Note:** No explicit `buildCommand` - Nixpacks auto-detects Python and installs from `requirements.txt`
- ✅ Added `[environments.production]` section for consistency

### 2. **chimera-core/railway.toml**
- ✅ Builder: `NIXPACKS` (correct)
- ✅ Build Command: `pip install -r requirements.txt && playwright install chromium` (correct)
- ✅ Start Command: `python3 main.py` (correct)
- ✅ Healthcheck: `/health` (correct)
- ✅ Environment: `CHIMERA_BRAIN_ADDRESS` set correctly
- ✅ Added comment about watch paths (new builder ignores them)

### 3. **scrapegoat/railway.toml**
- ✅ Builder: `NIXPACKS` (correct)
- ✅ Build Command: `pip install -r requirements.txt && playwright install chromium` (correct)
- ✅ Start Command: **Removed** (set per-service in Dashboard)
  - **scrapegoat (main):** `python3 main.py` (Dashboard)
  - **scrapegoat-worker-swarm:** `python start_redis_worker.py` (Dashboard)
- ✅ Healthcheck: `/health` (correct)
- ✅ Port: `8080` (correct)
- ✅ Watch Patterns: `scrapegoat/**` (documented, but new builder ignores - set in Dashboard)

### 4. **scrapegoat/railway.worker.toml**
- ✅ Builder: `NIXPACKS` (correct)
- ✅ Build Command: `pip install -r requirements.txt && playwright install chromium` (correct)
- ✅ Start Command: `python start_redis_worker.py` (correct for worker)
- ✅ No healthcheck (correct - worker doesn't expose HTTP)
- ✅ Watch Patterns: `scrapegoat/**` (documented, but new builder ignores - set in Dashboard)
- ⚠️ **Note:** Railway may not auto-detect `railway.worker.toml` - Dashboard configuration is still required

### 5. **brainscraper/railway.toml**
- ✅ Builder: `DOCKERFILE` (correct for Next.js)
- ✅ Watch Patterns: `brainscraper/**` (documented, but new builder ignores - set in Dashboard)
- ✅ Healthcheck: `/` (correct)
- ✅ Environment: `NODE_ENV=production` (correct)

---

## 🎯 Key Configuration Patterns

### Python Services (chimera_brain, chimera-core, scrapegoat)
- **Builder:** `NIXPACKS`
- **Build Command:** `pip install -r requirements.txt && playwright install chromium` (if Playwright needed)
- **Start Command:** Service-specific (see below)
- **Environment:** `PYTHONUNBUFFERED = "1"` (required for Railway logs)

### Start Commands by Service
| Service | Start Command | File |
|---------|-------------|------|
| **chimera_brain** | `python server.py` | `server.py` |
| **chimera-core** | `python3 main.py` | `main.py` |
| **scrapegoat (main)** | `python3 main.py` | `main.py` (Dashboard) |
| **scrapegoat-worker-swarm** | `python start_redis_worker.py` | `start_redis_worker.py` (Dashboard) |

### Port Configuration
| Service | HTTP Port | gRPC Port | Notes |
|---------|-----------|-----------|-------|
| **chimera_brain** | `8080` | `50051` | Dual port (HTTP + gRPC) |
| **chimera-core** | `8080` | - | HTTP healthcheck only |
| **scrapegoat** | `8080` | - | FastAPI server |
| **brainscraper** | `3000` | - | Next.js server |

---

## ⚠️ Critical Dashboard Settings

### Watch Paths (New Builder Requirement)
**Railway's new builder ignores `watchPatterns` in `railway.toml`!**

All services must have Watch Paths set in Railway Dashboard:

| Service | Watch Path (Dashboard) |
|---------|----------------------|
| **chimera_brain** | `chimera_brain/**` |
| **chimera-core** | `chimera-core/**` |
| **scrapegoat** | `scrapegoat/**` |
| **scrapegoat-worker-swarm** | `scrapegoat/**` |
| **brainscraper** | `brainscraper/**` |

### Root Directories (Dashboard)
| Service | Root Directory |
|---------|---------------|
| **chimera_brain** | `chimera_brain` (underscore!) |
| **chimera-core** | `chimera-core` (hyphen) |
| **scrapegoat** | `scrapegoat` |
| **scrapegoat-worker-swarm** | `scrapegoat` |
| **brainscraper** | `brainscraper` |

### Start Commands (Dashboard Override)
| Service | Start Command (Dashboard) |
|---------|--------------------------|
| **chimera_brain** | `python server.py` (from railway.toml) |
| **chimera-core** | `python3 main.py` (from railway.toml) |
| **scrapegoat** | `python3 main.py` (Dashboard override) |
| **scrapegoat-worker-swarm** | `python start_redis_worker.py` (Dashboard override) |
| **brainscraper** | `npm start` (auto-detected) |

---

## ✅ Verification Checklist

After configuration, verify each service:

1. **chimera_brain:**
   ```bash
   curl http://chimera-brain-url/health
   # Should return: {"status":"healthy","service":"chimera-brain"}
   ```

2. **chimera-core:**
   ```bash
   railway logs --service chimera-core --tail 20
   # Should show: "✅ Connected to The Brain" or health server running
   ```

3. **scrapegoat:**
   ```bash
   curl http://scrapegoat-url/health
   # Should return: {"status":"healthy"}
   ```

4. **scrapegoat-worker-swarm:**
   ```bash
   railway logs --service scrapegoat-worker-swarm --tail 20
   # Should show: "🚀 SCRAPEGOAT TRI-CORE SYSTEM" (NOT FastAPI server)
   ```

5. **brainscraper:**
   ```bash
   curl http://brainscraper-url/
   # Should return: Next.js HTML page
   ```

---

## 🚨 Common Issues

### Issue 1: Services Skipped ("No changes to watched files")
**Cause:** Watch paths not set in Dashboard (new builder ignores `watchPatterns` in `railway.toml`)
**Fix:** Set Watch Paths in Railway Dashboard for each service

### Issue 2: Wrong Start Command
**Cause:** Dashboard using default or wrong command
**Fix:** Set custom Start Command in Railway Dashboard per service

### Issue 3: Port Mismatch (502 errors)
**Cause:** Public Networking Port in Dashboard doesn't match service's `PORT` env var
**Fix:** Set Public Networking → Port to match service's `PORT` env var

### Issue 4: Root Directory Wrong
**Cause:** Root Directory in Dashboard is empty or wrong
**Fix:** Set Root Directory in Dashboard to service's subdirectory (e.g., `chimera_brain`, not root)

---

## 📝 Summary

All `railway.toml` files are now standardized and correct. However, **Railway Dashboard configuration is still required** for:
- Watch Paths (new builder ignores `watchPatterns` in config)
- Start Commands (for services that need overrides)
- Root Directories (must match service subdirectory)
- Public Networking Ports (must match `PORT` env vars)
