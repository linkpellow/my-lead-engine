# Railway Root Directory Fix - BrainScraper Build Error

**Date:** 2026-01-18  
**Error:** `"/package.json": not found`  
**Root Cause:** Railway build context is at **repository root**, not `brainscraper/` subdirectory

---

## 🐛 Problem

**Build Error:**
```
ERROR: failed to build: failed to solve: failed to compute cache key: 
failed to calculate checksum of ref: "/package.json": not found
```

**What's Happening:**
1. Railway's `railway.toml` is in `brainscraper/railway.toml`
2. Railway's Dockerfile is in `brainscraper/Dockerfile`
3. **But Railway's build context is at the repo root** (`/Users/linkpellow/Desktop/my-lead-engine/`)
4. Dockerfile tries `COPY package.json ./` but `package.json` is at `brainscraper/package.json`, not repo root

**Why:**
- Railway CLI's `railway up` uses the repository root as build context by default
- The `railway.toml` location doesn't automatically set the build context root
- **Root Directory must be configured in Railway's dashboard**

---

## ✅ Solution 1: Set Root Directory in Railway Dashboard (RECOMMENDED)

### **Step-by-Step:**

1. **Open Railway Dashboard:**
   ```
   https://railway.app/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
   ```

2. **Select BrainScraper Service:**
   - Click on the `brainscraper` service card

3. **Go to Service Settings:**
   - Click "Settings" tab
   - Scroll to "Build" section

4. **Set Root Directory:**
   - Find **"Root Directory"** field
   - Enter: `brainscraper`
   - Click "Save"

5. **Redeploy:**
   ```bash
   cd /Users/linkpellow/Desktop/my-lead-engine/brainscraper
   railway up --service brainscraper
   ```

**Expected Behavior After Fix:**
- Build context will be at `brainscraper/` directory
- `COPY package.json ./` will find `brainscraper/package.json`
- Build will succeed

---

## ✅ Solution 2: Modify Dockerfile to Work from Repo Root (ALTERNATIVE)

If you can't access the Railway dashboard, modify the Dockerfile to copy from repo root:

### **Updated Dockerfile:**

```dockerfile
# BrainScraper: Next.js LinkedIn Lead Generation UI
# Railway Root Directory: NOT SET (builds from repo root)
# Build context is at repository root
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files from brainscraper/ subdirectory
COPY brainscraper/package.json ./
COPY brainscraper/package-lock.json* ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm install --legacy-peer-deps

# Copy application code from brainscraper/ subdirectory
COPY brainscraper/ .

# Build the application
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --production --legacy-peer-deps || true

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
```

**Changes:**
- `COPY package.json ./` → `COPY brainscraper/package.json ./`
- `COPY package-lock.json* ./` → `COPY brainscraper/package-lock.json* ./`
- `COPY . .` → `COPY brainscraper/ .`

**Trade-off:**
- ✅ Works without Railway dashboard access
- ❌ Less clean (Dockerfile references parent directory)
- ❌ Build context includes entire repo (slower)

---

## 🔍 Verification: Check Current Root Directory

### **Via Railway Dashboard:**
1. Open service settings
2. Check "Root Directory" field
3. Should be: `brainscraper`

### **Via Build Logs:**
Look for these indicators in build logs:

**If Root Directory is SET correctly:**
```
context: brainscraper/
[3/8] COPY package.json ./
✅ Successfully copied package.json
```

**If Root Directory is NOT set (current error):**
```
context: ./
[3/8] COPY package.json ./
❌ ERROR: "/package.json": not found
```

---

## 📋 Apply the Fix

### **Option A: Railway Dashboard (Recommended)**

```bash
# 1. Set Root Directory in Railway dashboard to: brainscraper
# 2. Then redeploy:
cd /Users/linkpellow/Desktop/my-lead-engine/brainscraper
railway up --service brainscraper
```

### **Option B: Modify Dockerfile (If dashboard unavailable)**

```bash
# Apply the modified Dockerfile above, then:
cd /Users/linkpellow/Desktop/my-lead-engine/brainscraper
railway up --service brainscraper
```

---

## ⚠️ Why Railway CLI Doesn't Set Root Directory

**Railway CLI Behavior:**
- `railway up` command uses **current working directory** as upload base
- But **build context** is always at the detected repository root
- `railway.toml` location doesn't affect build context
- **Root Directory is a service-level setting in the dashboard**

**Workaround:**
- Set Root Directory in dashboard once
- Future deploys will use the correct root
- OR use the modified Dockerfile approach

---

## 🎯 Expected Result After Fix

**Build Logs:**
```
[Region: us-west1]
=========================
Using Detected Dockerfile
=========================
context: brainscraper/
[1/8] FROM docker.io/library/node:20-slim
[2/8] WORKDIR /app
[3/8] COPY package.json ./
✅ Successfully copied package.json
[4/8] COPY package-lock.json* ./
✅ Successfully copied package-lock.json
[5/8] RUN npm install --legacy-peer-deps
✅ Dependencies installed
[6/8] COPY . .
✅ Application code copied
[7/8] RUN npm run build
✅ Build complete
[8/8] RUN npm prune --production --legacy-peer-deps || true
✅ Dev dependencies pruned
Successfully built!
```

**Runtime Logs:**
```
Starting Container

> brainscraper.io@1.0.0 start
> node server.js

🚀 Starting Next.js server on 0.0.0.0:3000
✅ Next.js app prepared successfully
🎉 Server ready on http://0.0.0.0:3000
```

---

## 📚 Related Issues

### **Same Issue for Other Services?**

**Check these services also need Root Directory set:**

| Service | Root Directory Should Be |
|---------|--------------------------|
| **brainscraper** | `brainscraper` |
| **scrapegoat** | `scrapegoat` |
| **chimera-core** | `chimera-core` |
| **chimera_brain** | `chimera_brain` |

**Verify in Dashboard:**
1. Open each service's Settings
2. Check "Root Directory" field
3. Set to the service's subdirectory name
4. Save and redeploy

---

## 🔧 Quick Reference

**Set Root Directory in Railway:**
```
Dashboard → Service → Settings → Build → Root Directory
Enter: brainscraper
Save
```

**Or update Dockerfile to work from repo root:**
```dockerfile
COPY brainscraper/package.json ./
COPY brainscraper/package-lock.json* ./
COPY brainscraper/ .
```

**Then redeploy:**
```bash
railway up --service brainscraper
```

---

## 🎯 Action Required

**Choose one approach:**

1. **Set Root Directory in Railway Dashboard** (recommended)
   - Go to: https://railway.app/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
   - Service: `brainscraper` → Settings → Root Directory → `brainscraper`
   - Redeploy

2. **Use Modified Dockerfile** (if dashboard unavailable)
   - Apply the Dockerfile changes above
   - Redeploy via `railway up`

**After applying either fix, BrainScraper should build successfully.**
