# V2 Pilot - Diagnostic Command Center Upgrade

**Date:** 2026-01-18  
**Purpose:** Transform V2 Pilot into high-tier diagnostic interface with live telemetry  
**Status:** ✅ COMPLETE - Ready for deployment

---

## 🎯 **What Changed?**

Upgraded the V2 Pilot page from basic mission tracking to a **Diagnostic Command Center** with:

1. ✅ **Neural Sight Live Feed (Grounding Mirror)**
   - Live screenshot display with coordinate overlays
   - Blue dot = Blueprint prediction
   - Green crosshair = Actual VLM click
   - Drift distance alerts (yellow if > 50px)
   - 200x200 region proposal zoom-in

2. ✅ **Stealth Health Dashboard (Fingerprint Audit)**
   - JA3 hash display
   - User-Agent and Sec-Ch-Ua headers
   - Proxy pinning status (ISP/Carrier)
   - "Session Broken" alert if IP changes
   - Human Jitter Heatmap (last 10 mouse movements)
   - Mechanical movement detection

3. ✅ **Enhanced Trauma Triage & Execution Log**
   - VLM confidence meter (real-time gauge)
   - "Fallback Triggered" indicator when < 0.95
   - Interactive decision trace modal (click any mission)
   - Entropy poison check (data freshness)
   - Full THINK step timeline

---

## 📁 **Files Updated/Created**

| File | Status | Purpose |
|------|--------|---------|
| `brainscraper/app/v2-pilot/page.tsx` | ✅ Updated | Main diagnostic interface |
| `brainscraper/app/api/v2-pilot/mission-status/route.ts` | ✅ Updated | Enhanced with new telemetry fields |
| `brainscraper/app/api/v2-pilot/telemetry/route.ts` | ✅ Created | Telemetry ingestion endpoint |

---

## 🎨 **New UI Components**

### **1. Neural Sight Live Feed**

```
┌───────────────────────────────────────────────────────────────┐
│ 👁️ NEURAL SIGHT LIVE FEED (Grounding Mirror)                 │
├─────────────────────────────────┬─────────────────────────────┤
│ LIVE SCREENSHOT + OVERLAY       │ REGION PROPOSAL (200x200)   │
│                                 │                             │
│ [Screenshot with overlays]      │ [200x200 zoomed crop]       │
│                                 │                             │
│ • Blue dot = Blueprint          │ VLM CONFIDENCE METER        │
│ • Green crosshair = VLM click   │ ████████████░░░░ 87.5%      │
│ • ⚠️ DRIFT: 52px (if > 50px)    │ ⚡ FALLBACK TRIGGERED        │
└─────────────────────────────────┴─────────────────────────────┘
```

**Features:**
- Real-time screenshot display
- Coordinate overlay visualization
- Drift distance calculation and alerting
- VLM confidence meter with color coding:
  - 🟢 Green: ≥ 95% (high confidence)
  - 🟡 Yellow: 80-95% (medium confidence)
  - 🔴 Red: < 80% (low confidence)
- Fallback trigger indicator (olmOCR-2)

---

### **2. Stealth Health Dashboard**

```
┌───────────────────────────────────────────────────────────────┐
│ 🕵️ STEALTH HEALTH DASHBOARD (Fingerprint Audit)              │
├──────────────────────┬────────────────────┬───────────────────┤
│ FINGERPRINT SNAPSHOT │ PROXY PINNING      │ HUMAN JITTER      │
│                      │                    │                   │
│ JA3: a0e9f5b6...    │ ISP: T-Mobile      │ [Canvas heatmap]  │
│ User-Agent: Mozilla..│ Session: stable    │                   │
│ Sec-Ch-Ua: "Chrome"..│ ✅ SESSION STABLE  │ Last 10 moves     │
└──────────────────────┴────────────────────┴───────────────────┘
```

**Features:**
- **Fingerprint Snapshot:**
  - JA3 hash (TLS fingerprint)
  - User-Agent string
  - Sec-Ch-Ua client hints

- **Proxy Pinning Status:**
  - ISP/Carrier display (color-coded)
  - Session ID
  - IP change detection (red alert if changed)

- **Human Jitter Heatmap:**
  - Canvas visualization of last 10 mouse movements
  - Green path = natural movement
  - Red overlay = mechanical (straight lines detected)
  - Angle analysis to detect non-human patterns

---

### **3. Interactive Decision Trace Modal**

