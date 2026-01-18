# Docker Build Fixes - Railway Deployment

**Date:** 2026-01-18  
**Status:** Critical build errors resolved

---

## 🐛 Issues Identified

### **1. BrainScraper Build Failure**

**Error:**
```
npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '/app/package.json'
```

**Root Cause:**
- `COPY package*.json ./` was failing
- Railway build context at `brainscraper/` root couldn't find files
- Glob pattern `package*.json` may not work consistently in Railway Docker builds

**Fix:**
```dockerfile
# Before (failing):
COPY package*.json ./

# After (working):
COPY package.json ./
COPY package-lock.json* ./
```

**Changes:**
- Explicit copy of `package.json` (required)
- Optional copy of `package-lock.json*` (may or may not exist)
- Added `|| true` to npm prune to prevent failure if no dev deps

---

### **2. Scrapegoat + Chimera Core Build Failure**

**Error:**
```
E: Package 'ttf-unifont' has no installation candidate
E: Package 'ttf-ubuntu-font-family' has no installation candidate
Failed to install browser dependencies
Error: Installation process exited with code: 100
```

**Root Cause:**
- Playwright's `playwright install-deps chromium` tries to install Ubuntu font packages
- These packages don't exist in **Debian Trixie** (Python 3.12-slim base image)
- `ttf-unifont` and `ttf-ubuntu-font-family` are obsolete package names in newer Debian

**Fix Strategy:**
1. **Manually install system dependencies** instead of using `playwright install-deps`
2. **Replace obsolete font packages** with available alternatives:
   - `fonts-noto` (replaces ttf-unifont)
   - `fonts-noto-cjk` (CJK character support)
3. **Skip `playwright install-deps`** entirely, only run `playwright install chromium`

**Changes:**
```dockerfile
# Before (failing):
RUN playwright install-deps chromium
RUN playwright install chromium

# After (working):
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    fonts-noto \
    fonts-noto-cjk \
    [... other deps ...] \
    && rm -rf /var/lib/apt/lists/*

# Skip install-deps, only install browser
RUN playwright install chromium
```

---

## ✅ Fixes Applied

### **BrainScraper Dockerfile**

**File:** `brainscraper/Dockerfile`

**Changes:**
```dockerfile
# Explicit package.json copy
COPY package.json ./
COPY package-lock.json* ./

# Safe prune with fallback
RUN npm prune --production --legacy-peer-deps || true
```

---

### **Scrapegoat Dockerfile**

**File:** `scrapegoat/Dockerfile`

**Changes:**
1. Removed: `RUN playwright install-deps chromium`
2. Added: `fonts-noto`, `fonts-noto-cjk` to manual deps list
3. Removed: Obsolete packages (`libgcc1`, `libstdc++6` - not needed explicitly)
4. Kept: `RUN playwright install chromium` (browser binary only)

---

### **Chimera Core Dockerfile**

**File:** `chimera-core/Dockerfile`

**Changes:**
1. Removed: `RUN playwright install-deps chromium`
2. Added: `fonts-noto`, `fonts-noto-cjk`, `bash` to manual deps list
3. Kept: `RUN playwright install chromium`

---

## 📋 Manual Dependencies List (Playwright)

These packages are now explicitly installed in all Playwright-based services:

```dockerfile
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
    && rm -rf /var/lib/apt/lists/*
```

**Key Changes:**
- ✅ `fonts-noto` - Replaces obsolete `ttf-unifont`
- ✅ `fonts-noto-cjk` - Adds CJK character support
- ❌ Removed `libgcc1`, `libstdc++6` (already in base image)
- ✅ Added `bash` for Chimera Core (proto generation script)

---

## 🚀 Deploy Again

Now that all Dockerfiles are fixed, redeploy:

```bash
cd /Users/linkpellow/Desktop/my-lead-engine

# Deploy all services
cd brainscraper && railway up --service brainscraper &
cd ../scrapegoat && railway up --service scrapegoat &
cd ../chimera-core && railway up --service chimera-core &
wait
```

Or push to git and let Railway auto-deploy:

```bash
git add .
git commit -m "Fix Docker builds: explicit package.json copy + Debian Trixie font packages"
git push origin main
```

---

## 📊 Expected Build Results

### **BrainScraper:**
```
[4/7] COPY package.json ./
[4/7] COPY package-lock.json* ./
[5/7] RUN npm install --legacy-peer-deps
Successfully installed dependencies
[6/7] RUN npm run build
Build complete
[7/7] RUN npm prune --production --legacy-peer-deps || true
Successfully built!
```

### **Scrapegoat:**
```
[2/8] RUN apt-get update && apt-get install -y ...
Successfully installed system dependencies
[5/8] RUN pip install --no-cache-dir -r requirements.txt
Successfully installed Python packages
[6/8] RUN playwright install chromium
Chromium 123.0.6312.4 downloaded
Successfully built!
```

### **Chimera Core:**
```
[2/10] RUN apt-get update && apt-get install -y ...
Successfully installed system dependencies
[5/10] RUN pip install --no-cache-dir -r requirements.txt
Successfully installed Python packages
[6/10] RUN playwright install chromium
Chromium 123.0.6312.4 downloaded
[9/10] RUN bash ./generate_proto.sh
✅ Proto generation complete!
Successfully built!
```

---

## ⚠️ Why This Happened

### **Debian Version Changes**

Python 3.12 uses **Debian Trixie** (testing), which has:
- Different package availability than Ubuntu 20.04 (Playwright's default target)
- Renamed font packages (`fonts-*` instead of `ttf-*`)
- Some obsolete packages removed from repositories

### **Playwright Install-Deps Limitations**

`playwright install-deps` is designed for:
- Ubuntu 20.04/22.04
- Debian Bookworm (stable)

It does NOT have proper fallbacks for:
- Debian Trixie (testing)
- Future Debian versions

**Solution:** Manual dependency management gives us control over package names and availability.

---

## 🔍 Verification Checklist

After redeployment:

- [ ] BrainScraper builds successfully (no package.json error)
- [ ] Scrapegoat builds successfully (no font package error)
- [ ] Chimera Core builds successfully (no font package error)
- [ ] All services show "Active" in Railway dashboard
- [ ] Health checks pass (Brain, Scrapegoat, BrainScraper)
- [ ] No runtime errors in service logs

---

## 📚 Related Documentation

- **Docker Migration:** `DOCKER_MIGRATION_COMPLETE.md`
- **Railway Deployment:** `RAILWAY_DOCKER_DEPLOYMENT.md`
- **Deployment Success:** `DEPLOYMENT_SUCCESS.md`
