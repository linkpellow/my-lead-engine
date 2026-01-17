# LinkedIn → Enrichment Pipeline - Complete Flow

## 🎯 Overview

Your system has **TWO enrichment paths**:

1. **Current Path**: BrainScraper in-memory enrichment (uses APIs)
2. **Future Path**: Redis Queue → Scrapegoat Workers (uses scrapers + APIs)

This document explains BOTH paths and the full 6-stage enrichment pipeline.

---

## 📊 CURRENT PATH (In-Memory API Enrichment)

### Flow Diagram
```
User searches LinkedIn
      ↓
LinkedInLeadGenerator.tsx
      ↓
RapidAPI: premium_search_person
      ↓
Leads saved locally
      ↓
User clicks "Enrich"
      ↓
enrichData() - In-Memory Processing
  ├─ Skip-Tracing APIs (RapidAPI)
  ├─ Telnyx Phone Validation
  ├─ DNC Scrubbing (USHA)
  ├─ Census APIs (Income/Age)
      ↓
Aggregate to enriched-all-leads.json
      ↓
Display on /enriched page
```

### Step-by-Step

**1. LinkedIn Scraping**
- User searches via `LinkedInLeadGenerator.tsx`
- Calls RapidAPI: `premium_search_person`
- Returns: `{ name, location, title, company, linkedinUrl }`
- Leads saved to browser/localStorage

**2. Enrichment Trigger**
- User clicks "Enrich" button
- Calls `/api/migrate-saved-leads` or `/api/re-enrich-leads`
- Passes leads to `enrichData()` function

**3. In-Memory Enrichment** (`utils/enrichData.ts`)
- Processes each lead synchronously
- Calls skip-tracing APIs (RapidAPI)
- Validates phone via Telnyx
- Checks DNC via USHA
- Pulls demographics via Census APIs
- Returns enriched leads

**4. Aggregation**
- Saves to `enriched-all-leads.json`
- Displays on `/enriched` page
- Uses deduplication keys (LinkedIn URL, name+email+phone)

---

## 🚀 FUTURE PATH (Redis Queue → Scrapegoat Workers)

### Flow Diagram
```
User searches LinkedIn
      ↓
LinkedInLeadGenerator.tsx
      ↓
RapidAPI: premium_search_person
      ↓
LPUSH to Redis Queue: "leads_to_enrich"
      ↓
┌─────────────────────────────────────┐
│   Redis Queue (Persistent Buffer)   │
│   Queue: leads_to_enrich            │
│   DLQ: failed_leads                 │
└─────────────────────────────────────┘
      ↓
BRPOP (5+ Worker Replicas)
      ↓
┌─────────────────────────────────────┐
│  Scrapegoat Worker (redis_queue_worker.py)│
│  Process Lead Through 6 Stages:     │
│                                      │
│  STEP 1: Identity Resolution        │
│  STEP 2: Scraper-Based Enrichment   │  ⭐ NEW
│  STEP 3: Telnyx Gatekeep            │
│  STEP 4: USHA DNC Scrub             │
│  STEP 5: Demographic Enrichment     │
│  STEP 6: Save to PostgreSQL         │
└─────────────────────────────────────┘
      ↓
PostgreSQL Database (leads table)
      ↓
Query from /enriched page
```

---

## 🔄 THE 6-STAGE ENRICHMENT PIPELINE

### Stage 1: Identity Resolution
**File**: `scrapegoat/app/enrichment/identity_resolution.py`

**Input:**
```json
{
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "name": "John Doe",
  "location": "Naples, Florida, United States",
  "title": "Software Engineer",
  "company": "Acme Corp"
}
```

**Process:**
- Parse name → `firstName`, `lastName`
- Parse location → `city`, `state`, `zipcode`
- Extract LinkedIn URL
- Normalize format

**Output:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "city": "Naples",
  "state": "FL",
  "zipcode": "34101",
  "linkedinUrl": "https://linkedin.com/in/johndoe"
}
```

**Rejection Criteria:**
- ❌ Missing first name or last name
- ❌ Invalid location format

---

### Stage 2: Scraper-Based Enrichment ⭐ **NEW**
**File**: `scrapegoat/app/enrichment/scraper_enrichment.py`

**Purpose:** Extract phone, age, income from people search sites (replaces expensive skip-tracing APIs)

**Input:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "city": "Naples",
  "state": "FL",
  "zipcode": "34101"
}
```

**Process:**

