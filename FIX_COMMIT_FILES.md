# Fix: Commit Essential Files for Railway Deployment

## Current Status
- Only **3 files** in `brainscraper/` are committed to git
- Railway cannot see uncommitted files
- Root Directory is set to `brainscraper/` but files aren't in the repo

## Immediate Action Required

You need to commit the essential files. Due to file system timeouts in the automated process, please do this manually:

### Option 1: Use Git GUI or IDE
1. Open your git client (GitHub Desktop, VS Code Source Control, etc.)
2. Navigate to `brainscraper/` directory
3. Stage and commit these essential files:
   - `railway.toml`
   - `nixpacks.toml` or `Dockerfile`
   - `server.js`
   - `tsconfig.json`
   - `tailwind.config.ts`
   - `postcss.config.mjs`
   - `middleware.ts`
   - `.eslintrc.json`
   - `.gitignore`
   - `app/` directory (all files)
   - `lib/` directory
   - `utils/` directory
   - `types/` directory
   - `public/` directory

### Option 2: Command Line (if file system allows)

```bash
cd /Users/linkpellow/Desktop/my-lead-engine

# Add configuration files one at a time
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

# Add application directories
git add brainscraper/app/
git add brainscraper/lib/
git add brainscraper/utils/
git add brainscraper/types/
git add brainscraper/public/

# Commit
git commit -m "Add essential files for Railway deployment"
```

### Option 3: If File System Issues Persist

If you continue to experience file system timeouts:

1. **Check disk space**: `df -h`
2. **Check file system health**: The timeouts suggest possible filesystem issues
3. **Try from a different location**: Copy files to a temporary directory, commit from there
4. **Use git sparse-checkout**: If the repo is too large

## Verification

After committing, verify:
```bash
git ls-files brainscraper/ | wc -l
# Should show significantly more than 3 files

git log --oneline -1
# Should show your commit
```

## Railway Configuration Check

Ensure in Railway Dashboard:
- **Root Directory**: `brainscraper`
- **Build Command**: (auto-detected, should be `npm run build`)
- **Start Command**: `npm start` (from package.json scripts)

The `brainscraper/railway.toml` file should contain:
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
healthcheckPath = "/"
healthcheckTimeout = 100
```

## Why This Is The Correct Approach

1. **Monorepo Structure**: This is a monorepo with multiple services
2. **Railway Best Practice**: Set Root Directory to service subdirectory
3. **Git Requirement**: Railway clones from GitHub, so files MUST be committed
4. **No Workarounds**: This is the standard, correct way to deploy monorepos on Railway

## Next Steps

1. Commit the essential files (using one of the options above)
2. Push to GitHub: `git push origin main`
3. Railway will automatically detect the new commit
4. Railway build should now find `package.json` and all dependencies
5. Deployment should succeed
