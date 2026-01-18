# V2 Pilot - Diagnostic Command Center Layout

**Visual guide to the diagnostic interface components**

---

## 📐 **Complete Page Layout**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🧠 SOVEREIGN NEURAL PIPELINE - V2 PILOT                                     │
│ Direct access to Chimera Core worker swarm • Real-time telemetry           │
├─────────────────────────────────────────────────────────────────────────────┤
│                         STATS DASHBOARD                                     │
│ ┌─────────┬─────────┬───────────┬──────────┬─────────┬──────────────┐      │
│ │ TOTAL   │ QUEUED  │ PROCESSING│ COMPLETED│ FAILED  │ SUCCESS RATE │      │
│ │   25    │    0    │     3     │    20    │    2    │    80.0%     │      │
│ └─────────┴─────────┴───────────┴──────────┴─────────┴──────────────┘      │
├─────────────────────────────────────────────────────────────────────────────┤
│                    BATCH CONTROLLER + TRAUMA TRIAGE                         │
│ ┌────────────────────────────────────┬────────────────────────────────────┐ │
│ │ 🔥 25-LEAD BATCH CONTROLLER        │ 🚨 TRAUMA TRIAGE PANEL             │ │
│ │                                    │                                    │ │
│ │ [Text Area for bulk input]         │ 🔴 CAPTCHA_AGENT_FAILURE          │ │
│ │ Format: Name | Location            │    Mission: mission_17687...       │ │
│ │                                    │    Details: Autonomous agent failed│ │
│ │                                    │                                    │ │
│ │ [🚀 FIRE SWARM]  [CLEAR]           │ 🟡 NEEDS_OLMOCR_VERIFICATION      │ │
│ │                                    │    Mission: mission_17687...       │ │
│ │                                    │    Details: VLM confidence < 0.95  │ │
│ └────────────────────────────────────┴────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│              👁️ NEURAL SIGHT LIVE FEED (Grounding Mirror)                  │
│ ┌─────────────────────────────────────┬─────────────────────────────────┐  │
│ │ LIVE SCREENSHOT + OVERLAY           │ REGION PROPOSAL (200x200)       │  │
│ │                                     │                                 │  │
│ │ [Screenshot with overlays]          │ [200x200 zoomed crop]           │  │
│ │                                     │                                 │  │
│ │ • 🔵 Blue dot = Blueprint           │ VLM CONFIDENCE METER            │  │
│ │ • 🎯 Green crosshair = VLM click    │ ████████████░░░░ 87.5%          │  │
│ │ • ⚠️ DRIFT: 52px (if > 50px)        │                                 │  │
│ │                                     │ ⚡ FALLBACK TRIGGERED:           │  │
│ │                                     │    olmOCR-2 Secondary Pass      │  │
│ └─────────────────────────────────────┴─────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│           🕵️ STEALTH HEALTH DASHBOARD (Fingerprint Audit)                  │
│ ┌──────────────────┬───────────────────┬──────────────────────────────┐    │
│ │ FINGERPRINT      │ PROXY PINNING     │ HUMAN JITTER HEATMAP         │    │
│ │ SNAPSHOT         │ STATUS            │                              │    │
│ │                  │                   │ [Canvas with mouse path]     │    │
│ │ JA3: a0e9f5b6... │ ISP: T-Mobile     │                              │    │
│ │ User-Agent:      │ Session ID:       │ Last 10 movements            │    │
│ │ Mozilla/5.0...   │ session_17687...  │                              │    │
│ │ Sec-Ch-Ua:       │                   │ • Green path = natural       │    │
│ │ "Chrome"...      │ ✅ SESSION STABLE │ • Red overlay = mechanical   │    │
│ └──────────────────┴───────────────────┴──────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                    🎯 VLM COORDINATE DRIFT (Neural Mirror)                  │
│ ┌───────────────┬───────────────┬───────────────┬───────────────────────┐  │
│ │ John Doe      │ Jane Smith    │ Robert J.     │ [Click to select]     │  │
│ │ Suggested:    │ Suggested:    │ Suggested:    │                       │  │
│ │ (150, 300)    │ (200, 450)    │ (180, 350)    │                       │  │
│ │ Actual:       │ Actual:       │ Actual:       │                       │  │
│ │ (148, 302)    │ (198, 452)    │ (179, 351)    │                       │  │
│ │ Conf: 97.5%   │ Conf: 94.2%   │ Conf: 98.1%   │                       │  │
│ │ Drift: 2px    │ Drift: 3px    │ Drift: 1px    │                       │  │
│ └───────────────┴───────────────┴───────────────┴───────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│             📋 MISSION LOG (Live) - Click any row for Decision Trace        │
│ ┌───────┬───────────┬───────────┬───────────┬─────────┬──────┬──────┬────┐ │
│ │STATUS │MISSION ID │NAME       │LOCATION   │CARRIER  │VLM   │ENTR  │TIME│ │
│ ├───────┼───────────┼───────────┼───────────┼─────────┼──────┼──────┼────┤ │
│ │🔵PROC │mission_17.│John Doe   │Naples, FL │T-Mobile │95%   │0.87  │10:2│ │
│ │🟢DONE │mission_17.│Jane Smith │Miami, FL  │AT&T     │98%   │0.92  │10:2│ │
│ │🔴FAIL │mission_17.│Robert J.  │Tampa, FL  │Verizon  │65%   │0.45  │10:2│ │
│ │🟡QUEUE│mission_17.│Sarah W.   │Orlando, FL│-        │-     │-     │10:2│ │
│ └───────┴───────────┴───────────┴───────────┴─────────┴──────┴──────┴────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 **Interactive Elements**