**2a. Load Blueprint** (from Dojo mapping)
- Checks: FastPeopleSearch → That's Them → TruePeopleSearch → Whitepages
- Loads extraction blueprint (JSON paths for phone/age/income)

**2b. Parallel Scraping** (3 sites at once)
```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ FastPeopleSearch │  │   That's Them    │  │ TruePeopleSearch │
│                  │  │                  │  │                  │
│ BaseScraper:     │  │ BaseScraper:     │  │ BaseScraper:     │
│ • Stealth mode   │  │ • Stealth mode   │  │ • Stealth mode   │
│ • Proxy rotation │  │ • Proxy rotation │  │ • Proxy rotation │
│ • Rate limiting  │  │ • Rate limiting  │  │ • Rate limiting  │
│ • CAPTCHA solve  │  │ • CAPTCHA solve  │  │ • CAPTCHA solve  │
│ • Circuit break  │  │ • Circuit break  │  │ • Circuit break  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         │                      │                      │
         └──────────────────────┴──────────────────────┘
                           ↓
                  First Success Wins!
```

**2c. BaseScraper Capabilities** (FULL UTILIZATION)
- ✅ **Stealth Mode**: curl_cffi with Chrome TLS fingerprint (bypasses bot detection)
- ✅ **Proxy Rotation**: Decodo residential proxies (auto-detected from `DECODO_API_KEY`)
- ✅ **Rate Limit Awareness**: Reads `X-RateLimit-*` headers, auto-slows down
- ✅ **Circuit Breaking**: Per-site health tracking, fails fast if site down
- ✅ **CAPTCHA Solving**: Auto-detects and solves via CAPSOLVER (reCAPTCHA, Turnstile, Cloudflare, AWS WAF)
- ✅ **Flight Recorder**: Logs failed requests for Dojo analysis
- ✅ **Adaptive Retries**: 3 retries with exponential backoff

**2d. Extraction** (using Dojo blueprints)
```python
# Blueprint contains JSON paths:
{
  "phone": "$.data.person.phones[0].number",
  "age": "$.data.person.age",
  "income": "$.data.person.householdIncome"
}

# BaseScraper extracts using paths:
result = extractor.run(name="John Doe", city="Naples", state="FL")
# Returns: { phone: "+15551234567", age: 42, income: "$75,000" }
```

**2e. Normalization**
- Phone → `+1XXXXXXXXXX` format
- Age → Validate 18-120 range
- Income → `$XX,XXX` format

**Output:**
```json
{
  "phone": "+15551234567",
  "age": 42,
  "income": "$75,000",
  "email": "john.doe@example.com"  // Bonus if found
}
```

**Fallback:**
- If scraper fails → Falls back to skip-tracing API (RapidAPI)
- If all fail → Lead rejected (no phone found)

**Rejection Criteria:**
- ❌ No phone number found (neither scraper nor API)
- ❌ All sites circuit-broken (all failing)

---

### Stage 3: Telnyx Gatekeep (Cost Saver) 💰
**File**: `scrapegoat/app/enrichment/telnyx_gatekeep.py`

**Purpose:** Validate phone BEFORE expensive API calls (saves costs)

**Input:**
```json
{ "phone": "+15551234567" }
```

**Process:**
- Calls Telnyx API: Validate phone number
- Checks: Line type (mobile, landline, VOIP)
- Checks: Carrier (T-Mobile, Verizon, AT&T, etc.)
- Checks: Risk score

**Validation Rules:**
- ✅ **PASS**: Mobile number, good carrier, low risk
- ❌ **REJECT**: VOIP/Landline/junk carrier
- ❌ **REJECT**: High risk score

**Output:**
```json
{
  "carrier": "T-Mobile",
  "lineType": "mobile",
  "riskScore": 0.2,
  "valid": true
}
```

