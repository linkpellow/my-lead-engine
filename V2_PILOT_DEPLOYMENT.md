# V2 Pilot - Sovereign Neural Pipeline Test Interface

**Date:** 2026-01-18  
**Purpose:** Production-ready testing interface for direct Chimera Core access  
**Access:** Internal testing only (not for end users)

---

## 🎯 **What is V2 Pilot?**

The **V2 Pilot** is a "Clean Slate" testing page that:

1. **Bypasses standard UI logic** - Goes directly to Chimera Core worker swarm
2. **Shows real-time telemetry** - VLM coordinate drift, trauma signals, poison detection
3. **Handles 25-lead batches** - Bulk processing for production verification
4. **Verifies mobile IP pinning** - Ensures sticky sessions per mission
5. **Detects data poisoning** - Entropy-based validation

**This is NOT for end users** - it's a technical interface packed with "Sovereign" telemetry for your eyes only.

---

## 📁 **Files Created**

| File | Purpose |
|------|---------|
| `brainscraper/app/v2-pilot/page.tsx` | Main pilot interface (React component) |
| `brainscraper/app/api/v2-pilot/fire-swarm/route.ts` | Bulk mission injection API |
| `brainscraper/app/api/v2-pilot/mission-status/route.ts` | Real-time status polling API |
| `brainscraper/lib/redis.ts` | Redis client singleton |

---

## 🚀 **Deployment Steps**

### **1. Fix BrainScraper Root Directory First**

Before deploying, you **MUST** set the Root Directory in Railway dashboard:

1. Open: https://railway.app/project/4ea4e3a1-2f41-4dfd-a6a6-4af56084b195
2. Click **`brainscraper`** service
3. Go to **Settings** → **Build** section
4. Set **Root Directory** to: `brainscraper`
5. Click **Save**

**Why:** Without this, Docker build will fail looking for `package.json` at repo root.

---

### **2. Deploy from Mac Terminal**

```bash
cd /Users/linkpellow/Desktop/my-lead-engine/brainscraper

# Deploy to Railway
railway up --service brainscraper
```

**Expected Output:**
```
Indexing...
Uploading...
  Build Logs: https://railway.com/project/.../service/...
```

---

### **3. Verify Deployment**

Wait 2-3 minutes for build, then check:

```bash
# Check logs
railway logs --service brainscraper --tail 50

# Should see:
# 🚀 Starting Next.js server on 0.0.0.0:3000
# ✅ Next.js app prepared successfully
# 🎉 Server ready on http://0.0.0.0:3000
```

---

### **4. Access the Pilot Page**

**URL:** `https://brainscraper-production.up.railway.app/v2-pilot`

Or if you have a custom domain:
`https://brainscraper.io/v2-pilot`

---

## 🎛️ **Interface Overview**

### **Top Stats Dashboard**
```
┌─────────────┬──────────┬────────────┬───────────┬─────────┬──────────────┐
│ TOTAL       │ QUEUED   │ PROCESSING │ COMPLETED │ FAILED  │ SUCCESS RATE │
│ MISSIONS    │          │            │           │         │              │
└─────────────┴──────────┴────────────┴───────────┴─────────┴──────────────┘
```

**What it shows:**
- Real-time counts of mission states
- Success rate percentage
- Updates every 2 seconds

---

### **25-Lead Batch Controller (Left)**

```
🔥 25-LEAD BATCH CONTROLLER
─────────────────────────────
Format: Name | Location (one per line, max 25)

[Text Area]
John Doe | Naples, FL
Jane Smith | Miami, FL
...

[🚀 FIRE SWARM] [CLEAR]
```

**How to use:**
1. Enter leads in format: `Name | Location`
2. One per line, up to 25 leads
3. Click **🚀 FIRE SWARM**
4. Missions are pushed to `chimera:missions` Redis queue
5. Chimera Core workers pick them up automatically

**Example Input:**
```
John Doe | Naples, FL
Jane Smith | Miami, FL  
Robert Johnson | Fort Myers, FL
Sarah Williams | Tampa, FL
Michael Brown | Orlando, FL
```

---

### **Trauma Triage Panel (Right)**

```
🚨 TRAUMA TRIAGE PANEL
────────────────────────
Real-time trauma signals from Chimera swarm

[Red/Yellow] CAPTCHA_AGENT_FAILURE
Mission: mission_1768724565...
Details: Autonomous agent failed to solve reCAPTCHA v2

[Yellow] NEEDS_OLMOCR_VERIFICATION
Mission: mission_1768724566...
Details: Vision confidence < 0.95, secondary pass required
```

