# V2 Pilot - RapidAPI LinkedIn Integration

**Date:** 2026-01-18  
**Purpose:** Connect LinkedIn Sales Navigator RapidAPI directly to V2 Pilot for real-data testing  
**Status:** ✅ **COMPLETE - READY FOR TESTING**

---

## 🎯 **What Was Added**

A **Quick Search** feature that:
1. Connects directly to LinkedIn Sales Navigator RapidAPI
2. Generates real leads based on search criteria
3. Automatically pushes them to Chimera swarm
4. Lets you watch diagnostic features with real data

**This replaces manual lead entry for testing purposes.**

---

## 📁 **Files Created/Updated**

| File | Status | Purpose |
|------|--------|---------|
| `brainscraper/app/api/v2-pilot/quick-search/route.ts` | ✅ **NEW** | Simplified RapidAPI interface |
| `brainscraper/app/v2-pilot/page.tsx` | ✅ **UPDATED** | Added Quick Search UI + handler |

---

## 🔌 **How It Works**

### **Flow:**

```
User enters search criteria in V2 Pilot
         ↓
Quick Search API (/api/v2-pilot/quick-search)
         ↓
LinkedIn Sales Navigator API (/api/linkedin-sales-navigator)
         ↓
RapidAPI (premium_search_person endpoint)
         ↓
Format leads for V2 Pilot
         ↓
Fire Swarm API (/api/v2-pilot/fire-swarm)
         ↓
Push missions to chimera:missions Redis queue
         ↓
Chimera Core workers consume missions
         ↓
Real-time telemetry flows back to V2 Pilot
```

---

## 🎨 **UI Components**

### **Quick Search Form (Top section):**

```
┌─────────────────────────────────────────────────────┐
│ 🔥 LEAD INJECTION CONTROLLER                        │
├─────────────────────────────────────────────────────┤
│ [📝 MANUAL INPUT] [🔍 QUICK SEARCH (RapidAPI)]      │
├─────────────────────────────────────────────────────┤
│ Generate real leads from LinkedIn Sales Navigator   │
│                                                     │
│ [Name: ____________________]                        │
│ [Location: ________________]                        │
│ [Job Title: _______________]                        │
│ [Limit: 25 leads ▼]                                │
│                                                     │
│ [🔍 QUICK SEARCH & FIRE]                           │
├─────────────────────────────────────────────────────┤
│ Or manually enter leads: Name | Location           │
│ [Text Area]                                        │
│ [🚀 FIRE MANUAL BATCH] [CLEAR]                     │
└─────────────────────────────────────────────────────┘
```

### **Search Parameters:**

- **Name** (optional): First name or full name (e.g., "John Doe")
- **Location** (optional): City, State, or Region (e.g., "Naples, FL")
- **Job Title** (optional): Position/title (e.g., "CEO", "Marketing Director")
- **Limit**: Number of leads to generate (10, 25, 50, or 100)

**At least ONE parameter required.**

---

## 🧪 **Usage Examples**

### **Example 1: Search by Location**

**Input:**
- Name: *(blank)*
- Location: `Naples, FL`
- Job Title: *(blank)*
- Limit: `25 leads`

**Result:**
- Searches LinkedIn for 25 people in Naples, FL
- Automatically fires missions to Chimera swarm
- Alert: "✅ Found 25 leads and fired 25 missions to Chimera swarm"

---

### **Example 2: Search by Job Title**

**Input:**
- Name: *(blank)*
- Location: *(blank)*
- Job Title: `CEO`
- Limit: `10 leads`

**Result:**
- Searches LinkedIn for 10 CEOs
- Fires to Chimera swarm
- Alert: "✅ Found 10 leads and fired 10 missions to Chimera swarm"

---

### **Example 3: Combined Search**

**Input:**
- Name: `John`
- Location: `Miami, FL`
- Job Title: `Marketing Director`
- Limit: `50 leads`

**Result:**
- Searches for people named John in Miami, FL with title "Marketing Director"
- Fires up to 50 missions
- Alert: "✅ Found 50 leads and fired 50 missions to Chimera swarm"

---

## 🔍 **API Endpoint Details**

### **POST /api/v2-pilot/quick-search**

**Purpose:** Simplified interface to LinkedIn Sales Navigator RapidAPI

**Request:**
```json
{
  "name": "John Doe",
  "location": "Naples, FL",
  "jobTitle": "CEO",
  "limit": 25
}
```

**Response (Success):**
```json
{
  "success": true,
  "leads": [
    {
      "name": "John Doe",
      "location": "Naples, FL",
      "linkedinUrl": "https://linkedin.com/in/johndoe",
      "title": "CEO",
      "company": "Acme Corp",
      "profilePictureUrl": "https://...",
      "headline": "CEO at Acme Corp"
    }
  ],
  "count": 25,
  "searchParams": { ... },
  "totalResults": 25
}
```

