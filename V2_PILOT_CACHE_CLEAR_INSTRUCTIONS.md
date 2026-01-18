# V2 Pilot - Cache Clear Instructions

## 🚨 **Issue: Railway Deploying Old Cached Code**

Railway is consistently using a cached build even after `railway up` and git pushes. The new Quick Search fixes are not being deployed.

**Evidence:**
- Local git shows correct code (name field removed, SSL fix applied)
- Railway logs show old code (still has `firstName`, `lastName`, fetch SSL error)
- Multiple `railway up` attempts failed to update deployed code

---

## ✅ **Solution: Manual Clean Rebuild from Dashboard**

### **Step 1: Open Railway Dashboard**
1. Go to: https://railway.app/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
2. Click on **"brainscraper"** service

### **Step 2: Trigger Clean Rebuild**
1. Click **"Deployments"** tab (left sidebar)
2. Click the **three dots (...)** next to the latest deployment
3. Select **"Redeploy"** or **"Restart"**
4. **Important:** Check if there's an option to "**Clear build cache**" or "**Force rebuild**"
   - If available, **enable** this option
   - This ensures Docker layers are rebuilt from scratch

### **Step 3: Monitor Build**
1. Click on the deployment to open build logs
2. Watch for:
   - `Building Dockerfile` (should start from scratch)
   - `RUN npm install` (should reinstall dependencies)
   - `COPY . .` (should copy new code)
3. Wait ~2-3 minutes for build to complete

### **Step 4: Verify Deployment**
```bash
# Check if new code is deployed
railway logs --service brainscraper --tail 30 | grep "V2_PILOT"

# Should NOT show: "firstName", "lastName", "fetch failed"
# Should show: "Calling LinkedIn API" with location/jobTitle only
```

### **Step 5: Test V2 Pilot**
1. Open: https://brainscraper.io/v2-pilot
2. Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. Check if:
   - ✅ Name field is GONE from Quick Search form
   - ✅ Only Location and Job Title remain
4. Try searching:
   - Location: "Naples, FL"
   - Job Title: "CEO"
5. Should NOT show 500 error anymore

---

## 🔧 **Alternative: Delete and Recreate Deployment**

If the above doesn't work, try deleting the current deployment:

1. Railway Dashboard → **brainscraper** service
2. **Deployments** tab
3. Click **three dots (...)** on active deployment
4. Select **"Remove"** or **"Delete"**
5. Wait for it to delete
6. Railway should automatically trigger a new deployment from `main` branch
7. Or manually trigger: `railway up --detach` from terminal

---

## 📋 **What Changed (Commit ac1c4cd)**

### **File 1: `brainscraper/app/api/v2-pilot/quick-search/route.ts`**
```typescript
// ❌ BEFORE
interface QuickSearchParams {
  name?: string;  // REMOVED - LinkedIn doesn't support name filtering
  location?: string;
  jobTitle?: string;
}

// Using fetch() to call internal API (causes SSL error)
const linkedInResponse = await fetch(`${origin}/api/linkedin-sales-navigator`, {...});

// ✅ AFTER
interface QuickSearchParams {
  location?: string;
  jobTitle?: string;
}

// Import handler directly (avoids SSL issues)
const { POST: linkedInHandler } = await import('@/app/api/linkedin-sales-navigator/route');
const linkedInResponse = await linkedInHandler(mockRequest);
```

### **File 2: `brainscraper/app/v2-pilot/page.tsx`**
```typescript
// ❌ BEFORE
const [quickSearchName, setQuickSearchName] = useState('');
<input placeholder="Name (e.g., John Doe)" ... />

// ✅ AFTER
// Name state and input field removed completely
// Only Location and Job Title remain
```

---

## 🎯 **Expected Behavior After Fix**

### **Quick Search Form Should Show:**
- ✅ Location input (e.g., "Naples, FL")
- ✅ Job Title input (e.g., "CEO")
- ✅ Limit selector (10/25/50/100 leads)
- ❌ **NO** Name field

### **API Should Work:**
- ✅ No more 500 SSL errors
- ✅ LinkedIn API called successfully
- ✅ Leads returned and auto-fired to swarm
- ✅ Swarm Map updates with missions

---

## 🚨 **If Still Not Working**

Contact Railway support or try these nuclear options:

### **Option 1: Disable Build Cache in Dockerfile**
Add to `brainscraper/Dockerfile` at the top:
```dockerfile
# syntax=docker/dockerfile:1
ARG BUILDKIT_CACHE_MOUNT=false
```

### **Option 2: Change Start Command**
Railway Dashboard → brainscraper → Settings → Start Command:
```bash
# Force app restart (don't use cached server.js)
node server.js
```

### **Option 3: Verify Root Directory**
Railway Dashboard → brainscraper → Settings → **Root Directory**:
- Must be: `brainscraper` (NOT `/` or empty)
- Save and redeploy if incorrect

---

## 📝 **Summary**

**Problem:** Railway deploying old cached builds  
**Commits:** `ac1c4cd` (fixes) + `44c933c` (force rebuild)  
**Solution:** Manual clean rebuild from Railway dashboard  
**Expected Result:** Name field gone, Quick Search works without 500 errors