```
┌───────────────────────────────────────────────────────────────┐
│ 🧠 DECISION TRACE - John Doe                              [×] │
├───────────────────────────────────────────────────────────────┤
│ Mission ID: mission_1768724565_abc123                         │
│ Status: COMPLETED • Location: Naples, FL                      │
├───────────────────────────────────────────────────────────────┤
│ EXECUTION TIMELINE:                                           │
│                                                               │
│ ① Found search bar                          10:23:45         │
│    Located input field at coordinates (150, 300)             │
│    Confidence: ████████████████░░ 92.5%                      │
│                                                               │
│ ② Injected entropy                          10:23:47         │
│    Applied behavioral jitter: 127ms delay                    │
│    Confidence: ████████████████████ 98.1%                    │
│                                                               │
│ ③ Handling CAPTCHA                          10:23:52         │
│    Autonomous VLM solver attempted (DeepSeek-VL2)            │
│    Confidence: ████████████░░░░░░░░ 65.3%                    │
│                                                               │
│ ④ Fallback to CapSolver                     10:23:58         │
│    Secondary CAPTCHA solver engaged                          │
│    Confidence: ████████████████████ 100.0%                   │
├───────────────────────────────────────────────────────────────┤
│ DATA FRESHNESS CHECK:                                         │
│ Entropy Score: 0.87 ✅ DATA FRESH                             │
└───────────────────────────────────────────────────────────────┘
```

**Features:**
- Click any mission row to open trace modal
- Step-by-step THINK sequence visualization
- Confidence bars for each decision
- Timestamps for execution timeline
- Entropy poison check at bottom
- Close button to return to main view

---

## 🔌 **Telemetry Integration for Chimera Core**

### **Endpoint:** `POST /api/v2-pilot/telemetry`

Chimera Core workers should push telemetry to this endpoint during mission execution.

### **Payload Structure:**

```typescript
interface TelemetryPayload {
  mission_id: string; // Required
  
  // Coordinate drift (VLM vs Blueprint)
  coordinate_drift?: {
    suggested: { x: number; y: number };
    actual: { x: number; y: number };
    confidence: number;
  };
  
  // Browser fingerprint
  fingerprint?: {
    ja3_hash: string;
    user_agent: string;
    sec_ch_ua: string;
    isp_carrier: string;
    session_id: string;
    ip_changed: boolean;
  };
  
  // Visual data
  screenshot_url?: string; // Full page screenshot URL or data URI
  region_proposal?: string; // Base64 encoded 200x200 crop
  
  // Mouse tracking
  mouse_movements?: Array<{
    x: number;
    y: number;
    timestamp: number;
  }>;
  
  // Decision trace (THINK steps)
  decision_trace?: Array<{
    step: string;
    action: string;
    timestamp: number;
    confidence?: number;
  }>;
  
  // VLM metrics
  vision_confidence?: number;
  fallback_triggered?: boolean;
  
  // Status
  status?: 'queued' | 'processing' | 'completed' | 'failed';
  
  // Trauma
  trauma_signals?: string[];
  trauma_details?: string;
}
```

### **Example Python Code (Chimera Core):**

```python
import requests
import base64
from io import BytesIO
from PIL import Image

def push_telemetry(mission_id: str, screenshot: bytes, coordinates: dict, fingerprint: dict):
    """Push telemetry to V2 Pilot diagnostic interface"""
    
    # Convert screenshot to data URI
    screenshot_b64 = base64.b64encode(screenshot).decode('utf-8')
    screenshot_uri = f"data:image/png;base64,{screenshot_b64}"
    
    # Extract 200x200 region proposal (around click point)
    img = Image.open(BytesIO(screenshot))
    x, y = coordinates['actual']['x'], coordinates['actual']['y']
    crop_box = (x - 100, y - 100, x + 100, y + 100)
    region = img.crop(crop_box)
    
    # Convert region to base64
    region_buffer = BytesIO()
    region.save(region_buffer, format='PNG')
    region_b64 = base64.b64encode(region_buffer.getvalue()).decode('utf-8')
    
    # Build payload
    payload = {
        'mission_id': mission_id,
        'coordinate_drift': coordinates,
        'fingerprint': fingerprint,
        'screenshot_url': screenshot_uri,
        'region_proposal': region_b64,
        'vision_confidence': 0.923,
        'fallback_triggered': False,
        'status': 'processing'
    }
    
    # Send to BrainScraper
    brainscraper_url = os.getenv('BRAINSCRAPER_URL', 'http://brainscraper.railway.internal:3000')
    response = requests.post(f"{brainscraper_url}/api/v2-pilot/telemetry", json=payload)
    
    if response.status_code == 200:
        print(f"✅ Telemetry pushed for mission {mission_id}")
    else:
        print(f"❌ Failed to push telemetry: {response.text}")
```

### **Integration Points in Chimera Core:**

