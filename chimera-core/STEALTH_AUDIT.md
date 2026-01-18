# Chromium Stealth Implementation Audit - chimera-core

## 🔴 Critical Finding: Rust Codebase Migrated to Python

**Status:** The Rust implementation (`workers.rs`, `validation.rs`, `stealth.rs`) was **completely removed** during the migration to Python 3.12.

**Current State:**
- ✅ Python 3.12 service structure exists
- ✅ Dependencies installed (Playwright, etc.)
- ❌ **Stealth implementation is MISSING** - only healthcheck placeholder exists

---

## 📋 Current Implementation Status

### ✅ What Exists

**File:** `chimera-core/main.py`
- ✅ Healthcheck server (Railway requirement)
- ✅ Basic service structure
- ❌ **TODO:** gRPC client to connect to The Brain
- ❌ **TODO:** Worker swarm logic
- ❌ **TODO:** Stealth browser automation

**Dependencies:** `chimera-core/requirements.txt`
- ✅ `playwright>=1.40.0` (browser automation)
- ✅ `curl_cffi>=0.5.10` (TLS fingerprint stealth)
- ✅ All required packages present

---

## ❌ What's Missing

### 1. Stealth Browser Implementation

**Required:**
- ❌ Chromium launch with stealth arguments
- ❌ `--disable-blink-features=AutomationControlled` flag
- ❌ Canvas/WebGL fingerprint randomization
- ❌ Behavioral jitter (human-like timing)
- ❌ Diffusion-based mouse paths
- ❌ CreepJS validation logic

### 2. Worker Swarm Logic

**Required:**
- ❌ Multiple worker instances
- ❌ Queue processing (Redis)
- ❌ Mission execution
- ❌ Screenshot capture and gRPC communication

### 3. Validation Module

**Required:**
- ❌ `validate_creepjs()` function
- ❌ Trust score verification
- ❌ Stealth parameter testing

---

## 🔍 Reference Implementation

**Found:** Comprehensive stealth implementation exists in `scrapegoat/app/scraping/browser_mode.py`

**Key Features:**
- ✅ `BrowserModeScraper` class with full stealth
- ✅ Playwright integration
- ✅ Fingerprint spoofing (Canvas, WebGL, Audio)
- ✅ Human behavior simulation
- ✅ WebRTC leak prevention

**Location:** `scrapegoat/app/scraping/browser_mode.py:174-894`

**Relevant Code Snippet:**
```python
# Launch args include stealth parameters
launch_args = [
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    # ... more stealth args
]

# Apply stealth patches
if self.stealth:
    await self._apply_stealth_patches()
```

---

## 🛠️ Implementation Requirements

### Phase 1: Basic Stealth Browser

**File:** `chimera-core/stealth.py` (NEW)

**Required Functions:**
```python
async def create_stealth_browser() -> Browser:
    """Create Chromium instance with stealth parameters"""
    # Launch with --disable-blink-features=AutomationControlled
    # Apply fingerprint randomization
    # Configure human-like behavior
    pass

async def apply_stealth_patches(page: Page) -> None:
    """Apply JavaScript patches to hide automation"""
    # Canvas fingerprint randomization
    # WebGL fingerprint masking
    # navigator.webdriver removal
    pass
```

### Phase 2: Worker Implementation

**File:** `chimera-core/workers.py` (NEW)

**Required:**
```python
class PhantomWorker:
    """Stealth browser worker"""
    
    async def __init__(self):
        # Initialize stealth browser
        # Connect to gRPC client
        pass
    
    async def execute_mission(self, mission: MissionRequest):
        # Take screenshot
        # Send to Brain via gRPC
        # Execute browser actions with stealth
        pass
```

### Phase 3: Validation

**File:** `chimera-core/validation.py` (NEW)

**Required:**
```python
async def validate_creepjs(page: Page) -> StealthValidationResponse:
    """Validate stealth on CreepJS"""
    # Navigate to CreepJS
    # Extract trust score
    # Verify 100% Human score
    pass
```

---

## 📋 Checklist

### Stealth Parameters
- [ ] `--disable-blink-features=AutomationControlled` in launch args
- [ ] `navigator.webdriver` removed/undefined
- [ ] Canvas fingerprint randomization
- [ ] WebGL fingerprint masking
- [ ] Audio fingerprint variation
- [ ] Behavioral jitter (timing variation)
- [ ] Diffusion-based mouse paths

### Worker Functionality
- [ ] gRPC client connection to The Brain
- [ ] Screenshot capture
- [ ] Vision processing requests
- [ ] Browser action execution
- [ ] Queue processing (Redis)

### Validation
- [ ] CreepJS navigation
- [ ] Trust score extraction
- [ ] 100% Human score verification
- [ ] Stealth parameter testing

---

## 🎯 Next Steps

1. **Create `chimera-core/stealth.py`**
   - Reference `scrapegoat/app/scraping/browser_mode.py`
   - Implement Playwright stealth configuration
   - Add fingerprint randomization

2. **Create `chimera-core/workers.py`**
   - Implement `PhantomWorker` class
   - Add gRPC client integration
   - Add mission execution logic

3. **Create `chimera-core/validation.py`**
   - Implement `validate_creepjs()` function
   - Add trust score verification

4. **Update `chimera-core/main.py`**
   - Replace placeholder with actual worker swarm
   - Initialize multiple worker instances
   - Connect to Redis queue

---

## 📚 References

**Existing Stealth Implementation:**
- `scrapegoat/app/scraping/browser_mode.py` - Full Playwright stealth implementation

**Proto Contract:**
- `@proto/chimera.proto` - gRPC service definitions
- `chimera-core/proto.chimera.proto` - Local copy

**Documentation:**
- `.cursor/rules/300-rust-body.mdc` - Original Rust body rules (reference only)
- `CHIMERA_STABLE_V1.md` - Current system status

---

## ⚠️ Critical Note

**The Rust codebase is GONE.** All stealth logic must be re-implemented in Python using Playwright. The `scrapegoat` service has a comprehensive stealth implementation that can be used as a reference, but `chimera-core` needs its own implementation tailored for the worker swarm architecture.
