# Redis Connection Fix - scrapegoat-worker-swarm

## ✅ Fix Applied

### Variables Updated

**Command:** `railway variable set REDIS_URL='${{Redis.REDIS_URL}}' --service scrapegoat-worker-swarm`
**Command:** `railway variable set APP_REDIS_URL='${{Redis.REDIS_URL}}' --service scrapegoat-worker-swarm`

**Before:**
- `REDIS_URL`: `redis://:@:` (INVALID - empty)
- `APP_REDIS_URL`: `redis://:@:` (INVALID - empty)

**After:**
- `REDIS_URL`: `${{Redis.REDIS_URL}}` (Railway shared variable reference)
- `APP_REDIS_URL`: `${{Redis.REDIS_URL}}` (Railway shared variable reference)

---

## 🔍 Verification

### Logs Check
Monitor logs for Redis connection status:
```bash
railway logs --service scrapegoat-worker-swarm --tail 20
```

**Expected:**
- ✅ "Redis connection successful" (or similar success message)
- ❌ No more "Error 111 connecting to localhost:6379" errors

### Health Check
```bash
curl -f https://scrapegoat-production-8d0a.up.railway.app/health
```

**Expected:**
- ✅ `{"status":"healthy"}` (200 OK)

---

## 📋 Dashboard Watch Path Sync (Permanent Fix)

To prevent future "Skipped" deployments, set Watch Paths in Railway Dashboard:

### brainscraper
1. Railway Dashboard → **brainscraper** service
2. Settings → **Build** → **Watch Paths**
3. Set to: `brainscraper/**`
4. **Save**

### scrapegoat-worker-swarm
1. Railway Dashboard → **scrapegoat-worker-swarm** service
2. Settings → **Build** → **Watch Paths**
3. Set to: `scrapegoat/**`
4. **Save**

**Why:** Railway v2 builder ignores `watchPatterns` in `railway.toml`. Dashboard settings are required.

---

## 🎯 Next Steps

1. **Monitor Logs:** Check if Redis connection errors are resolved
2. **Verify Health:** Confirm health endpoint returns 200 OK
3. **Set Watch Paths:** Configure in Dashboard for automatic deployments
4. **Test Worker:** Verify worker can process leads from Redis queue

---

## 📝 Notes

**Service Name:**
- Redis service is named **"Redis"** (not "redis-bridge")
- Use `${{Redis.REDIS_URL}}` syntax for shared variable reference

**Variable Reference:**
- Railway automatically resolves `${{Redis.REDIS_URL}}` to the actual Redis connection URL
- This ensures all services connect to the same Redis instance