**Response (No Results):**
```json
{
  "success": true,
  "leads": [],
  "count": 0,
  "message": "No leads found matching search criteria"
}
```

**Response (Error):**
```json
{
  "error": "LinkedIn API error",
  "message": "Rate limit exceeded. Please wait 60 seconds.",
  "details": { ... }
}
```

---

## ⚙️ **Parameter Mapping**

The Quick Search API maps simplified parameters to LinkedIn API format:

| Quick Search Param | LinkedIn API Param | Mapping Logic |
|--------------------|-------------------|---------------|
| `name` | `firstName`, `lastName` | Splits on space |
| `location` | `location` | Direct pass-through |
| `jobTitle` | `jobTitle` | Direct pass-through |
| `limit` | `limit` | Direct pass-through (default: 25) |

**Behind the scenes:**
- Always uses `premium_search_person` endpoint
- Sets `page: 1` (single page search)
- Uses existing LinkedIn location discovery logic
- Respects rate limits and cooldowns

---

## 🚨 **Error Handling**

### **Scenario 1: No Search Parameters**

**User Action:** Click "QUICK SEARCH & FIRE" with all fields blank

**Response:** Alert: "⚠️ Please enter at least one search parameter"

---

### **Scenario 2: LinkedIn API Rate Limit**

**User Action:** Multiple searches in quick succession

**Response:** Alert: "❌ Search failed: Rate limit exceeded. Please wait 60 seconds."

**Handling:**
- Quick Search API propagates LinkedIn API errors
- Cooldown system kicks in automatically
- Retry countdown displays in alert

---

### **Scenario 3: No Results Found**

**User Action:** Search for very specific criteria (e.g., "CEO in Antarctica")

**Response:** Alert: "⚠️ No leads found matching search criteria"

**Handling:**
- No missions fired
- Stats remain unchanged
- User can try different search criteria

---

### **Scenario 4: Account Frozen**

**User Action:** Exceeded LinkedIn scraping limits

**Response:** Alert: "❌ Search failed: Account frozen for 60 minutes"

**Handling:**
- Quick Search disabled during freeze
- Countdown timer shows time remaining
- Manual input still works

---

## 🧪 **Testing Procedure**

### **Phase 1: Basic Quick Search (5 minutes)**

1. **Open V2 Pilot:**
   ```
   URL: https://brainscraper-production.up.railway.app/v2-pilot
   ```

2. **Enter search criteria:**
   - Location: `Naples, FL`
   - Limit: `10 leads`
   - Click **🔍 QUICK SEARCH & FIRE**

3. **Expected:**
   - ✅ Alert: "✅ Found 10 leads and fired 10 missions to Chimera swarm"
   - ✅ Mission log updates with 10 entries
   - ✅ Stats show Total: 10, Queued: 10
   - ✅ Search fields clear automatically

---

### **Phase 2: Watch Diagnostic Features (10 minutes)**

1. **After firing leads, wait 30 seconds**

2. **Observe:**
   - ✅ Missions change from QUEUED to PROCESSING
   - ✅ VLM drift cards appear as missions process
   - ✅ Stats update in real-time
   - ✅ Eventually some missions complete

3. **Click on a processing mission:**
   - ✅ Neural Sight shows screenshot (if telemetry active)
   - ✅ Stealth Health shows fingerprints
   - ✅ Mouse heatmap displays movements
   - ✅ Decision trace modal opens on click

---

### **Phase 3: Compare Quick Search vs Manual (5 minutes)**

1. **Quick Search:**
   - Enter: Location: `Miami, FL`, Limit: `5 leads`
   - Click **🔍 QUICK SEARCH & FIRE**
   - Result: 5 real LinkedIn leads with profile data

2. **Manual Input:**
   - Enter in text area:
     ```
     Test User 1 | Naples, FL
     Test User 2 | Miami, FL
     Test User 3 | Tampa, FL
     ```
   - Click **🚀 FIRE MANUAL BATCH**
   - Result: 3 test leads with basic data

3. **Compare in Mission Log:**
   - ✅ Quick Search leads have LinkedIn URLs
   - ✅ Quick Search leads have real names/locations
   - ✅ Manual leads have test data

---

## 📊 **Benefits of Quick Search**

| Feature | Manual Input | Quick Search |
|---------|-------------|--------------|
| **Data Source** | User types names | Real LinkedIn profiles |
| **Speed** | Slow (manual typing) | Fast (API fetch) |
| **Data Quality** | Basic (name + location) | Rich (title, company, LinkedIn URL) |
| **Testing Realism** | Low (fake data) | High (real people) |
| **Enrichment Ready** | Limited info | Full profile data |
| **Use Case** | Quick tests | Production-like testing |

---

## 🔒 **Security & Rate Limits**

