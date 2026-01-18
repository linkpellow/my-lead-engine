# brainscraper Build Fix - Dockerfile → Nixpacks

## 🔴 Problem

**Error:** `npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '/app/package.json'`

**Root Cause:** Railway's Dockerfile builder has build context issues when Root Directory is set to `brainscraper/`. The Dockerfile expects `package.json` in the build context, but Railway might be using repo root as build context.

---

## ✅ Solution Applied

**Changed:** `brainscraper/railway.toml`
```toml
[build]
builder = "NIXPACKS"  # Changed from "DOCKERFILE"
```

**Why Nixpacks:**
- ✅ Automatically detects `package.json` in Root Directory (`brainscraper/`)
- ✅ Handles monorepo structures correctly
- ✅ No build context configuration needed
- ✅ Simpler and more reliable for monorepos

---

## Verification

**Deployment triggered:**
```bash
railway up --service brainscraper --detach
```

**Build Logs:** https://railway.com/project/.../service/756137d8-600e-4428-b058-6550ad489e0d

**Expected:**
- ✅ Nixpacks detects `package.json` in `brainscraper/`
- ✅ Build proceeds successfully
- ✅ No "package.json not found" errors

---

## Why Dockerfile Failed

**Dockerfile Build Process:**
1. Railway detects Dockerfile in `brainscraper/`
2. Build context should be `brainscraper/` (when Root Directory is set)
3. But Railway might be using repo root as build context
4. `COPY package*.json ./` fails because `package.json` is in `brainscraper/`, not root

**Nixpacks Build Process:**
1. Railway detects `package.json` in Root Directory (`brainscraper/`)
2. Automatically uses correct build context
3. No manual configuration needed

---

## Next Steps

1. **Monitor build logs** - Verify Nixpacks build succeeds
2. **If build succeeds:** Service should deploy correctly
3. **If build fails:** Check build logs for specific errors

---

## Alternative: Keep Dockerfile

If you want to keep Dockerfile, you must:
1. **Verify Root Directory in Dashboard:**
   - Settings → General → Root Directory = `brainscraper`
   - Save

2. **Add dockerfilePath to railway.toml:**
   ```toml
   [build]
   builder = "DOCKERFILE"
   dockerfilePath = "Dockerfile"  # Relative to Root Directory
   ```

3. **If still failing:** Railway might have a bug with Dockerfile + Root Directory. Use Nixpacks instead.

---

## Recommendation

**Use Nixpacks for monorepo services** - it handles Root Directory automatically and is simpler to configure.
