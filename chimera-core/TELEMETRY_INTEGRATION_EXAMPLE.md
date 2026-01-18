# Telemetry Integration Example - Chimera Core → V2 Pilot

**Purpose:** Show how to integrate `telemetry_client.py` into `workers.py` for real-time diagnostic data.

---

## 📦 **Dependencies**

Add to `chimera-core/requirements.txt`:

```txt
requests>=2.31.0
Pillow>=10.0.0
```

Then redeploy:

```bash
railway up --service chimera-core
```

---

## 🔌 **Integration Points**

### **1. Initialize Telemetry Client**

At the top of `workers.py`, add:

```python
from telemetry_client import get_telemetry_client

# Initialize telemetry client
telemetry = get_telemetry_client()
```

---

### **2. Mission Start - Push Fingerprint**

When a mission starts, push initial telemetry:

```python
async def execute_mission(self, mission: Dict):
    """Execute a single mission"""
    mission_id = mission['mission_id']
    
    # Capture browser fingerprint
    fingerprint = {
        'ja3_hash': self.page.context.ja3_hash,  # If available
        'user_agent': await self.page.evaluate('navigator.userAgent'),
        'sec_ch_ua': await self.page.evaluate('navigator.userAgentData?.brands'),
        'isp_carrier': self.carrier,  # From mobile proxy
        'session_id': mission.get('sticky_session_id', ''),
        'ip_changed': False
    }
    
    # Push mission start telemetry
    telemetry.push_start(
        mission_id=mission_id,
        fingerprint=fingerprint,
        initial_step='Initializing stealth browser'
    )
    
    # Continue with mission execution...
```

---

### **3. VLM Click - Push Coordinate Drift**

When VLM predicts click coordinates:

```python
async def click_element_with_vlm(self, element_description: str):
    """Use VLM to find and click element"""
    
    # Get Blueprint prediction (hardcoded selector)
    blueprint_coords = self.selectors.get(element_description, (0, 0))
    
    # Get screenshot
    screenshot_bytes = await self.page.screenshot()
    
    # Get VLM prediction
    vlm_response = await self.vision_service.predict(
        screenshot_bytes,
        element_description
    )
    actual_coords = (vlm_response['x'], vlm_response['y'])
    confidence = vlm_response['confidence']
    
    # Push telemetry BEFORE clicking
    telemetry.push_vlm_click(
        mission_id=self.mission_id,
        suggested_coords=blueprint_coords,
        actual_coords=actual_coords,
        confidence=confidence,
        screenshot=screenshot_bytes
    )
    
    # Now click
    await self.page.mouse.click(actual_coords[0], actual_coords[1])
```

---

### **4. Mouse Movement - Track Jitter**

Track mouse movements for heatmap:

```python
async def move_mouse_with_jitter(self, target_x: int, target_y: int):
    """Move mouse with human-like jitter"""
    
    # Generate Bezier path
    path_points = self.bezier_path(self.current_x, self.current_y, target_x, target_y)
    
    # Track movements for telemetry
    mouse_movements = []
    
    for point in path_points:
        x, y = point
        await self.page.mouse.move(x, y)
        
        # Record movement
        mouse_movements.append({
            'x': x,
            'y': y,
            'timestamp': int(time.time() * 1000)
        })
        
        # Add micro-tremor
        await asyncio.sleep(random.uniform(0.005, 0.015))
    
    # Push mouse movement telemetry
    telemetry.push(
        mission_id=self.mission_id,
        mouse_movements=mouse_movements
    )
```

---

### **5. Decision Trace - Track THINK Steps**

Maintain decision trace throughout mission:

