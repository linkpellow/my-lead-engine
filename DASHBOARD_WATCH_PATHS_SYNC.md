# Dashboard Watch Paths Sync - Permanent Fix

## 🎯 Objective

Set Watch Paths in Railway Dashboard to prevent "Skipped" deployments. Railway v2 builder ignores `watchPatterns` in `railway.toml`, so Dashboard configuration is required.

---

## 📋 Required Dashboard Configuration

### brainscraper

**Railway Dashboard → brainscraper → Settings → Build:**

1. Find **"Watch Paths"** field
2. Set to: `brainscraper/**`
3. Click **"Save"**

**Why:**
- Only triggers deployments when files in `brainscraper/` directory change
- Prevents unnecessary rebuilds when other services change
- Works with Railway v2 builder (unlike `railway.toml`)

---

### scrapegoat-worker-swarm

**Railway Dashboard → scrapegoat-worker-swarm → Settings → Build:**

1. Find **"Watch Paths"** field
2. Set to: `scrapegoat/**`
3. Click **"Save"**

**Why:**
- Only triggers deployments when files in `scrapegoat/` directory change
- Worker service should rebuild when scrapegoat code changes
- Works with Railway v2 builder (unlike `railway.toml`)

---

### scrapegoat (main)

**Railway Dashboard → scrapegoat → Settings → Build:**

1. Find **"Watch Paths"** field
2. Set to: `scrapegoat/**`
3. Click **"Save"**

**Why:**
- Main scrapegoat service should rebuild when scrapegoat code changes
- Works with Railway v2 builder (unlike `railway.toml`)

---

## ✅ Verification

After setting Watch Paths:

1. **Make a small change** to a file in watched directory:
   ```bash
   echo "# Test" >> scrapegoat/main.py
   git add scrapegoat/main.py
   git commit -m "test: trigger deployment"
   git push origin main
   ```

2. **Check Railway Dashboard → Deployments:**
   - ✅ Should show "Building..." (not "Skipped")
   - ✅ Deployment should trigger automatically

3. **If Still Skipped:**
   - Verify Watch Paths are saved in Dashboard
   - Check Root Directory is set correctly
   - Try temporary Watch Path: `**` (catches all changes)

---

## 📝 Notes

**Why Dashboard Configuration:**
- Railway v2 builder ignores `watchPatterns` in `railway.toml`
- Dashboard settings work with v2 builder
- This is a known limitation of Railway's new builder

**Watch Path Syntax:**
- `brainscraper/**` - Matches all files in `brainscraper/` and subdirectories
- `scrapegoat/**` - Matches all files in `scrapegoat/` and subdirectories
- `**` - Matches all files (temporary, for testing)

**Root Directory Interaction:**
- Watch paths are evaluated from repository root
- Root Directory setting doesn't affect watch path evaluation
- Both must be set correctly for deployments to work

---

## 🎯 Summary

**Required Actions:**
1. ✅ Set Watch Paths in Dashboard (manual step)
2. ✅ Verify Root Directory is correct
3. ✅ Test with a small change to verify auto-deploy works

**Result:**
- Automatic deployments from Git pushes will work
- No more "Skipped" status for watched services
- Services rebuild only when their code changes