**Trauma Signal Types:**

| Signal | Severity | Meaning |
|--------|----------|---------|
| `CAPTCHA_AGENT_FAILURE` | 🔴 Red | Autonomous CAPTCHA solver failed |
| `TIMEOUT` | 🔴 Red | Mission exceeded 30s timeout |
| `LOW_ENTROPY` | 🔴 Red | Data entropy < 0.70 (poisoned data) |
| `NEEDS_OLMOCR_VERIFICATION` | 🟡 Yellow | VLM confidence < 0.95 |
| `HONEYPOT_TRAP` | 🟡 Yellow | Element detected as honeypot |

---

### **VLM Coordinate Drift (Middle)**

```
🎯 VLM COORDINATE DRIFT (Neural Mirror)
────────────────────────────────────────
Real-time vision corrections • Suggested vs Actual

┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│ John Doe          │  │ Jane Smith        │  │ Robert Johnson    │
│ Suggested: (150,  │  │ Suggested: (200,  │  │ Suggested: (180,  │
│            300)   │  │            450)   │  │            350)   │
│ Actual:    (148,  │  │ Actual:    (198,  │  │ Actual:    (179,  │
│            302)   │  │            452)   │  │            351)   │
│ Confidence: 97.5% │  │ Confidence: 94.2% │  │ Confidence: 98.1% │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

**What this shows:**
- **Suggested:** Initial VLM coordinate prediction
- **Actual:** Final coordinate after correction
- **Confidence:** VLM confidence score
  - ✅ Green: ≥ 95% (high confidence)
  - 🟡 Yellow: < 95% (needs verification)

**Why it matters:**
- Shows VLM is learning and adapting
- Coordinate drift indicates anti-bot layout changes
- Low confidence triggers olmOCR-2 fallback

---

### **Mission Log (Bottom)**

```
📋 MISSION LOG (Live)
────────────────────────────────────────────────────────────────────
STATUS      | MISSION ID         | NAME        | LOCATION    | CARRIER | ENTROPY | TRAUMA | TIME
────────────────────────────────────────────────────────────────────
PROCESSING  | mission_17687...   | John Doe    | Naples, FL  | T-Mobile| 0.85    | ✓      | 10:23:45
COMPLETED   | mission_17687...   | Jane Smith  | Miami, FL   | AT&T    | 0.92    | ✓      | 10:23:40
TIMEOUT     | mission_17687...   | Robert J.   | Tampa, FL   | Verizon | -       | 2      | 10:23:35
```

**Column Meanings:**

| Column | Meaning |
|--------|---------|
| **Status** | Current mission state |
| **Mission ID** | Unique mission identifier (truncated) |
| **Name** | Lead name |
| **Location** | Lead location |
| **Carrier** | Mobile carrier for IP pinning (T-Mobile, AT&T, Verizon) |
| **Entropy** | Data quality score (0.0-1.0) |
| **Trauma** | Number of trauma signals (or ✓ if clean) |
| **Time** | Mission timestamp |

---

## 🔍 **Production Verification Features**

### **1. Mobile IP Pinning**

**What it verifies:**
- Each mission gets a `sticky_session_id`
- Session ID is passed to `network.py` in Chimera Core
- Single mission stays on one mobile carrier IP for entire duration

**How to verify in logs:**
```bash
railway logs --service chimera-core --tail 100 | grep sticky_session

# Should see:
# [CHIMERA-BODY] INFO - Using sticky session: session_1768724565_abc123
# [CHIMERA-BODY] INFO - Carrier: T-Mobile (pinned for mission duration)
```

**Why it matters:**
- FastPeopleSearch and other sites flag mid-session IP changes
- Sticky sessions ensure one IP = one mission (no switching)
- Prevents "Too many requests from different IPs" errors

---

### **2. Data Poisoning Detection**

**What it checks:**
- **Entropy Score:** Calculates uniqueness of returned data
- **Threshold:** Entropy < 0.70 = likely poisoned
- **Cross-Source Consensus:** Compares results from multiple sources

**Entropy Calculation:**
```typescript
function calculateEntropyScore(data: any): number {
  const values = Object.values(data).filter(v => typeof v === 'string' && v.length > 0);
  const uniqueValues = new Set(values);
  return uniqueValues.size / Math.max(values.length, 1);
}
```

**Example:**
```
Lead 1: { name: "John Doe", phone: "555-1234", email: "john@example.com" }
Entropy: 1.0 (all unique) ✅