```python
class PhantomWorker:
    def __init__(self):
        self.decision_trace = []
    
    def add_decision(self, step: str, action: str, confidence: float = None):
        """Add step to decision trace"""
        self.decision_trace.append({
            'step': step,
            'action': action,
            'timestamp': int(time.time() * 1000),
            'confidence': confidence
        })
        
        # Push updated trace
        telemetry.push(
            mission_id=self.mission_id,
            decision_trace=self.decision_trace
        )

# Usage:
async def navigate_to_site(self, url: str):
    """Navigate to target site"""
    await self.page.goto(url)
    self.add_decision(
        'Navigate to site',
        f'Loaded {url}',
        confidence=1.0
    )

async def find_search_bar(self):
    """Find search input"""
    element = await self.find_element_with_vlm('search bar')
    self.add_decision(
        'Found search bar',
        f'Located input at coordinates ({element.x}, {element.y})',
        confidence=0.95
    )
```

---

### **6. CAPTCHA Detection - Trauma Signal**

When CAPTCHA is detected:

```python
async def handle_captcha(self, captcha_type: str):
    """Handle CAPTCHA with autonomous solver"""
    
    # Add to decision trace
    self.add_decision(
        'CAPTCHA detected',
        f'Found {captcha_type} CAPTCHA',
        confidence=None
    )
    
    # Push CAPTCHA trauma signal
    telemetry.push_captcha_detected(
        mission_id=self.mission_id,
        captcha_type=captcha_type,
        decision_trace=self.decision_trace
    )
    
    # Attempt autonomous solve
    try:
        result = await self.vlm_captcha_solver.solve(captcha_type)
        if result['success']:
            self.add_decision(
                'CAPTCHA solved',
                f'Autonomous VLM solver succeeded',
                confidence=result['confidence']
            )
        else:
            # Fallback to CapSolver
            self.add_decision(
                'Fallback to CapSolver',
                f'VLM solver failed, using external service',
                confidence=None
            )
            
            # Push fallback trigger
            telemetry.push(
                mission_id=self.mission_id,
                fallback_triggered=True,
                vision_confidence=result.get('confidence', 0.0)
            )
    except Exception as e:
        logger.error(f"CAPTCHA solve failed: {e}")
        # Push failure trauma
        telemetry.push(
            mission_id=self.mission_id,
            trauma_signals=['CAPTCHA_AGENT_FAILURE'],
            trauma_details=str(e)
        )
```

---

### **7. IP Change Detection - Session Broken**

Monitor IP address changes:

```python
async def verify_session_stability(self):
    """Check if IP address changed"""
    
    current_ip = await self.get_current_ip()
    
    if hasattr(self, 'initial_ip') and current_ip != self.initial_ip:
        # IP changed - push session broken alert
        fingerprint = await self.get_current_fingerprint()
        telemetry.push_session_broken(
            mission_id=self.mission_id,
            fingerprint=fingerprint
        )
        
        # Log and potentially abort mission
        logger.error(f"❌ Session broken: IP changed from {self.initial_ip} to {current_ip}")
        raise SessionBrokenError("IP address changed mid-mission")
```

---

### **8. Mission Complete - Final Telemetry**

When mission finishes:

```python
async def complete_mission(self, success: bool = True):
    """Mark mission as complete"""
    
    # Add final decision
    if success:
        self.add_decision(
            'Mission completed',
            'All data extracted successfully',
            confidence=1.0
        )
    else:
        self.add_decision(
            'Mission failed',
            'Extraction failed or timed out',
            confidence=None
        )
    
    # Push final telemetry
    telemetry.push_complete(
        mission_id=self.mission_id,
        decision_trace=self.decision_trace,
        success=success
    )
```

---

## 🎯 **Full Integration Example**

Here's a complete example showing telemetry integration in a mission:

