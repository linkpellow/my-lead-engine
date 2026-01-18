# Railway Docker Deployment Guide

**Status:** All services configured for Docker builds  
**Date:** 2026-01-18

---

## 🐳 Docker Configuration Complete

All services now use **Dockerfile-based builds** instead of Nixpacks. Railway will automatically detect the Dockerfiles and build accordingly.

---

## 📋 Service Configuration

### **1. Chimera Brain**

**Root Directory:** `chimera_brain`  
**Dockerfile:** `chimera_brain/Dockerfile`  
**Railway Config:** `chimera_brain/railway.toml`

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "python server.py"
healthcheckPath = "/health"
```

**Ports:**
- HTTP: 8080 (healthcheck)
- gRPC: 50051 (internal service)

**Environment Variables:**
- `PORT=8080`
- `CHIMERA_BRAIN_PORT=50051`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `USE_2026_VISION=1`
- `VLM_TIER=hybrid`

---

### **2. Chimera Core**

**Root Directory:** `chimera-core`  
**Dockerfile:** `chimera-core/Dockerfile`  
**Railway Config:** `chimera-core/railway.toml`

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
watchPatterns = ["**"]

[deploy]
startCommand = "python main.py"
```

**No exposed ports** (worker service)

**Environment Variables:**
- `CHIMERA_BRAIN_ADDRESS=http://chimera-brain.railway.internal:50051`
- `REDIS_URL`
- `DATABASE_URL`
- `SCRAPEGOAT_URL`
- `CAPSOLVER_API_KEY`
- `DECODO_API_KEY`
- `DECODO_USER`
- `CHROMIUM_CHANNEL=chrome`
- `CHROMIUM_USE_NATIVE_TLS=1`
- `CHROME_UA_VERSION=142.0.0.0`
- `CHROME_UA_PLATFORM=Windows`

---

### **3. Scrapegoat**

**Root Directory:** `scrapegoat`  
**Dockerfile:** `scrapegoat/Dockerfile`  
**Railway Config:** `scrapegoat/railway.toml`

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
watchPatterns = ["**"]

[deploy]
startCommand = "python main.py"
healthcheckPath = "/health"
```

**Port:** 8000

**Environment Variables:**
- `REDIS_URL`
- `APP_REDIS_URL` (same as REDIS_URL)
- `DATABASE_URL`
- `APP_DATABASE_URL` (same as DATABASE_URL)
- `PORT=8000`
- `OPENAI_API_KEY`
- `CENSUS_API_KEY`
- `RAPIDAPI_KEY`
- `TELNYX_API_KEY`
- `USHA_JWT_TOKEN`

**Worker Service:**
For `scrapegoat-worker-swarm` service, override startCommand:
```bash
startCommand = "python start_redis_worker.py"
```

---

### **4. BrainScraper**

**Root Directory:** `brainscraper`  
**Dockerfile:** `brainscraper/Dockerfile`  
**Railway Config:** `brainscraper/railway.toml`

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
watchPatterns = ["**"]

[deploy]
startCommand = "npm start"
healthcheckPath = "/"
```

**Port:** 3000

**Environment Variables:**
- `NODE_ENV=production`
- `NEXT_TELEMETRY_DISABLED=1`
- `REDIS_URL`
- `DATABASE_URL`
- `NEXT_PUBLIC_BASE_URL`
- `DATA_DIR=/data`
- API keys (RAPIDAPI_KEY, USHA_JWT_TOKEN, etc.)

---

## 🔧 Railway Dashboard Configuration

For each service in the Railway dashboard:

### **Required Settings:**

1. **Root Directory**
   - Chimera Brain: `chimera_brain`
   - Chimera Core: `chimera-core`
   - Scrapegoat: `scrapegoat`
   - BrainScraper: `brainscraper`

2. **Build Settings**
   - Builder: Auto-detected (Dockerfile)
   - No need to set manually (Railway detects Dockerfile)

3. **Watch Paths** (Optional, set in Dashboard)
   - Each service: `{service_directory}/**`
   - Prevents cross-service rebuilds

4. **Environment Variables**
   - Set all required env vars per service (see above)
   - Use Railway shared variables: `${{redis.REDIS_URL}}`

---

## 🚀 Deployment Commands

### **Deploy All Services**

```bash
# From project root
railway up --service chimera-brain
railway up --service chimera-core
railway up --service scrapegoat
railway up --service brainscraper
```

### **Deploy Specific Service**

```bash
# Navigate to service directory
cd chimera-core
railway up

# Or from root with service flag
railway up --service chimera-core
```

### **Force Rebuild**

```bash
# Trigger rebuild by committing a change
git commit --allow-empty -m "Force Railway rebuild"
git push origin main
```

---

## 🔍 Verify Docker Builds

### **Check Build Logs**

```bash
# View logs during deployment
railway logs --deployment <deployment-id>

# Or in dashboard:
# Project → Service → Deployments → Click deployment → View logs
```

### **Expected Docker Build Steps:**