Lead 2: { name: "555-0000", phone: "555-0000", email: "555-0000" }
Entropy: 0.33 (identical values) ❌ POISONED
```

**What happens when poisoned:**
- Flagged as `LOW_ENTROPY` trauma signal
- Displayed in red in Trauma Triage Panel
- NOT saved to database (validation fails)

---

### **3. VLM Verification**

**What it monitors:**
- **Vision confidence:** Should be ≥ 0.95
- **Coordinate drift:** How much VLM corrected initial prediction
- **olmOCR-2 fallback:** Triggers when confidence < 0.95

**Example Flow:**
```
1. DeepSeek-VL2 predicts "Phone" field at (150, 300)
2. Confidence: 0.92 (below 0.95 threshold)
3. System triggers olmOCR-2 for verification
4. olmOCR-2 confirms actual location: (148, 302)
5. Coordinate drift logged: 2px offset
6. Trauma signal: NEEDS_OLMOCR_VERIFICATION (yellow)
```

**Why it matters:**
- Shows VLM is working correctly
- Validates Consensus Protocol is active
- Tracks how often sites change layouts (coordinate drift)

---

## 🧪 **Testing Procedure**

### **Phase 1: Small Batch (5 Leads)**

1. **Enter test leads:**
   ```
   John Doe | Naples, FL
   Jane Smith | Miami, FL
   Robert Johnson | Fort Myers, FL
   Sarah Williams | Tampa, FL
   Michael Brown | Orlando, FL
   ```

2. **Click FIRE SWARM**

3. **Watch for:**
   - ✅ All 5 missions appear in log (status: QUEUED)
   - ✅ Status changes to PROCESSING within 10 seconds
   - ✅ Carrier assigned (T-Mobile, AT&T, or Verizon)
   - ✅ No red trauma signals
   - ✅ Entropy scores ≥ 0.70

4. **Check Chimera Core logs:**
   ```bash
   railway logs --service chimera-core --tail 50
   
   # Should see:
   # ✅ [CHIMERA-BODY] Mission consumed: mission_17687...
   # 🧬 Hardware entropy allocated
   # ✅ Stealth patches applied
   # INFO - Micro-tremor active
   ```

---

### **Phase 2: Full Batch (25 Leads)**

1. **Enter 25 leads** (real or test data)

2. **Click FIRE SWARM**

3. **Monitor:**
   - Mission log fills with 25 entries
   - Processing happens in parallel (5-10 workers)
   - Completion time: ~3-5 minutes for all 25

4. **Verify success rate:**
   - Target: ≥ 80% completion rate
   - Acceptable failures: Timeouts on high-security sites (TruePeopleSearch, etc.)
   - Red flags: Multiple CAPTCHA failures or low entropy scores

---

### **Phase 3: Trauma Monitoring**

1. **Watch Trauma Triage Panel** during processing

2. **Expected:**
   - 🟡 Yellow: NEEDS_OLMOCR_VERIFICATION (1-2 per batch is normal)
   - ✅ Green: No trauma signals (ideal)

3. **Investigate if:**
   - 🔴 Red: CAPTCHA_AGENT_FAILURE (indicates CAPTCHA solver issue)
   - 🔴 Red: Multiple TIMEOUT signals (indicates stealth not working)
   - 🔴 Red: LOW_ENTROPY (indicates data poisoning)

---

## 📊 **Expected Results**

### **Good Run (80%+ Success):**
```
TOTAL MISSIONS: 25
QUEUED: 0
PROCESSING: 3
COMPLETED: 20
FAILED: 2
SUCCESS RATE: 80.0%

Trauma Signals:
- 1x NEEDS_OLMOCR_VERIFICATION (yellow) ✅
- 2x TIMEOUT (red) ✅ (acceptable for high-security sites)
```

---

### **Problem Run (< 50% Success):**
```
TOTAL MISSIONS: 25
QUEUED: 10
PROCESSING: 0
COMPLETED: 5
FAILED: 10
SUCCESS RATE: 20.0%

Trauma Signals:
- 5x CAPTCHA_AGENT_FAILURE (red) ❌
- 3x TIMEOUT (red) ❌
- 2x LOW_ENTROPY (red) ❌

