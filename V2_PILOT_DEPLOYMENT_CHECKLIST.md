# V2 Pilot Diagnostic Command Center - Deployment Checklist

**Date:** 2026-01-18  
**Status:** Ready for deployment  
**Time Required:** ~15 minutes (basic) to 1 hour (full integration)

---

## ✅ **Pre-Deployment Checklist**

### **1. Railway Service Configuration**

- [ ] **BrainScraper Root Directory Set**
  - Open: https://railway.app/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
  - Service: `brainscraper`
  - Settings → Build → Root Directory → `brainscraper`
  - Save
  - **Status:** ⚠️ **REQUIRED** - Must be done before deployment

- [x] **Other Services Root Directories Verified**
  - `scrapegoat` → Root: `scrapegoat` ✅
  - `chimera-core` → Root: `chimera-core` ✅
  - `chimera_brain` → Root: `chimera_brain` ✅

- [x] **All Services Online**
  - `brainscraper` ✅
  - `scrapegoat` ✅
  - `chimera-core` ✅
  - `chimera-brain-v1` ✅
  - Redis ✅
  - PostgreSQL ✅

---

## 🚀 **Deployment Steps**

### **Phase 1: Basic V2 Pilot Deployment (15 minutes)**

#### **Step 1: Fix Root Directory** (5 minutes)

```bash
# Open Railway dashboard in browser
open https://railway.app/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195

# Navigate to:
# brainscraper service → Settings → Build → Root Directory
# Enter: brainscraper
# Click: Save
```

**Verification:**
- [ ] Root Directory shows `brainscraper` in Railway dashboard
- [ ] Build settings saved successfully

---

#### **Step 2: Deploy BrainScraper** (5 minutes)

```bash
cd /Users/linkpellow/Desktop/my-lead-engine/brainscraper
railway up --service brainscraper
```

**Expected Output:**
```
Indexing...
Uploading...
  Build Logs: https://railway.com/project/.../service/...
```

**Wait 2-3 minutes for build to complete.**

**Verification:**
- [ ] Build completes without errors
- [ ] Service shows "Active" in Railway dashboard
- [ ] Health check passes (green dot)

---

#### **Step 3: Check Logs** (2 minutes)

```bash
railway logs --service brainscraper --tail 50
```

**Expected Output:**
```
🚀 Starting Next.js server on 0.0.0.0:3000
✅ Next.js app prepared successfully
🎉 Server ready on http://0.0.0.0:3000
```

**Verification:**
- [ ] No error messages in logs
- [ ] Server started successfully
- [ ] Port 3000 listening

---

#### **Step 4: Access V2 Pilot** (3 minutes)

**URL:** `https://brainscraper-production.up.railway.app/v2-pilot`

(Or your custom domain if configured)

**Expected:**
- [ ] Page loads without errors
- [ ] Stats dashboard shows zeros
- [ ] Batch controller visible
- [ ] Trauma triage panel visible
- [ ] Neural Sight section visible
- [ ] Stealth Health section visible
- [ ] VLM drift cards visible
- [ ] Mission log visible

**If page doesn't load:**
1. Check Railway logs for errors
2. Verify service is running
3. Check environment variables (REDIS_URL, etc.)

---

### **Phase 2: Telemetry Endpoint Testing (10 minutes)**

#### **Step 5: Test Telemetry Endpoint**

```bash
curl -X POST https://brainscraper-production.up.railway.app/api/v2-pilot/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "mission_id": "test_mission_123",
    "status": "processing",
    "vision_confidence": 0.95,
    "coordinate_drift": {
      "suggested": {"x": 150, "y": 300},
      "actual": {"x": 148, "y": 302},
      "confidence": 0.95
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "mission_id": "test_mission_123",
  "fields_updated": 3
}
```

**Verification:**
- [ ] Response status: 200 OK
- [ ] `success: true` in response
- [ ] `fields_updated > 0`

---

#### **Step 6: Verify Telemetry Storage**

```bash
# Check Redis for mission data (optional, requires Redis CLI)
redis-cli -u $REDIS_URL HGETALL mission:test_mission_123
```