**Rejection Criteria:**
- ❌ VOIP number (can't text/call reliably)
- ❌ Landline (not useful for outreach)
- ❌ Junk carrier (fraud risk)
- ❌ High risk score (>0.7)

**⚠️ CRITICAL**: If rejected here, **STOP** - no further API calls (saves money)

---

### Stage 4: USHA DNC Scrub 📞
**File**: `scrapegoat/app/enrichment/dnc_scrub.py`

**Purpose:** Check Do-Not-Call registry (legal compliance)

**Input:**
```json
{ "phone": "+15551234567" }
```

**Process:**
- Calls USHA API: `/api/leads/scrubphonenumber`
- Checks: National DNC registry
- Checks: State DNC registry (if applicable)
- Returns: Can contact status

**Output:**
```json
{
  "status": "clean",
  "can_contact": true,
  "dnc_registries_checked": ["national", "state_fl"]
}
```

**Rejection Criteria:**
- ❌ On national DNC list
- ❌ On state DNC list (if state-specific restrictions)
- ❌ Request failed (assume not safe)

**⚠️ CRITICAL**: If on DNC list, **STOP** - illegal to contact

---

### Stage 5: Demographic Enrichment 📊
**File**: `scrapegoat/app/enrichment/demographics.py`

**Purpose:** Add income and age data (if not already from scraper)

**Input:**
```json
{
  "city": "Naples",
  "state": "FL",
  "zipcode": "34101",
  "age": 42,        // May already be from scraper
  "income": "$75,000"  // May already be from scraper
}
```

**Process:**
- If age/income missing → Calls Census API or RapidAPI
- Census API: Median household income by zipcode
- Census API: Median age by zipcode (if missing)

**Output:**
```json
{
  "income": "$75,000",  // From scraper OR Census API
  "age": 42,            // From scraper OR Census API
  "medianIncomeZip": "$72,000",
  "medianAgeZip": 45
}
```

**Note:** If scraper already found age/income, this step may skip (no redundant API calls)

---

### Stage 6: Save to Database 💾
**File**: `scrapegoat/app/enrichment/database.py`

**Purpose:** Persist enriched lead to PostgreSQL

**Input:** Complete enriched lead object
```json
{
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "name": "John Doe",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+15551234567",
  "email": "john.doe@example.com",
  "city": "Naples",
  "state": "FL",
  "zipcode": "34101",
  "age": 42,
  "income": "$75,000",
  "dnc_status": "clean",
  "can_contact": true,
  "carrier": "T-Mobile",
  "lineType": "mobile"
}
```

**Process:**
- Deduplication: Uses `linkedin_url` as unique key
- ON CONFLICT: Updates existing record (preserves data)
- Validates required fields: phone, name
- Timestamps: `enriched_at`, `created_at`

**SQL:**
```sql
INSERT INTO leads (
  linkedin_url, name, first_name, last_name,
  phone, email, city, state, zipcode,
  age, income, dnc_status, can_contact,
  carrier, line_type, enriched_at
)
VALUES (...)
ON CONFLICT (linkedin_url)
DO UPDATE SET
  phone = COALESCE(leads.phone, EXCLUDED.phone),
  age = COALESCE(leads.age, EXCLUDED.age),
  income = COALESCE(leads.income, EXCLUDED.income),
  can_contact = EXCLUDED.can_contact,
  enriched_at = NOW()
```

**Output:**
- ✅ Success: Lead saved to PostgreSQL
- ❌ Failure: Lead pushed to `failed_leads` DLQ (after 3 retries)

---

## 🎯 FULL ENRICHMENT PIPELINE SUMMARY

### Input → Output Transformation

**Before Enrichment:**
```json
{
  "name": "John Doe",
  "location": "Naples, Florida",
  "linkedinUrl": "https://linkedin.com/in/johndoe"
}
```

**After Enrichment:**
```json
{
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "name": "John Doe",
  "firstName": "John",
  "lastName": "Doe",
  
  // From Scraper (Stage 2)
  "phone": "+15551234567",
  "email": "john.doe@example.com",
  "age": 42,
  "income": "$75,000",
  
  // From Telnyx (Stage 3)
  "carrier": "T-Mobile",
  "lineType": "mobile",
  "riskScore": 0.2,
  
  // From DNC (Stage 4)
  "dnc_status": "clean",
  "can_contact": true,
  
  // From Demographics (Stage 5)
  "city": "Naples",
  "state": "FL",
  "zipcode": "34101",
  
  // Metadata
  "enriched_at": "2026-01-15T10:30:00Z",
  "can_contact": true
}
```

---

## ⚡ KEY CAPABILITIES NOW ENABLED

### BaseScraper (Step 2) - FULL POWER

| Capability | Status | Benefit |
|------------|--------|---------|
| **Stealth Mode** | ✅ Active | Bypasses bot detection (Chrome TLS fingerprint) |
| **Proxy Rotation** | ✅ Auto | Decodo residential proxies (rotates per request) |
| **Rate Limiting** | ✅ Auto | Reads `X-RateLimit-*` headers, slows down automatically |
| **Circuit Breaking** | ✅ Active | Fails fast if site down (5 failures → circuit opens) |
| **CAPTCHA Solving** | ✅ Auto | CAPSOLVER solves reCAPTCHA, Turnstile, Cloudflare, AWS WAF |
| **Flight Recorder** | | Logs failed requests for Dojo analysis |
| **Parallel Attempts** | ✅ Active | Tries 3 sites simultaneously (faster) |
| **Response Validation** | ✅ Active | Validates structure, age ranges, phone format |

### CAPTCHA Auto-Solving (NEW)

When enrichment site shows CAPTCHA:
1. **Auto-Detected**: BaseScraper detects CAPTCHA in response (403/503)
2. **Auto-Solved**: CAPSOLVER solves it (reCAPTCHA, Turnstile, Cloudflare)
3. **Auto-Retry**: Request retried with solution
4. **Seamless**: Extraction continues without manual intervention

### Cost Optimization

- **Scraper First**: Uses free/cheap scraping instead of expensive APIs
- **Early Rejection**: Telnyx gatekeep rejects bad phones BEFORE expensive calls
- **DNC Early**: Rejects DNC leads BEFORE demographic enrichment
- **No Redundancy**: If scraper finds age/income, skips Census API

---

## 🔗 Integration Points

### Redis Queue Format
```json
{
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "name": "John Doe",
  "location": "Naples, Florida, United States",
  "title": "Software Engineer",
  "company": "Acme Corp",
  "platform": "linkedin",
  "timestamp": "2026-01-15T10:00:00Z"
}
```

### PostgreSQL Schema
```sql
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  linkedin_url VARCHAR(255) UNIQUE,
  name VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zipcode VARCHAR(10),
  age INTEGER,
  income VARCHAR(50),
  carrier VARCHAR(100),
  line_type VARCHAR(20),
  dnc_status VARCHAR(20),
  can_contact BOOLEAN,
  enriched_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## ✅ SUCCESS CRITERIA

A lead is **fully enriched** when:

1. ✅ Phone number found (scraper OR API)
2. ✅ Phone validated as mobile (Telnyx)
3. ✅ NOT on DNC list (USHA)
4. ✅ Age ≤ 59 (if provided)
5. ✅ Income data (if available)
6. ✅ Saved to PostgreSQL with deduplication

**Rejection Points:**
- ❌ No phone → Reject (Stage 2)
- ❌ VOIP/Landline → Reject (Stage 3)
- ❌ On DNC list → Reject (Stage 4)
- ❌ Database save fails → DLQ (Stage 6)

---

## 🎯 CURRENT vs FUTURE

| Aspect | Current (In-Memory) | Future (Redis Queue) |
|--------|---------------------|----------------------|
| **Scraper-Based** | ❌ Uses APIs only | ✅ Uses scrapers + APIs |
| **CAPTCHA Solving** | ❌ Not available | ✅ Auto-solved |
| **Parallel Sites** | ❌ Sequential | ✅ 3 sites at once |
| **Persistence** | JSON file | PostgreSQL |
| **Scalability** | Single process | 5+ worker replicas |
| **Fault Tolerance** | Lost on crash | Redis queue persists |

---

## 🚀 TO ENABLE REDIS QUEUE PATH

**In BrainScraper** (LinkedInLeadGenerator.tsx):
```typescript
// Instead of enrichData() directly:
// await enrichData(parsedData)

// Push to Redis queue:
await redisClient.lPush('leads_to_enrich', JSON.stringify(lead));
```

**Scrapegoat Workers** (already configured):
- 5+ replicas polling Redis queue
- Process through 6-stage pipeline
- Save to PostgreSQL

---

## 📋 SUMMARY

**Your enrichment pipeline is now:**

1. ✅ **Scraper-First**: Uses people search scrapers (cheaper)
2. ✅ **Stealth**: Full BaseScraper power (proxies, rate limiting, CAPTCHA)
3. ✅ **Smart**: Early rejection saves costs (Telnyx → DNC)
4. ✅ **Resilient**: Circuit breaking, retries, DLQ for failures
5. ✅ **Compliant**: DNC scrubbing ensures legal outreach
6. ✅ **Complete**: Phone + Age + Income + Contact validation

**The moment of truth:** Your LinkedIn leads WILL be enriched with phone, age, and income from people search sites, using your own scrapers (powered by BaseScraper + CAPSOLVER) instead of expensive APIs.