### **1. Mission Cards (VLM Coordinate Drift)**

Click on any mission card to:
- ✅ Select mission for Neural Sight Live Feed
- ✅ Load screenshot with coordinate overlays
- ✅ Show region proposal zoom-in
- ✅ Display fingerprint in Stealth Health
- ✅ Render mouse heatmap

**Visual Indicator:**
- Selected mission: Cyan border + shadow
- Unselected: Blue border
- Hover: Lighter blue border

---

### **2. Mission Log Rows**

Click on any row to:
- ✅ Open Decision Trace modal
- ✅ View full THINK timeline
- ✅ See confidence bars
- ✅ Check entropy poison status

**Visual Indicator:**
- Selected row: Cyan background
- Unselected: Transparent
- Hover: Gray background

---

### **3. Decision Trace Modal**

Full-screen overlay with:
- Mission summary (ID, status, location)
- Execution timeline (step-by-step)
- Confidence bars for each step
- Timestamps
- Entropy poison check at bottom
- Close button (×) in top right

---

## 📊 **Color Coding System**

### **Status Colors:**

| Status | Color | Badge |
|--------|-------|-------|
| **Completed** | 🟢 Green | `bg-green-500` |
| **Processing** | 🔵 Blue | `bg-blue-500` |
| **Queued** | ⚪ Gray | `bg-gray-500` |
| **Failed** | 🔴 Red | `bg-red-500` |
| **Timeout** | 🟠 Orange | `bg-orange-500` |
| **CAPTCHA Failure** | 🟣 Purple | `bg-purple-500` |

---

### **Confidence Colors:**

| Confidence | Color | Range |
|------------|-------|-------|
| **High** | 🟢 Green | ≥ 95% |
| **Medium** | 🟡 Yellow | 80-95% |
| **Low** | 🔴 Red | < 80% |

---

### **Trauma Severity:**

| Severity | Color | Border |
|----------|-------|--------|
| **Red Flags** | 🔴 Red | `border-red-500` |
| **Yellow Flags** | 🟡 Yellow | `border-yellow-500` |

---

### **Entropy Scores:**

| Entropy | Color | Meaning |
|---------|-------|---------|
| **≥ 0.70** | 🟢 Green | Fresh data |
| **< 0.70** | 🔴 Red | Poisoned data |

---

## 🎨 **Component Borders**

- **Neural Sight Live Feed:** Cyan (`border-cyan-500`)
- **Stealth Health Dashboard:** Purple (`border-purple-500`)
- **VLM Coordinate Drift:** Blue (`border-blue-500`)
- **Trauma Triage Panel:** Yellow (`border-yellow-500`)
- **Mission Log:** Green (`border-green-500`)
- **Batch Controller:** Green (`border-green-500`)