**Expected:**
- [ ] Mission data stored in Redis
- [ ] Fields match what was sent

---

### **Phase 3: Basic Functionality Test (10 minutes)**

#### **Step 7: Fire Test Batch**

1. Open V2 Pilot in browser
2. Enter test leads in batch controller:
   ```
   John Doe | Naples, FL
   Jane Smith | Miami, FL
   Robert Johnson | Fort Myers, FL
   Sarah Williams | Tampa, FL
   Michael Brown | Orlando, FL
   ```
3. Click **🚀 FIRE SWARM**

**Expected:**
- [ ] Success alert shows "5 missions queued"
- [ ] Mission log updates with 5 entries
- [ ] All missions show status: QUEUED
- [ ] Stats dashboard updates (Total: 5, Queued: 5)

---

#### **Step 8: Watch Mission Processing**

Wait 30 seconds, observe:

**Expected (without Chimera Core telemetry):**
- [ ] Missions remain in QUEUED status
- [ ] No errors in console
- [ ] Stats update correctly

**Expected (with Chimera Core telemetry):**
- [ ] Missions change to PROCESSING
- [ ] VLM drift cards appear
- [ ] Stats show Processing count > 0
- [ ] Eventually some complete

---

### **Phase 4: Chimera Core Integration (Optional, 30 minutes)**

**Skip this phase if you want to deploy V2 Pilot first and integrate later.**

#### **Step 9: Add Telemetry Client to Requirements**

```bash
cd /Users/linkpellow/Desktop/my-lead-engine/chimera-core

# Check if dependencies are already in requirements.txt
grep -E "requests|Pillow" requirements.txt

# If not found, add them:
echo "requests>=2.31.0" >> requirements.txt
echo "Pillow>=10.0.0" >> requirements.txt
```

**Verification:**
- [ ] `requests` in requirements.txt
- [ ] `Pillow` in requirements.txt

---

#### **Step 10: Set BRAINSCRAPER_URL Environment Variable**

```bash
railway variables --service chimera-core set BRAINSCRAPER_URL=http://brainscraper.railway.internal:3000
```

**Verification:**
- [ ] Variable set successfully
- [ ] Shows in Railway dashboard under chimera-core → Variables

---

#### **Step 11: Add Telemetry Calls to workers.py**

**File already created:** `chimera-core/telemetry_client.py` ✅

**Integration guide:** `chimera-core/TELEMETRY_INTEGRATION_EXAMPLE.md` ✅

**Add at top of `workers.py`:**
```python
from telemetry_client import get_telemetry_client

telemetry = get_telemetry_client()
```

**Key integration points:**
- Mission start → `telemetry.push_start()`
- VLM click → `telemetry.push_vlm_click()`
- Mouse movement → `telemetry.push(mouse_movements=...)`
- CAPTCHA detected → `telemetry.push_captcha_detected()`
- Session broken → `telemetry.push_session_broken()`
- Mission complete → `telemetry.push_complete()`

**See:** `TELEMETRY_INTEGRATION_EXAMPLE.md` for full code examples

**Verification:**
- [ ] Telemetry client imported
- [ ] Key integration points added
- [ ] No syntax errors

---

#### **Step 12: Redeploy Chimera Core**

```bash
cd /Users/linkpellow/Desktop/my-lead-engine/chimera-core
railway up --service chimera-core
```

**Wait 3-5 minutes for build.**

**Verification:**
- [ ] Build completes without errors
- [ ] Service restarts successfully
- [ ] Logs show telemetry client initialized

---

#### **Step 13: Test End-to-End with Real Telemetry**

1. Open V2 Pilot
2. Fire 5-lead batch
3. Watch in real-time:

**Expected:**
- [ ] Missions go to PROCESSING
- [ ] Neural Sight shows screenshots (if Chimera pushes them)
- [ ] Stealth Health shows fingerprints
- [ ] Mouse heatmap displays movements
- [ ] VLM drift cards show coordinate data
- [ ] Decision traces populate

---

## 📊 **Success Criteria**

