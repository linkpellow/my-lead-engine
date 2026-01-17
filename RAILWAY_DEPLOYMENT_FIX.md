# Railway Deployment Fix - Root Cause Analysis

## Problem Statement

Railway clones from GitHub and only sees **committed files**. Currently, only **3 files** in `brainscraper/` are committed:
- `brainscraper/next.config.ts` ✅
- `brainscraper/package.json` ✅  
- `brainscraper/package.json.minimal` ✅

## Root Cause

**Essential files are NOT committed to git**, so Railway cannot see them even with Root Directory set to `brainscraper/`.

## Required Files for Railway Deployment

### Configuration Files (MUST BE COMMITTED)
- `brainscraper/railway.toml` - Railway service configuration
- `brainscraper/nixpacks.toml` OR `brainscraper/Dockerfile` - Build configuration
- `brainscraper/tsconfig.json` - TypeScript configuration
- `brainscraper/tailwind.config.ts` - Tailwind CSS configuration
- `brainscraper/postcss.config.mjs` - PostCSS configuration
- `brainscraper/middleware.ts` - Next.js middleware
- `brainscraper/server.js` - Custom server (if using standalone mode)
- `brainscraper/.eslintrc.json` - ESLint configuration
- `brainscraper/.gitignore` - Git ignore rules

### Application Code (MUST BE COMMITTED)
- `brainscraper/app/` - Next.js app directory (all routes, components, API routes)
- `brainscraper/lib/` - Shared libraries
- `brainscraper/utils/` - Utility functions
- `brainscraper/types/` - TypeScript type definitions
- `brainscraper/public/` - Static assets

## Solution

### Step 1: Create Proper .gitignore

Create `brainscraper/.gitignore` to exclude:
- `node_modules/`
- `.next/`
- `.env*` files
- Build artifacts
- Test files
- CSV data files
- Documentation markdown files

### Step 2: Commit Essential Files

Run the provided script or manually commit:

```bash
# Configuration files
git add brainscraper/railway.toml
git add brainscraper/nixpacks.toml
git add brainscraper/Dockerfile
git add brainscraper/server.js
git add brainscraper/tsconfig.json
git add brainscraper/tailwind.config.ts
git add brainscraper/postcss.config.mjs
git add brainscraper/middleware.ts
git add brainscraper/.eslintrc.json
git add brainscraper/.gitignore

# Application code
git add brainscraper/app/
git add brainscraper/lib/
git add brainscraper/utils/
git add brainscraper/types/
git add brainscraper/public/
```

### Step 3: Railway Configuration

**In Railway Dashboard:**
1. Service Settings → Root Directory: `brainscraper`
2. Service Settings → Build Command: (auto-detected from package.json)
3. Service Settings → Start Command: `npm start` (or from railway.toml)

**railway.toml should be in `brainscraper/` directory:**
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
healthcheckPath = "/"
healthcheckTimeout = 100
```

## Verification

After committing, verify Railway can see the files:
1. Check Railway build logs - should see `package.json` detected
2. Build should proceed without "package.json not found" errors
3. Deployment should complete successfully

## Important Notes

1. **Railway clones from GitHub** - only committed files are available
2. **Root Directory** tells Railway where to look, but files must still be committed
3. **Monorepo structure** requires Root Directory to be set to the service subdirectory
4. **No workarounds needed** - this is the correct way to deploy a monorepo on Railway