### **RapidAPI Key:**
- Quick Search uses existing `RAPIDAPI_KEY` environment variable
- Same key as main LinkedIn Lead Generator
- No additional configuration needed

### **Rate Limits:**
- Quick Search respects existing cooldown system
- Same limits as main LinkedIn scraping
- Cooldown kicks in if errors spike

### **Scrape Limits:**
- Quick Search counts toward daily/monthly limits
- Check limits in Settings page
- Default: 100/day, 500/month

---

## ⚙️ **Configuration**

### **Environment Variables (Already Set):**

```bash
RAPIDAPI_KEY=your-rapidapi-key  # Required for LinkedIn API
REDIS_URL=redis://...           # Required for mission queue
```

### **Default Settings:**

- **Default Limit:** 25 leads
- **Max Limit:** 100 leads (configurable in dropdown)
- **Endpoint:** `premium_search_person` (people search only)
- **Page:** 1 (single page results)

---

## 🎯 **Use Cases**

### **1. Quick Testing**
**Scenario:** Want to test diagnostic features quickly

**Solution:**
- Enter simple search (e.g., Location: "Naples, FL")
- Fire 10 leads
- Watch telemetry in real-time

---

### **2. Production-like Testing**
**Scenario:** Need to test with real data before 25-lead batch

**Solution:**
- Use specific search criteria (Job Title + Location)
- Fire 25 leads
- Monitor success rate, trauma signals, entropy scores

---

### **3. A/B Testing Search Parameters**
**Scenario:** Testing which locations yield better results

**Solution:**
- Search 1: Location "Naples, FL", 10 leads
- Search 2: Location "Miami, FL", 10 leads
- Compare completion rates in mission log

---

### **4. Fallback to Manual**
**Scenario:** API rate limited or account frozen

**Solution:**
- Quick Search disabled during cooldown
- Use manual input instead
- Paste CSV data or type manually

---

## ✅ **Success Criteria**

**Quick Search is working when:**

- ✅ Search form accepts input
- ✅ Button disabled when no parameters entered
- ✅ Alert shows "Found X leads and fired Y missions"
- ✅ Mission log updates with new entries
- ✅ Stats dashboard increments
- ✅ Search fields clear after success
- ✅ Error alerts display on failure
- ✅ Diagnostic features work with real data

---

## 🚀 **Deployment**

**Files already updated:**
- ✅ `brainscraper/app/api/v2-pilot/quick-search/route.ts`
- ✅ `brainscraper/app/v2-pilot/page.tsx`

**No additional deployment steps needed.**

When you deploy V2 Pilot (per `V2_PILOT_DEPLOYMENT_CHECKLIST.md`), Quick Search will be included automatically.

---

## 🎯 **Next Steps**

### **After Deployment:**

1. **Test Quick Search:**
   - Open V2 Pilot
   - Enter search criteria
   - Click "🔍 QUICK SEARCH & FIRE"
   - Verify leads appear

2. **Watch Diagnostics:**
   - Click on missions as they process
   - Verify Neural Sight, Stealth Health, Decision Traces work

3. **Compare with Manual:**
   - Try both Quick Search and Manual Input
   - Verify both work correctly

---

## 🎨 **Visual Preview**

### **Before (Manual Input Only):**
```
┌─────────────────────────────────┐
│ 25-LEAD BATCH CONTROLLER        │
├─────────────────────────────────┤
│ [Text Area for manual entry]    │
│ [FIRE SWARM] [CLEAR]            │
└─────────────────────────────────┘
```

### **After (Quick Search + Manual):**
```
┌─────────────────────────────────┐
│ LEAD INJECTION CONTROLLER       │
├─────────────────────────────────┤
│ [MANUAL] [QUICK SEARCH]    ← Tabs
├─────────────────────────────────┤
│ Quick Search:                   │
│ [Name: ______]                  │
│ [Location: __]                  │
│ [Job Title: _]                  │
│ [Limit: 25▼]                    │
│ [🔍 QUICK SEARCH & FIRE]        │
├─────────────────────────────────┤
│ Or manually:                    │
│ [Text Area]                     │
│ [FIRE MANUAL] [CLEAR]           │
└─────────────────────────────────┘
```

---

## 📚 **Summary**

**What we added:**
- ✅ Quick Search form in V2 Pilot
- ✅ Direct RapidAPI LinkedIn integration
- ✅ Automatic mission firing
- ✅ Real-time testing with actual data

**What you get:**
- ✅ Fast testing without manual typing
- ✅ Real LinkedIn profiles with rich data
- ✅ Production-like diagnostic testing
- ✅ Fallback to manual input when needed

**This bridges the gap between the main LinkedIn Lead Generator and V2 Pilot diagnostic interface, giving you the best of both worlds: real data + real-time telemetry.** 🚀