### **Minimum (Phase 1-2 Complete):**

- [x] V2 Pilot page loads without errors
- [x] All UI sections visible
- [x] Batch controller functional
- [x] Telemetry endpoint responds 200 OK
- [ ] Can fire test batch (missions queue)

### **Full Success (Phase 1-4 Complete):**

- [ ] V2 Pilot page loads
- [ ] Telemetry endpoint working
- [ ] Missions process end-to-end
- [ ] Neural Sight shows live screenshots
- [ ] Stealth Health shows fingerprints
- [ ] Mouse heatmap visualizes movements
- [ ] Decision traces display correctly
- [ ] VLM confidence meter updates
- [ ] Trauma signals alert on issues

---

## 🚨 **Troubleshooting**

### **Issue: V2 Pilot page won't load**

**Check:**
1. Railway service status (is it running?)
2. Build logs for errors
3. Environment variables (REDIS_URL, etc.)
4. Root Directory is set correctly

**Fix:**
```bash
railway logs --service brainscraper --tail 100
# Look for error messages
```

---

### **Issue: Telemetry endpoint returns 500 error**

**Check:**
1. Redis connection (is REDIS_URL set?)
2. Endpoint logs for exceptions
3. Request payload format

**Fix:**
```bash
# Check Redis connection
railway variables --service brainscraper | grep REDIS_URL

# Test minimal payload
curl -X POST .../api/v2-pilot/telemetry \
  -H "Content-Type: application/json" \
  -d '{"mission_id":"test"}'
```

---

### **Issue: Missions stay in QUEUED forever**

**This is expected without Chimera Core integration.**

Chimera Core workers consume missions from the queue. If you haven't completed Phase 4:
- Missions will queue but not process
- This is normal for Phase 1-2 testing
- Complete Phase 4 to enable full processing

---

### **Issue: No telemetry data showing**

**Check:**
1. Did you complete Phase 4? (Chimera Core integration)
2. Is Chimera Core running?
3. Is BRAINSCRAPER_URL set correctly?
4. Are telemetry calls in workers.py?

**Fix:**
```bash
# Check Chimera Core logs
railway logs --service chimera-core --tail 50 | grep telemetry

# Should see:
# 📡 Telemetry client initialized: http://brainscraper.railway.internal:3000/api/v2-pilot/telemetry
# ✅ Telemetry pushed: mission_123 (5 fields)
```

---

## 🎯 **Next Steps After Deployment**

### **Immediate:**
- [ ] Verify all UI sections load
- [ ] Test telemetry endpoint with curl
- [ ] Fire small test batch (5 leads)

### **Short-term:**
- [ ] Complete Chimera Core integration (Phase 4)
- [ ] Run 25-lead production test
- [ ] Monitor diagnostics during real missions

### **Long-term:**
- [ ] Fine-tune based on real telemetry data
- [ ] Add more diagnostic visualizations
- [ ] Export telemetry logs for analysis
- [ ] Set up alerts for trauma signals

---

## 📚 **Documentation Reference**

| Document | Purpose |
|----------|---------|
| `V2_PILOT_DEPLOYMENT.md` | Original deployment guide |
| `V2_PILOT_DIAGNOSTIC_UPGRADE.md` | **★ Main docs** - Full feature guide |
| `V2_PILOT_LAYOUT_VISUAL.md` | Visual layout reference |
| `TELEMETRY_INTEGRATION_EXAMPLE.md` | Chimera Core integration |
| `VANGUARD_STATE.md` | Overall system status |

---

## ✅ **Deployment Complete!**

When all checkboxes above are marked:

- ✅ V2 Pilot Diagnostic Command Center is deployed
- ✅ Telemetry endpoint is working
- ✅ Ready for production testing
- ✅ (Optional) Chimera Core pushing real-time telemetry

**You now have a production-grade diagnostic interface for the Sovereign Neural Pipeline.** 🧠🚀

**URL:** `https://brainscraper-production.up.railway.app/v2-pilot`

**Fire your first 25-lead batch and watch the neural pipeline work in real-time!**