```python
async def execute_mission(self, mission: Dict):
    """Execute mission with full telemetry"""
    
    self.mission_id = mission['mission_id']
    self.decision_trace = []
    
    try:
        # 1. Start mission
        fingerprint = await self.get_fingerprint()
        telemetry.push_start(
            mission_id=self.mission_id,
            fingerprint=fingerprint,
            initial_step='Initializing stealth browser'
        )
        
        # 2. Navigate
        await self.navigate_to_site('https://fastpeoplesearch.com')
        self.add_decision(
            'Navigate to site',
            'Loaded FastPeopleSearch',
            confidence=1.0
        )
        
        # 3. Find search bar (with VLM)
        screenshot = await self.page.screenshot()
        search_coords = await self.vision_service.predict(
            screenshot,
            'search input field'
        )
        telemetry.push_vlm_click(
            mission_id=self.mission_id,
            suggested_coords=(150, 300),  # Blueprint
            actual_coords=(search_coords['x'], search_coords['y']),
            confidence=search_coords['confidence'],
            screenshot=screenshot
        )
        
        # 4. Move mouse with jitter
        mouse_movements = await self.move_mouse_with_jitter(
            search_coords['x'],
            search_coords['y']
        )
        telemetry.push(
            mission_id=self.mission_id,
            mouse_movements=mouse_movements
        )
        
        # 5. Click search bar
        await self.page.mouse.click(search_coords['x'], search_coords['y'])
        self.add_decision(
            'Clicked search bar',
            f'Activated input field',
            confidence=search_coords['confidence']
        )
        
        # 6. Check for CAPTCHA
        captcha_detected = await self.detect_captcha()
        if captcha_detected:
            await self.handle_captcha('reCAPTCHA v2')
        
        # 7. Extract data
        data = await self.extract_lead_data()
        self.add_decision(
            'Data extracted',
            f'Found phone: {data.get("phone", "N/A")}',
            confidence=0.92
        )
        
        # 8. Complete mission
        await self.complete_mission(success=True)
        
    except Exception as e:
        logger.error(f"Mission failed: {e}")
        
        # Push failure telemetry
        self.add_decision(
            'Mission failed',
            str(e),
            confidence=None
        )
        telemetry.push_complete(
            mission_id=self.mission_id,
            decision_trace=self.decision_trace,
            success=False
        )
        
        raise
```

---

## 🚀 **Deployment**

### **1. Add Telemetry Client**

File already created: `chimera-core/telemetry_client.py` ✅

### **2. Update Requirements**

Add to `chimera-core/requirements.txt`:

```txt
requests>=2.31.0
Pillow>=10.0.0
```

### **3. Set Environment Variable**

```bash
railway variables --service chimera-core set BRAINSCRAPER_URL=http://brainscraper.railway.internal:3000
```

### **4. Integrate into workers.py**

Add telemetry calls at key integration points (see examples above).

### **5. Redeploy**

```bash
cd /Users/linkpellow/Desktop/my-lead-engine/chimera-core
railway up --service chimera-core
```

### **6. Verify Telemetry**

1. Open V2 Pilot: `https://brainscraper-production.up.railway.app/v2-pilot`
2. Fire a test batch (5 leads)
3. Watch telemetry flow in real-time:
   - Neural Sight Live Feed should show screenshots
   - Stealth Health should show fingerprints
   - Decision traces should populate

---

## ✅ **Success Criteria**

**Telemetry is working when:**

- ✅ Mission start pushes fingerprint data
- ✅ VLM clicks show coordinate overlays
- ✅ Mouse movements appear in heatmap
- ✅ Decision traces populate in modal
- ✅ CAPTCHA detections trigger trauma signals
- ✅ Mission completion updates status

---

## 🎯 **Benefits**

With telemetry integrated, you get:

1. **Real-time visibility** - See exactly what VLM is doing
2. **Silent failure detection** - Catch coordinate drift > 50px
3. **Stealth monitoring** - Verify fingerprints and IP pinning
4. **Behavioral validation** - Check mouse movements aren't mechanical
5. **Full traceability** - Complete THINK step timeline
6. **Data quality checks** - Entropy scoring on results

**This transforms V2 Pilot into a true diagnostic command center.** 🚀