**Chimera Brain:**
```
Step 1/8 : FROM python:3.11-slim
Step 2/8 : WORKDIR /app
Step 3/8 : COPY requirements.txt .
Step 4/8 : RUN pip install --no-cache-dir -r requirements.txt
Step 5/8 : COPY . .
Step 6/8 : RUN bash generate_proto.sh 2>/dev/null || true
Step 7/8 : EXPOSE 8080 50051
Step 8/8 : CMD ["python", "server.py"]
```

**Chimera Core:**
```
Step 1/12 : FROM python:3.12-slim
Step 2/12 : RUN apt-get update && apt-get install -y ...
Step 3/12 : WORKDIR /app
Step 4/12 : COPY requirements.txt .
Step 5/12 : RUN pip install --no-cache-dir -r requirements.txt
Step 6/12 : RUN playwright install-deps chromium
Step 7/12 : RUN playwright install chromium
Step 8/12 : COPY . .
Step 9/12 : RUN bash ./generate_proto.sh || echo "Warning: Proto generation skipped"
Step 10/12 : CMD ["python", "main.py"]
```

---

## ⚠️ Important Notes

### **1. Proto File Generation**

Both Chimera Brain and Chimera Core generate gRPC proto stubs during Docker build:
```bash
RUN bash ./generate_proto.sh || echo "Warning: Proto generation skipped"
```

If this fails, check:
- `generate_proto.sh` has correct permissions
- `grpcio-tools` is in `requirements.txt`
- `.proto` file exists in the service directory

### **2. Playwright Browser Installation**

Chimera Core and Scrapegoat install Chromium during build:
```bash
RUN playwright install-deps chromium
RUN playwright install chromium
```

This adds ~200MB to the image but is required for stealth browser automation.

### **3. Service Dependencies**

Start order (Railway handles this with internal DNS):
1. Redis (infrastructure)
2. PostgreSQL (infrastructure)
3. Chimera Brain (gRPC server)
4. Scrapegoat (API + worker)
5. Chimera Core (depends on Brain + Scrapegoat)
6. BrainScraper (UI, depends on Scrapegoat + Redis)

### **4. Root railway.toml (Legacy)**

The root `railway.toml` is no longer used. Each service has its own config:
- `chimera-core/railway.toml`
- `chimera_brain/railway.toml`
- `scrapegoat/railway.toml`
- `brainscraper/railway.toml`

---

## 🧪 Local Testing

Test Docker builds locally before deploying:

```bash
# Build individual service
cd chimera-core
docker build -t chimera-core:test .

# Or use docker-compose
cd /path/to/project
docker compose build
docker compose up
```

---

## 📊 Expected Build Times

| Service | Build Time | Image Size |
|---------|-----------|------------|
| Chimera Brain | ~3-5 min | ~2.5 GB |
| Chimera Core | ~5-7 min | ~3.2 GB (Playwright + deps) |
| Scrapegoat | ~5-7 min | ~3.0 GB (Playwright + deps) |
| BrainScraper | ~2-3 min | ~500 MB |

**First build is slower** (downloads base images). Subsequent builds use cache.

---

## ✅ Verification Checklist

After deployment:

- [ ] All services show "Active" in Railway dashboard
- [ ] Health checks passing (Chimera Brain, Scrapegoat, BrainScraper)
- [ ] gRPC connection works: `chimera-brain.railway.internal:50051`
- [ ] Redis accessible: `redis.railway.internal:6379`
- [ ] PostgreSQL accessible: `postgres.railway.internal:5432`
- [ ] Check logs for errors: `railway logs --service <name> --tail 50`
- [ ] Test smoke test: `python scripts/preflight_smoke_test.py`

---

## 🚨 Troubleshooting

### **Build Fails: "Dockerfile not found"**

**Cause:** Root Directory not set correctly in Railway dashboard

**Fix:** 
- Go to Railway dashboard
- Service Settings → Root Directory
- Set to: `chimera-core`, `chimera_brain`, `scrapegoat`, or `brainscraper`

### **Build Fails: "Proto generation failed"**

**Cause:** `generate_proto.sh` doesn't have execute permissions or proto file missing

**Fix:**
```bash
chmod +x generate_proto.sh
git add generate_proto.sh
git commit -m "Fix proto script permissions"
git push
```

### **Runtime Error: "Module not found"**

**Cause:** Dependencies not installed during build

**Fix:** Check `requirements.txt` or `package.json` is copied before `RUN pip install` / `RUN npm install`

### **Playwright Error: "Browser not found"**

**Cause:** Playwright browsers not installed or deps missing

**Fix:** Ensure Dockerfile includes:
```dockerfile
RUN playwright install-deps chromium
RUN playwright install chromium
```

---

## 📚 Related Documentation

- **Docker Compose:** `docker-compose.yml` (local development)
- **Smoke Test:** `SMOKE_TEST_INSTRUCTIONS.md`
- **System Overview:** `SOVEREIGN_SYSTEM_COMPLETE.md`
- **Architecture:** `.cursor/rules/000-mission-alpha.mdc`