| Event | Telemetry to Push |
|-------|-------------------|
| **Mission Start** | `status: 'processing'`, `fingerprint`, `decision_trace: [step 1]` |
| **VLM Click** | `coordinate_drift`, `screenshot_url`, `region_proposal`, `vision_confidence` |
| **Mouse Movement** | `mouse_movements` (append to array, keep last 10) |
| **CAPTCHA Detected** | `decision_trace: [CAPTCHA step]`, `trauma_signals: ['NEEDS_OLMOCR_VERIFICATION']` |
| **Fallback Triggered** | `fallback_triggered: true`, `vision_confidence` |
| **IP Changed** | `fingerprint: { ip_changed: true }`, `trauma_signals: ['SESSION_BROKEN']` |
| **Mission Complete** | `status: 'completed'`, final `decision_trace` |
| **Mission Failed** | `status: 'failed'`, `trauma_signals`, `trauma_details` |

---

## 🧪 **Testing Procedure**

### **Phase 1: Visual Verification**

1. **Deploy V2 Pilot:**
   ```bash
   cd /Users/linkpellow/Desktop/my-lead-engine/brainscraper
   railway up --service brainscraper
   ```

2. **Open V2 Pilot:**
   - URL: `https://brainscraper-production.up.railway.app/v2-pilot`

3. **Fire a test batch:**
   - Enter 5 test leads
   - Click "FIRE SWARM"

4. **Verify new UI elements:**
   - ✅ Neural Sight Live Feed is visible
   - ✅ Stealth Health Dashboard is visible
   - ✅ Mission log is clickable
   - ✅ Decision trace modal opens on click

---

### **Phase 2: Telemetry Integration Test**

**Option A: Mock Data (No Chimera Core changes needed)**

```bash
# Test telemetry endpoint with curl
curl -X POST https://brainscraper-production.up.railway.app/api/v2-pilot/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "mission_id": "mission_test_123",
    "coordinate_drift": {
      "suggested": {"x": 150, "y": 300},
      "actual": {"x": 148, "y": 302},
      "confidence": 0.923
    },
    "fingerprint": {
      "ja3_hash": "a0e9f5b6c2d4e8f3a1b2c3d4e5f6a7b8",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "sec_ch_ua": "\"Chromium\";v=\"120\", \"Not_A Brand\";v=\"8\"",
      "isp_carrier": "T-Mobile USA",
      "session_id": "session_1768724565_abc123",
      "ip_changed": false
    },
    "vision_confidence": 0.923,
    "fallback_triggered": false,
    "status": "processing",
    "decision_trace": [
      {
        "step": "Found search bar",
        "action": "Located input field at coordinates (150, 300)",
        "timestamp": 1768724565000,
        "confidence": 0.925
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "mission_id": "mission_test_123",
  "fields_updated": 7
}
```

**Option B: Real Integration (Modify Chimera Core)**

1. **Add telemetry push to `workers.py`:**
   - Import requests library
   - Add `push_telemetry()` function
   - Call after each major step

2. **Set BRAINSCRAPER_URL environment variable:**
   ```bash
   railway variables --service chimera-core set BRAINSCRAPER_URL=http://brainscraper.railway.internal:3000
   ```

3. **Redeploy Chimera Core:**
   ```bash
   railway up --service chimera-core
   ```

---

### **Phase 3: Live Diagnostic Verification**

**With telemetry flowing:**

1. **Fire 5-lead batch** in V2 Pilot

2. **Click on a processing mission** in the log

3. **Verify Neural Sight Feed shows:**
   - ✅ Live screenshot
   - ✅ Blue dot at Blueprint coordinates
   - ✅ Green crosshair at VLM click coordinates
   - ✅ Drift distance (yellow if > 50px)
   - ✅ Region proposal (200x200 crop)

4. **Verify Stealth Health shows:**
   - ✅ JA3 hash
   - ✅ User-Agent
   - ✅ ISP/Carrier
   - ✅ Session stable (or broken alert)
   - ✅ Mouse heatmap with 10 movements

5. **Click mission to open Decision Trace:**
   - ✅ Timeline shows all THINK steps
   - ✅ Confidence bars display correctly
   - ✅ Entropy check at bottom
   - ✅ Can close modal and return to log

---

## 📊 **Diagnostic Capabilities**

### **1. Silent Failure Detection**

**Problem:** VLM generates wrong coordinates, clicks fail silently.

**Solution:**
- Blue dot shows where Blueprint thought button was
- Green crosshair shows where VLM actually clicked
- If drift > 50px → yellow alert
- Screenshot + region proposal confirms VLM is analyzing correct area

**How to diagnose:**
1. Look for yellow "⚠️ DRIFT" alerts
2. Click mission to see Neural Sight Feed
3. Check if VLM is looking at correct region
4. If region is wrong → Trauma Center needs to update selector

---

### **2. Mechanical Movement Detection**

**Problem:** Mouse movements too linear, flagged as bot.