---

## 📐 **Layout Breakpoints**

### **Desktop (≥ 1280px):**
- Stats: 6 columns (horizontal)
- Batch + Trauma: 2 columns (50/50)
- Neural Sight: 2 columns (50/50)
- Stealth Health: 3 columns (33/33/33)
- VLM Drift: 3 columns (33/33/33)
- Mission Log: Full width table

### **Tablet (768-1279px):**
- Stats: 3 columns (wrap to 2 rows)
- Batch + Trauma: Stack vertically
- Neural Sight: Stack vertically
- Stealth Health: Stack vertically
- VLM Drift: 2 columns
- Mission Log: Scrollable

### **Mobile (< 768px):**
- All sections stack vertically
- Tables scroll horizontally

---

## 🎯 **Key Visual Indicators**

### **Coordinate Overlay:**
```
[Screenshot]
   • Blue dot (8px) at Blueprint coords
   • Green crosshair (12px) at VLM coords
   • Line connecting them (if drift > 10px)
   • Yellow badge "⚠️ DRIFT: 52px" (if > 50px)
```

### **VLM Confidence Meter:**
```
████████████░░░░░░░░  60%
└────────────────────┘
     87.5%
```
- Green fill: ≥ 95%
- Yellow fill: 80-95%
- Red fill: < 80%

### **Mouse Heatmap:**
```
[Canvas 300x200]
• Background grid (20px)
• Green path connecting points
• Green dots (opacity gradient)
• Red overlay if mechanical
```

### **Decision Timeline:**
```
① Step Name                    Timestamp
  Action description
  Confidence: ████████████░░░░░░░░  92.5%
```

---

## ✅ **Success Visual Indicators**

When system is working correctly:

- ✅ Stats dashboard shows green success rate ≥ 80%
- ✅ Neural Sight shows green crosshair (not red X)
- ✅ Stealth Health shows green "SESSION STABLE"
- ✅ Mouse heatmap shows green path (no red overlay)
- ✅ VLM confidence bars are green (≥ 95%)
- ✅ Mission log rows turn green (COMPLETED status)
- ✅ Trauma triage panel shows "No trauma signals"

---

## 🚨 **Problem Visual Indicators**

When issues are detected:

- ❌ Coordinate drift > 50px → Yellow "⚠️ DRIFT" badge
- ❌ VLM confidence < 95% → Yellow meter + "FALLBACK TRIGGERED"
- ❌ IP changed → Red "🚨 SESSION BROKEN" alert
- ❌ Mechanical movement → Red overlay on heatmap
- ❌ Entropy < 0.70 → Red score + "POISON DETECTED"
- ❌ CAPTCHA failure → Red trauma signal
- ❌ Mission failed → Red status badge in log

---

## 📱 **Responsive Design**

All components are responsive using Tailwind CSS:
- `sm:` - Small devices (≥ 640px)
- `md:` - Medium devices (≥ 768px)
- `lg:` - Large devices (≥ 1024px)
- `xl:` - Extra large devices (≥ 1280px)

Grid layouts collapse to single column on mobile.
Tables become horizontally scrollable.
Modal stays full-screen on all devices.

---

## 🎨 **Color Palette**

| Element | Color | Hex |
|---------|-------|-----|
| Background | Black | `#000000` |
| Surface | Dark Gray | `#1a1a1a` |
| Primary Text | Green | `#10b981` |
| Secondary Text | Gray | `#6b7280` |
| Success | Green | `#10b981` |
| Warning | Yellow | `#fbbf24` |
| Error | Red | `#ef4444` |
| Info | Blue | `#3b82f6` |
| Accent | Cyan | `#06b6d4` |
| Purple | Purple | `#a855f7` |

---

## 🚀 **This is the V2 Pilot Diagnostic Command Center**

**A production-grade diagnostic interface for the Sovereign Neural Pipeline.**

All visual indicators are designed to provide instant feedback on:
- VLM decision-making accuracy
- Stealth health and fingerprint stability
- Behavioral pattern naturalness
- Mission execution traceability
- Data quality and freshness

**Deploy it, fire a 25-lead batch, and watch your neural pipeline work in real-time.** 🧠🚀
