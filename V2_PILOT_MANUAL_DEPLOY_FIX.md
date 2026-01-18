# V2 Pilot - Manual Deploy Fix

**Issue:** Railway not auto-deploying from git pushes  
**Status:** V2 Pilot code committed and pushed, but Railway using cached build

---

## ✅ **Files Are Ready**

All V2 Pilot files are:
- ✅ Created locally
- ✅ Committed to git
- ✅ Pushed to GitHub (commit: `eafdcf6`)

**The code is ready - Railway just needs to build it.**

---

## 🚀 **Solution: Manual Trigger in Railway Dashboard**

### **Step 1: Open Railway Dashboard**

https://railway.app/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195

---

### **Step 2: Go to BrainScraper Service**

Click on the `brainscraper` service card

---

### **Step 3: Trigger Manual Deployment**

**Option A: From Deployments Tab**
1. Click **"Deployments"** tab (top of page)
2. Click **"Deploy"** button (top right)
3. Select **"Latest Commit"** or **"main branch"**
4. Click **"Deploy"**

**Option B: From Service Settings**
1. Click **"Settings"** tab
2. Scroll to **"Deploy"** section
3. Click **"Redeploy"** or **"Deploy Latest"**

---

### **Step 4: Watch Build Progress**

You'll see build logs in real-time:
- ✅ "Using Detected Dockerfile"
- ✅ Docker build steps
- ✅ npm install
- ✅ npm run build
- ✅ Starting container

**Wait 2-3 minutes for complete build.**

---

### **Step 5: Verify V2 Pilot**

Once deployment completes:

```bash
curl -I https://brainscraper.io/v2-pilot
```

Should return: `HTTP/2 200` (not 404)

**Then open in browser:**
```
https://brainscraper.io/v2-pilot
```

---

## 🔍 **Why Auto-Deploy Isn't Working**

Railway auto-deploy from GitHub requires:
- ✅ GitHub repo connected (appears to be connected)
- ❓ Auto-deploy enabled in service settings
- ❓ Watch patterns configured correctly

**To enable auto-deploy:**
1. Railway Dashboard → brainscraper service
2. Settings → Deploy → **Source**
3. Check **"Auto Deploy"** is enabled
4. Verify **Branch** is set to `main`

---

## ✅ **Quick Summary**

**Current Status:**
- V2 Pilot code: ✅ Committed and pushed to GitHub
- Railway deployment: ⏳ Needs manual trigger

**Fix:**
- Open Railway dashboard
- Go to brainscraper service
- Click "Deploy" button
- Select "Latest Commit"
- Wait 2-3 minutes

**Then V2 Pilot will be live at:** `https://brainscraper.io/v2-pilot` 🚀
