# Watch Paths Fix - Use Explicit Paths

## The Issue

Railway says **"No changes to watched files"** even with `watchPatterns = ["**"]` in railway.toml.

## Root Cause

**Watch paths are ALWAYS evaluated from repository root, not root directory!**

According to Railway docs:
- Watch paths are evaluated from `/` (repository root)
- Even if Root Directory is `scrapegoat`, watch paths still use repo root
- Pattern `**` should work, but explicit paths are more reliable

## The Fix

Changed `watchPatterns` from:
```toml
watchPatterns = ["**"]  # Too broad, might be ignored
```

To:
```toml
watchPatterns = ["scrapegoat/**"]  # Explicit path from repo root
```

## Why This Should Work

- Watch paths evaluated from repo root: ✅
- Pattern `scrapegoat/**` matches: `scrapegoat/main.py`, `scrapegoat/start_redis_worker.py`, etc. ✅
- More explicit than `**` which might be filtered by Railway ✅

## Important Note

**This only works if Railway is using LEGACY builder!**

If Railway is using NEW builder:
- `watchPatterns` in railway.toml are IGNORED ❌
- Watch paths MUST be set in Dashboard ✅

## Next Steps

1. **If this commit triggers deployment:** Legacy builder is working, explicit paths help
2. **If still skipped:** New builder is being used, must set watch paths in Dashboard

## Dashboard Configuration (If Still Skipped)

Railway Dashboard → scrapegoat → Settings → Build:
- **Watch Paths:** Set to `scrapegoat/**` (explicit path)
- **Save**

Railway Dashboard → scrapegoat-worker-swarm → Settings → Build:
- **Watch Paths:** Set to `scrapegoat/**` (explicit path)
- **Save**