**Solution:**
- Human Jitter Heatmap visualizes last 10 movements
- Angle analysis detects straight lines
- Red overlay indicates mechanical movement

**How to diagnose:**
1. Click processing mission
2. Look at Human Jitter Heatmap
3. If red overlay → Bezier curve needs tuning
4. Check `workers.py` micro-tremor parameters

---

### **3. Session Breaking**

**Problem:** IP changes mid-mission, site flags as suspicious.

**Solution:**
- Proxy Pinning Status shows ISP/Carrier
- "SESSION BROKEN" alert if IP changes
- Session ID displayed for traceability

**How to diagnose:**
1. Look for red "🚨 SESSION BROKEN" in Stealth Health
2. Check if `sticky_session_id` is being passed correctly
3. Verify Decodo proxy configuration
4. Check `network.py` session management

---

### **4. VLM Confidence Drops**

**Problem:** VLM confidence < 0.95, needs fallback.

**Solution:**
- VLM Confidence Meter shows real-time score
- "FALLBACK TRIGGERED" indicator
- Decision Trace shows when olmOCR-2 engaged

**How to diagnose:**
1. Watch VLM Confidence Meter turn yellow/red
2. Check if fallback triggered automatically
3. Look at Decision Trace for fallback step
4. If frequent fallbacks → retrain VLM or update selectors

---

## ✅ **Success Criteria**

**System is ready when:**

- ✅ V2 Pilot loads without errors
- ✅ Neural Sight Live Feed displays (even if empty)
- ✅ Stealth Health Dashboard displays (even if empty)
- ✅ Mission log is clickable
- ✅ Decision trace modal opens and closes
- ✅ Telemetry endpoint returns 200 OK on test
- ✅ (Optional) Chimera Core pushes real telemetry

---

## 🚀 **Deployment Steps**

### **1. Fix BrainScraper Root Directory** (If not done yet)

**Railway Dashboard:**
1. Open: https://railway.app/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
2. Click `brainscraper` service
3. Settings → Build → **Root Directory** → `brainscraper`
4. Save

---

### **2. Deploy V2 Pilot**

```bash
cd /Users/linkpellow/Desktop/my-lead-engine/brainscraper
railway up --service brainscraper
```

**Expected output:**
```
Indexing...
Uploading...
  Build Logs: https://railway.com/project/.../service/...
```

**Wait 2-3 minutes for build, then:**

```bash
railway logs --service brainscraper --tail 50

# Should see:
# 🚀 Starting Next.js server on 0.0.0.0:3000
# ✅ Next.js app prepared successfully
```

---

### **3. Access V2 Pilot**

**URL:** `https://brainscraper-production.up.railway.app/v2-pilot`

**Expected:**
- ✅ Diagnostic Command Center loads
- ✅ All UI sections visible
- ✅ Stats dashboard shows 0s
- ✅ Can enter test leads

---

### **4. Test Telemetry Endpoint**

```bash
# Copy the curl command from Phase 2 above
# Should return: {"success":true,"mission_id":"mission_test_123","fields_updated":7}
```

---

### **5. (Optional) Integrate Chimera Core**

**If you want real-time telemetry:**

1. **Modify `chimera-core/workers.py`:**
   - Add `push_telemetry()` calls after key events
   - Use example Python code from this doc

2. **Set environment variable:**
   ```bash
   railway variables --service chimera-core set BRAINSCRAPER_URL=http://brainscraper.railway.internal:3000
   ```

3. **Redeploy:**
   ```bash
   cd /Users/linkpellow/Desktop/my-lead-engine/chimera-core
   railway up --service chimera-core
   ```

---

## 🎯 **Next Steps**

**Immediate:**
1. ✅ Deploy V2 Pilot (Step 2 above)
2. ✅ Test UI loads correctly
3. ✅ Test telemetry endpoint with curl

**Short-term (optional):**
1. Integrate Chimera Core telemetry push
2. Run 5-lead batch with real telemetry
3. Verify all diagnostic features work

**Long-term:**
1. Fine-tune based on real mission data
2. Add more diagnostic visualizations
3. Export telemetry logs for analysis

---

## 📚 **Summary**

**What we built:**
- High-tier diagnostic command center
- Real-time coordinate overlay visualization
- Fingerprint audit and proxy pinning monitoring
- Mouse movement mechanical detection
- Interactive decision trace with full THINK timeline
- Entropy poison checking

**What you get:**
- Instant visibility into VLM decision-making
- Silent failure detection (coordinate drift)
- Stealth health monitoring (fingerprints, IP pinning)
- Full mission traceability (decision trace)
- Data quality validation (entropy scoring)

**The V2 Pilot is now a production-grade diagnostic tool for the Sovereign Neural Pipeline.** 🚀