Action Required:
1. Check Chimera Core logs for errors
2. Verify CapSolver API key balance
3. Check mobile proxy status (Decodo)
4. Verify VLM is loaded correctly
```

---

## 🔧 **Troubleshooting**

### **Issue: No missions appearing in log**

**Check:**
1. Redis connection: Is `REDIS_URL` set in environment?
   ```bash
   railway variables --service brainscraper | grep REDIS_URL
   ```

2. API errors: Check BrainScraper logs
   ```bash
   railway logs --service brainscraper --tail 50 | grep ERROR
   ```

3. Network: Can BrainScraper reach Redis?
   ```bash
   # Should see Redis connections in logs
   railway logs --service brainscraper | grep "Redis client connected"
   ```

---

### **Issue: All missions timeout**

**Check:**
1. Chimera Core is running:
   ```bash
   railway logs --service chimera-core --tail 20
   
   # Should see:
   # ✅ PhantomWorker worker-0 ready
   # ✅ Connected to The Brain
   ```

2. gRPC connection to Brain:
   ```bash
   # Chimera Core logs should show Brain connection
   railway logs --service chimera-core | grep "Connected to The Brain"
   ```

3. Stealth is active:
   ```bash
   railway logs --service chimera-core | grep "Micro-tremor active"
   ```

---

### **Issue: High CAPTCHA failures**

**Check:**
1. CapSolver API key balance:
   ```bash
   # Log in to CapSolver dashboard: https://dashboard.capsolver.com
   # Check balance > $1.00
   ```

2. Autonomous agent is working:
   ```bash
   railway logs --service chimera-core | grep "CAPTCHA"
   
   # Should see attempts to solve with local VLM first
   # Then fallback to CapSolver if needed
   ```

---

### **Issue: Low entropy scores (poisoned data)**

**Investigate:**
1. Which sites are returning low entropy?
   ```bash
   # Check mission log - which sources have low entropy?
   # Likely: FastPeopleSearch, TruePeopleSearch, etc.
   ```

2. Check if sites have changed layout:
   ```bash
   railway logs --service chimera-core | grep "COORDINATE_DRIFT"
   
   # High drift = site changed layout
   # Need to update selectors in Trauma Center
   ```

3. Verify Trauma Center is active:
   ```bash
   railway logs --service chimera-brain-v1 | grep "Selector Registry"
   
   # Should see:
   # ✅ Selector Registry (Trauma Center) initialized
   ```

---

## 🎯 **Success Criteria**

### **System is ready for production when:**

- ✅ **Success rate ≥ 80%** on 25-lead batch
- ✅ **Mobile IP pinning verified** (carrier assigned per mission)
- ✅ **No data poisoning** (entropy scores ≥ 0.70)
- ✅ **VLM working** (coordinate drift logged, olmOCR-2 fallback active)
- ✅ **Stealth active** (micro-tremor, cognitive maps in logs)
- ✅ **Trauma signals minimal** (< 10% red flags)
- ✅ **No system errors** (Redis, gRPC, PostgreSQL all connected)

---

## 🚀 **Next Steps After Verification**

1. **Run Production Test:**
   - Fire 25 real leads
   - Verify data quality
   - Check completion rate

2. **Scale to 100 Leads:**
   - Batch 4x25 = 100 leads
   - Monitor system stability
   - Verify no memory leaks

3. **Target: 10,000 Leads/Week:**
   - ~1,400 leads/day
   - ~60 leads/hour
   - ~1 lead/minute (sustained)
   - 25-lead batches every 25 minutes

---

## 📋 **Deployment Checklist**

Before deploying V2 Pilot:

- [ ] BrainScraper Root Directory set in Railway dashboard
- [ ] `REDIS_URL` environment variable configured
- [ ] Chimera Core + Brain services online
- [ ] Scrapegoat enrichment API online
- [ ] Mobile proxy (Decodo) configured
- [ ] CapSolver API key valid (balance > $1.00)

After deployment:

- [ ] V2 Pilot page accessible at `/v2-pilot`
- [ ] Can fire 5-lead test batch
- [ ] Missions appear in log
- [ ] Status updates every 2 seconds
- [ ] Trauma signals display correctly
- [ ] VLM coordinate drift visible

**When all checkboxes are ✅, the system is production-ready.** 🚀
