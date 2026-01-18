# Cache Breaker: 2026-01-18 02:45:00 UTC - Phase 1 DiffusionMouse Implementation
"""
Chimera Core - Stealth Module

Ports proven fingerprint masking logic from scrapegoat for Chromium stealth.
Ensures 100% Human trust score on CreepJS.
"""

import random
import json
import math
import asyncio
import logging
import threading
import os
import time
import hashlib
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
from playwright.async_api import Page

logger = logging.getLogger(__name__)

_runtime_fatigue_lock = threading.Lock()
_runtime_fatigue_jitter_multiplier = 1.0

_tremor_lock = threading.Lock()
_tremor_log_t = 0.0
_tremor_move_log_t = 0.0


def inject_micro_tremor() -> Tuple[float, float]:
    """
    Vanguard v2.0: 8-12Hz sub-pixel micro-tremor for mouse events.
    """
    global _tremor_log_t
    now = time.monotonic()
    # Frequency between 8-12Hz, stable per call
    freq = 8.0 + random.random() * 4.0
    phase = random.random() * math.tau
    amp = 0.08 + random.random() * 0.18  # sub-pixel amplitude
    tremor = math.sin((math.tau * freq * now) + phase) * amp
    tremor_y = math.cos((math.tau * (freq + 0.7) * now) + phase) * amp

    with _tremor_lock:
        if now - _tremor_log_t > 3.0:
            _tremor_log_t = now
            logger.info("Micro-tremor active")

    return tremor, tremor_y


async def force_kernel_rendering(
    page: Page,
    hardware_id: str,
    platform: str,
) -> None:
    """
    Vanguard v2.0: Inject OS-specific kernel rendering hints.
    """
    platform_key = (platform or "").lower()
    if "mac" in platform_key:
        css = """
            html, body {
                -webkit-font-smoothing: antialiased !important;
                -moz-osx-font-smoothing: grayscale !important;
                text-rendering: optimizeLegibility !important;
            }
        """
    elif "win" in platform_key:
        css = """
            html, body {
                text-rendering: optimizeLegibility !important;
                font-smooth: always !important;
                -webkit-text-stroke: 0.25px transparent !important;
            }
        """
    else:
        css = """
            html, body {
                text-rendering: geometricPrecision !important;
                -webkit-font-smoothing: antialiased !important;
            }
        """

    await page.add_init_script(
        f"""
        (() => {{
          const style = document.createElement('style');
          style.setAttribute('data-kernel-render', '{hardware_id}');
          style.textContent = `{css}`;
          document.documentElement.appendChild(style);
        }})();
        """
    )
    logger.info("Kernel rendering matched")


def compute_fatigue_multipliers(count: int) -> Tuple[float, float]:
    """
    Phase 5: Fatigue model multipliers.

    Spec (exact):
      - Saccadic Jitter: (1 + count * 0.02)
      - Cognitive Delay: (1 + count * 0.015)

    Args:
        count: session mission count (1-based)

    Returns:
        (jitter_multiplier, cognitive_multiplier)
    """
    jitter_multiplier = 1.0 + (count * 0.02)
    cognitive_multiplier = 1.0 + (count * 0.015)
    return jitter_multiplier, cognitive_multiplier


def set_fatigue_jitter_multiplier(multiplier: float) -> None:
    """Set runtime jitter multiplier (thread-safe)."""
    global _runtime_fatigue_jitter_multiplier
    with _runtime_fatigue_lock:
        _runtime_fatigue_jitter_multiplier = max(1.0, float(multiplier))


def get_fatigue_jitter_multiplier() -> float:
    """Get runtime jitter multiplier (thread-safe)."""
    with _runtime_fatigue_lock:
        return float(_runtime_fatigue_jitter_multiplier)


def _infer_log_role() -> str:
    """
    Determine whether we are running as BODY or SWARM for branded signatures.
    """
    explicit = os.getenv("CHIMERA_LOG_TAG")
    if explicit:
        tag = explicit.strip()
    else:
        tag = (os.getenv("RAILWAY_SERVICE_NAME") or "").strip().lower()
        if tag == "chimera-core" or "chimera-core" in tag:
            tag = "CHIMERA-BODY"
        elif "scrapegoat-worker-swarm" in tag or "worker-swarm" in tag:
            tag = "CHIMERA-SWARM"
        else:
            tag = "CHIMERA"
    return "BODY" if str(tag).endswith("BODY") else ("SWARM" if str(tag).endswith("SWARM") else str(tag))


@dataclass
class ThermalModel:
    """
    Phase 6: Thermal throttling model.

    This is intentionally lightweight: it provides a stable temperature estimate
    and yields tiny micro-lags when "hot", emulating CPU/GPU thermal throttling.
    """
    base_temp_c: float = 37.0
    ambient_temp_c: float = 33.5
    heat: float = 0.0
    last_t: float = field(default_factory=time.monotonic)

    def _cool(self, now: float) -> None:
        dt = max(0.0, now - self.last_t)
        self.last_t = now
        # Exponential cooling: larger tau => slower cooling.
        tau = 75.0
        if dt > 0:
            self.heat *= math.exp(-dt / tau)

    def apply_load(self, intensity: float, duration_s: float) -> float:
        now = time.monotonic()
        self._cool(now)
        intensity = max(0.1, float(intensity))
        duration_s = max(0.0, float(duration_s))

        # Heat gain calibrated for ~60-80°C during heavy missions.
        self.heat += (duration_s / 30.0) * (0.85 * intensity)
        self.heat = min(self.heat, 3.0)  # clamp
        return self.current_temp_c()

    def bump(self, intensity: float) -> float:
        now = time.monotonic()
        self._cool(now)
        self.heat += 0.20 * max(0.1, float(intensity))
        self.heat = min(self.heat, 3.0)
        return self.current_temp_c()

    def current_temp_c(self) -> float:
        # Map heat → temp with a small bounded wobble.
        wobble = random.uniform(-0.35, 0.35)
        return max(self.ambient_temp_c, self.base_temp_c + (self.heat * 16.5) + wobble)


_thermal_lock = threading.Lock()
_thermal_model = ThermalModel()


def thermal_mark_mission_start(intensity: float = 1.0) -> float:
    with _thermal_lock:
        temp = _thermal_model.bump(intensity=intensity)
    return temp


def thermal_mark_mission_end(duration_s: float, intensity: float = 1.0) -> float:
    with _thermal_lock:
        temp = _thermal_model.apply_load(intensity=intensity, duration_s=duration_s)
    # Required signature (Phase 6)
    role = _infer_log_role()
    logger.info(f"✅ [{role}] Thermal simulation active: {temp:.1f}°C")
    return temp


def thermal_extra_delay_s() -> float:
    """
    Return a micro-lag delay (3-12ms) when hot, else 0.
    """
    with _thermal_lock:
        temp = _thermal_model.current_temp_c()

    # Threshold tuned to avoid constant lag at baseline.
    if temp < 66.0:
        return 0.0

    # Scale by temperature above threshold, capped.
    scale = min(1.0, max(0.0, (temp - 66.0) / 18.0))
    return random.uniform(0.003, 0.012) * scale


def inject_execution_noise(tag: str = "interaction") -> None:
    """
    Phase 9: Execution entropy injection (micro-calculations).
    """
    role = _infer_log_role()
    start = time.perf_counter()
    rounds = random.randint(12, 24)
    acc = 0.0
    samples = [random.random() for _ in range(rounds)]
    for i, v in enumerate(samples, 1):
        acc += math.sin(v * math.pi) * math.cos((i + 1) * v)
        acc = (acc * 1.0000001) % 1.0
    random.shuffle(samples)
    _ = sorted(samples)
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    logger.info(f"✅ [{role}] Execution entropy active: {tag} ({elapsed_ms:.1f}ms)")


class DiffusionMouse:
    """
    Native-level biological mouse movement simulation.
    Linear (straight-line) movements are not used.

    - Non-linear cubic Bezier paths for every mouse move (no linear interpolation)
    - 1px Gaussian noise to every path coordinate (hand tremors)
    - Saccadic tremors: extra Gaussian per point, scaled by velocity and fatigue
    - inject_micro_tremor() (8–12 Hz sub-pixel) at each step in move_to
    - Fitts's Law velocity curves (ease-in-out)
    """
    
    @staticmethod
    def generate_bezier_path(
        start: Tuple[float, float],
        end: Tuple[float, float],
        steps: int = 30,
        jitter: float = 1.0,  # 1px Gaussian noise as specified
        familiarity: bool = False
    ) -> List[Tuple[float, float, float]]:
        """
        Generate Bezier curve path with 1px Gaussian noise.
        
        Args:
            start: (x, y) starting position
            end: (x, y) ending position
            steps: Number of intermediate points
            jitter: Gaussian noise amplitude (1px as per spec)
        
        Returns:
            List of (x, y, delay_ms) tuples
        """
        # Control points for Bezier curve (creates natural arc)
        curvature_scale = 0.6 if familiarity else 1.0
        mid_x = (start[0] + end[0]) / 2 + random.uniform(-50, 50) * curvature_scale
        mid_y = (start[1] + end[1]) / 2 + random.uniform(-30, 30) * curvature_scale
        
        path = []
        
        for i in range(steps + 1):
            t = i / steps
            
            # Cubic Bezier curve (4 control points)
            # P(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
            x = (
                (1 - t) ** 3 * start[0] +
                3 * (1 - t) ** 2 * t * (start[0] + (mid_x - start[0]) * 0.3) +
                3 * (1 - t) * t ** 2 * (end[0] + (mid_x - end[0]) * 0.3) +
                t ** 3 * end[0]
            )
            y = (
                (1 - t) ** 3 * start[1] +
                3 * (1 - t) ** 2 * t * (start[1] + (mid_y - start[1]) * 0.3) +
                3 * (1 - t) * t ** 2 * (end[1] + (mid_y - end[1]) * 0.3) +
                t ** 3 * end[1]
            )
            
            # CRITICAL: Add 1px Gaussian noise to every coordinate (hand tremors)
            jitter_x = random.gauss(0, jitter)  # 1px standard deviation
            jitter_y = random.gauss(0, jitter)  # 1px standard deviation
            x += jitter_x
            y += jitter_y
            
            # Fitts's Law: Velocity curve (Ease-In-Out)
            # Slow at start and end, fast in middle
            # Initialize ease_t to prevent UnboundLocalError
            ease_t = 0.0
            if t < 0.5:
                # Ease-in (acceleration)
                ease_t = 2 * t * t
            else:
                # Ease-out (deceleration)
                ease_t = 1 - pow(-2 * t + 2, 2) / 2

            # VANGUARD: Saccadic Tremors - High-frequency jitter tied to velocity
            # Fix: compute ease_t BEFORE tremor math; velocity_factor peaks at mid-trajectory.
            velocity_factor = 1.0 - (abs(ease_t - 0.5) * 2.0)
            velocity_factor = max(0.0, min(1.0, velocity_factor))

            # Ensure tremor amplitude/frequency utilize computed velocity_factor
            tremor_amplitude = 0.3 + (velocity_factor * 0.4)  # 0.3-0.7px base
            tremor_frequency = 1.0 + (velocity_factor * 2.0)  # 1.0-3.0x frequency

            # Scale tremor with current jitter amplitude (fatigue increases jitter)
            tremor_scale = max(0.8, min(2.2, jitter))
            tremor_amplitude *= tremor_scale

            for _ in range(int(tremor_frequency)):
                x += random.gauss(0, tremor_amplitude)
                y += random.gauss(0, tremor_amplitude)
            
            # Delay based on ease curve (faster in middle)
            base_delay = 5  # ms per step
            delay_ms = base_delay + (1 - ease_t) * 10  # 5-15ms range
            if familiarity:
                delay_ms *= 0.85  # 15% faster for familiar trajectories
            
            path.append((x, y, delay_ms))
        
        return path
    
    @staticmethod
    async def move_to(
        page: Page,
        target: Tuple[float, float],
        current_pos: Tuple[float, float],
        steps: int = None,
        familiarity: bool = False
    ) -> Tuple[float, float]:
        """
        Move mouse along Bezier path with biological timing.
        
        Args:
            page: Playwright page
            target: Target (x, y) position
            current_pos: Current (x, y) position
            steps: Number of path steps (auto-calculated if None)
        
        Returns:
            Final (x, y) position
        """
        # Calculate steps based on distance (longer moves = more steps)
        distance = math.sqrt((target[0] - current_pos[0]) ** 2 + (target[1] - current_pos[1]) ** 2)
        if steps is None:
            steps = max(20, int(distance / 10))  # ~10px per step
        
        # Phase 5: apply fatigue multiplier to jitter amplitude
        jitter_amp = 1.0 * get_fatigue_jitter_multiplier()

        # Generate Bezier path with fatigue-adjusted Gaussian noise
        path = DiffusionMouse.generate_bezier_path(
            current_pos,
            target,
            steps,
            jitter=jitter_amp,
            familiarity=familiarity,
        )
        
        # Execute movement
        global _tremor_move_log_t
        if time.monotonic() - _tremor_move_log_t > 2.5:
            _tremor_move_log_t = time.monotonic()
            logger.info("Micro-tremor active")
        for x, y, delay_ms in path:
            tremor_x, tremor_y = inject_micro_tremor()
            await page.mouse.move(x + tremor_x, y + tremor_y)
            # Phase 6: thermal throttling micro-lags (3-12ms) when hot
            extra = thermal_extra_delay_s()
            await asyncio.sleep((delay_ms / 1000.0) + extra)  # Convert ms to seconds
        
        return target


@dataclass
class FingerprintConfig:
    """Fingerprint configuration for stealth"""
    language: str = "en-US"
    languages: list = field(default_factory=lambda: ["en-US", "en"])
    timezone: str = "America/New_York"
    pixel_ratio: float = 2.0
    color_depth: int = 24
    audio_noise: float = 0.0001

    # Phase 6: Hardware realism seeds (stable per mission)
    gpu_seed: Optional[int] = None
    audio_seed: Optional[int] = None
    canvas_seed: Optional[int] = None
    
    webgl: Dict[str, str] = field(default_factory=lambda: {
        "vendor": "Intel Inc.",
        "renderer": "Intel Iris OpenGL Engine"
    })
    
    def __post_init__(self):
        """Randomize fingerprint on initialization"""
        # Randomize WebGL vendor/renderer (seeded when provided)
        gpu_rng = random.Random(self.gpu_seed) if self.gpu_seed is not None else random
        vendors = [
            ("Intel Inc.", "Intel Iris OpenGL Engine"),
            ("Google Inc. (Intel)", "ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 640 Direct3D11 vs_5_0 ps_5_0, D3D11)"),
            ("Google Inc. (NVIDIA)", "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)"),
        ]
        self.webgl["vendor"], self.webgl["renderer"] = gpu_rng.choice(vendors)
        
        # Randomize audio noise (seeded when provided)
        audio_rng = random.Random(self.audio_seed) if self.audio_seed is not None else gpu_rng
        self.audio_noise = audio_rng.uniform(0.00005, 0.0002)


def _js_seeded_rng(name: str, seed_expr: str) -> str:
    """
    Build a small seeded RNG for JS (xorshift32).
    """
    return f"""
        function {name}__factory(seed) {{
            let x = (seed | 0) || 1337;
            return function() {{
                x ^= (x << 13);
                x ^= (x >>> 17);
                x ^= (x << 5);
                // Convert to [0,1)
                return ((x >>> 0) / 4294967296);
            }};
        }}
        const {name} = {name}__factory({seed_expr});
    """


@dataclass
class DeviceProfile:
    """Device profile for browser fingerprinting"""
    platform: str = "MacIntel"
    vendor: str = "Google Inc."
    hardware_concurrency: int = 8
    device_memory: int = 8
    max_touch_points: int = 0
    is_mobile: bool = False
    viewport: Dict[str, int] = field(default_factory=lambda: {"width": 1920, "height": 1080})
    user_agent: str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36"
    
    def __post_init__(self):
        """Randomize device profile"""
        # Randomize hardware
        self.hardware_concurrency = random.choice([4, 8, 12, 16])
        self.device_memory = random.choice([4, 8, 16])


def get_stealth_launch_args() -> list:
    """
    Get Chromium launch arguments for stealth mode.
    
    Critical: --disable-blink-features=AutomationControlled
    Headless memory capping: --js-flags=--max-old-space-size=512 to avoid Chrome
    memory hoarding during 5k lead runs (Sovereign Guard).
    """
    return [
        "--disable-blink-features=AutomationControlled",  # CRITICAL: Removes automation flag
        "--js-flags=--max-old-space-size=512",  # Headless memory cap (MB); prevents OOM on long runs
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-dev-shm-usage",
        "--no-sandbox",  # Required for Railway containers
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--hide-scrollbars",
        "--mute-audio",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-breakpad",
        "--disable-component-extensions-with-background-pages",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-features=TranslateUI",
        "--disable-hang-monitor",
        "--disable-ipc-flooding-protection",
        "--disable-popup-blocking",
        "--disable-prompt-on-repost",
        "--disable-renderer-backgrounding",
        "--disable-sync",
        "--force-color-profile=srgb",
        "--metrics-recording-only",
        "--no-default-browser-check",
        "--password-store=basic",
        "--use-mock-keychain",
        # WebRTC leak prevention
        "--disable-webrtc-hw-encoding",
        "--disable-webrtc-hw-decoding",
        "--enforce-webrtc-ip-permission-check",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
    ]


def generate_stealth_script(
    profile: DeviceProfile,
    fingerprint: FingerprintConfig,
    chrome_version: str = "142.0.0.0",
    hardware_seeds: Optional[Dict[str, int]] = None,
) -> str:
    """
    Generate JavaScript stealth patches for fingerprint masking.
    chrome_version must match CHROME_UA_VERSION and the browser's Sec-Ch-Ua for JA3 consistency.
    """
    _platform_ver = "10.0.0" if (getattr(profile, "platform", "") or "").startswith("Win") else "10.15.7"
    return f"""
        // ============================================
        // 2026 STEALTH PATCHES - Full Fingerprint Spoofing
        // ============================================

        // Phase 6: Hardware realism seeds (stable per mission)
        const __chimeraSeeds = {{
            gpu: {int((hardware_seeds or {}).get("gpu_seed", fingerprint.gpu_seed or 1337))},
            audio: {int((hardware_seeds or {}).get("audio_seed", fingerprint.audio_seed or 7331))},
            canvas: {int((hardware_seeds or {}).get("canvas_seed", fingerprint.canvas_seed or 9001))}
        }};
        { _js_seeded_rng("__chimeraRandCanvas", "__chimeraSeeds.canvas") }
        { _js_seeded_rng("__chimeraRandAudio", "__chimeraSeeds.audio") }
        
        // 1. Navigator patches (CRITICAL: Remove webdriver with IMMUTABLE lock)
        Object.defineProperty(navigator, 'webdriver', {{ 
            get: () => undefined,
            configurable: false,
            enumerable: false
        }});
        
        // IMMUTABLE LOCKDOWN: Prevent CreepJS from probing past our spoofing
        Object.defineProperty(navigator, 'platform', {{ 
            get: () => '{profile.platform}',
            configurable: false,
            writable: false
        }});
        Object.defineProperty(navigator, 'vendor', {{ 
            get: () => '{profile.vendor}',
            configurable: false,
            writable: false
        }});
        Object.defineProperty(navigator, 'hardwareConcurrency', {{ 
            get: () => {profile.hardware_concurrency},
            configurable: false,
            writable: false
        }});
        Object.defineProperty(navigator, 'deviceMemory', {{ 
            get: () => {profile.device_memory},
            configurable: false,
            writable: false
        }});
        Object.defineProperty(navigator, 'maxTouchPoints', {{ 
            get: () => {profile.max_touch_points},
            configurable: false,
            writable: false
        }});
        
        // IMMUTABLE: Lock languages array
        Object.defineProperty(navigator, 'languages', {{ 
            get: () => {json.dumps(fingerprint.languages)},
            configurable: false,
            writable: false
        }});
        Object.defineProperty(navigator, 'language', {{ 
            get: () => '{fingerprint.language}',
            configurable: false,
            writable: false
        }});
        
        // 2. Chrome object (Chrome-specific)
        window.chrome = {{
            runtime: {{}},
            loadTimes: function() {{ return {{}}; }},
            csi: function() {{ return {{}}; }},
            app: {{ 
                isInstalled: false, 
                InstallState: {{ DISABLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" }}, 
                RunningState: {{ CANNOT_RUN: "cannot_run", READY_TO_RUN: "ready_to_run", RUNNING: "running" }} 
            }}
        }};
        
        // 3. Permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
            Promise.resolve({{ state: Notification.permission }}) :
            originalQuery(parameters)
        );
        
        // 4. WebGL fingerprint spoofing
        const getParameterOrig = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {{
            if (parameter === 37445) return '{fingerprint.webgl["vendor"]}';
            if (parameter === 37446) return '{fingerprint.webgl["renderer"]}';
            return getParameterOrig.call(this, parameter);
        }};
        
        const getParameter2Orig = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(parameter) {{
            if (parameter === 37445) return '{fingerprint.webgl["vendor"]}';
            if (parameter === 37446) return '{fingerprint.webgl["renderer"]}';
            return getParameter2Orig.call(this, parameter);
        }};
        
        // 5. Canvas fingerprint noise
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {{
            if (type === 'image/png' && this.width > 16 && this.height > 16) {{
                const context = this.getContext('2d');
                if (context) {{
                    const imageData = context.getImageData(0, 0, this.width, this.height);
                    for (let i = 0; i < imageData.data.length; i += 4) {{
                        // Seeded noise: stable per mission, tiny amplitude.
                        imageData.data[i] += Math.floor(__chimeraRandCanvas() * 2);
                    }}
                    context.putImageData(imageData, 0, 0);
                }}
            }}
            return originalToDataURL.apply(this, arguments);
        }};
        
        // 6. AudioContext fingerprint noise
        const AudioContextOrig = window.AudioContext || window.webkitAudioContext;
        if (AudioContextOrig) {{
            const originalCreateAnalyser = AudioContextOrig.prototype.createAnalyser;
            AudioContextOrig.prototype.createAnalyser = function() {{
                const analyser = originalCreateAnalyser.call(this);
                const originalGetFloatFrequencyData = analyser.getFloatFrequencyData.bind(analyser);
                analyser.getFloatFrequencyData = function(array) {{
                    originalGetFloatFrequencyData(array);
                    for (let i = 0; i < array.length; i++) {{
                        array[i] += (__chimeraRandAudio() - 0.5) * {fingerprint.audio_noise};
                    }}
                }};
                return analyser;
            }};
        }}
        
        // 7. Network Information API
        Object.defineProperty(navigator, 'connection', {{
            get: () => ({{
                effectiveType: '4g',
                rtt: 50 + Math.floor(Math.random() * 50),
                downlink: 10 + Math.random() * 5,
                saveData: false
            }})
        }});
        
        // 8. Battery API (privacy concern - return consistent fake)
        if (navigator.getBattery) {{
            navigator.getBattery = () => Promise.resolve({{
                charging: true,
                chargingTime: 0,
                dischargingTime: Infinity,
                level: 1,
                addEventListener: () => {{}},
                removeEventListener: () => {{}}
            }});
        }}
        
        // 9. Screen properties
        Object.defineProperty(screen, 'colorDepth', {{ get: () => {fingerprint.color_depth} }});
        Object.defineProperty(screen, 'pixelDepth', {{ get: () => {fingerprint.color_depth} }});
        
        // 10. Plugins (realistic set) - Moved to immutable section below
        
        // 11. Disable automation flags in CDP
        delete Object.getPrototypeOf(navigator).webdriver;
        
        // 11b. Immutable flag injection (prevents CreepJS probing)
        // Lock navigator properties with writable: false to prevent detection
        Object.defineProperty(navigator, 'plugins', {{
            get: () => {{
                const plugins = [
                    {{ name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }},
                    {{ name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' }},
                    {{ name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }}
                ];
                plugins.length = 3;
                return plugins;
            }},
            configurable: false,
            enumerable: true
        }});
        
        Object.defineProperty(navigator, 'languages', {{
            get: () => {json.dumps(fingerprint.languages)},
            writable: false,
            configurable: false,
            enumerable: true
        }});
        
        Object.defineProperty(navigator, 'hardwareConcurrency', {{
            get: () => {profile.hardware_concurrency},
            writable: false,
            configurable: false,
            enumerable: true
        }});
        
        Object.defineProperty(navigator, 'deviceMemory', {{
            get: () => {profile.device_memory},
            writable: false,
            configurable: false,
            enumerable: true
        }});
        
        // 12. Client Hints API (modern Chrome)
        if (navigator.userAgentData) {{
            Object.defineProperty(navigator, 'userAgentData', {{
                get: () => ({{
                    brands: [
                        {{ brand: 'Google Chrome', version: '{chrome_version.split(".")[0]}' }},
                        {{ brand: 'Chromium', version: '{chrome_version.split(".")[0]}' }},
                        {{ brand: 'Not_A Brand', version: '8' }}
                    ],
                    mobile: {str(profile.is_mobile).lower()},
                    platform: '{profile.platform}',
                    getHighEntropyValues: () => Promise.resolve({{
                        architecture: 'x86',
                        bitness: '64',
                        brands: [
                            {{ brand: 'Google Chrome', version: '{chrome_version.split(".")[0]}' }},
                            {{ brand: 'Chromium', version: '{chrome_version.split(".")[0]}' }},
                            {{ brand: 'Not_A Brand', version: '8' }}
                        ],
                        fullVersionList: [
                            {{ brand: 'Google Chrome', version: '{chrome_version}' }},
                            {{ brand: 'Chromium', version: '{chrome_version}' }},
                            {{ brand: 'Not_A Brand', version: '8.0.0.0' }}
                        ],
                        mobile: {str(profile.is_mobile).lower()},
                        model: '',
                        platform: '{profile.platform}',
                        platformVersion: '{_platform_ver}',
                        uaFullVersion: '{chrome_version}'
                    }})
                }})
            }});
        }}
        
        // 13. WebRTC IP leak prevention
        const originalRTCPeerConnection = window.RTCPeerConnection;
        window.RTCPeerConnection = function(...args) {{
            const pc = new originalRTCPeerConnection(...args);
            pc.createDataChannel = function() {{ return null; }};
            return pc;
        }};
        window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
        
        // 14. Disable iframes from detecting parent (clickjacking protection)
        Object.defineProperty(window, 'parent', {{ get: () => window }});
        Object.defineProperty(window, 'top', {{ get: () => window }});
        
        console.log('🕵️ Stealth patches applied (2026 Edition)');
        """


async def apply_stealth_patches(page, profile: Optional[DeviceProfile] = None, fingerprint: Optional[FingerprintConfig] = None):
    """
    Apply stealth patches to a Playwright page.
    
    This must be called BEFORE any page interaction.
    """
    if profile is None:
        profile = DeviceProfile()
    if fingerprint is None:
        fingerprint = FingerprintConfig()
    
    # Phase 6: Pull per-mission hardware entropy (GPU/Audio/Canvas)
    hardware_seeds = None
    try:
        from db_bridge import allocate_hardware_entropy
        worker_id = getattr(profile, "worker_id", None)
        # Prefer env-supplied worker id when available
        worker_id = (
            worker_id
            or os.getenv("CHIMERA_WORKER_ID")
            or os.getenv("WORKER_ID")
            or os.getenv("RAILWAY_SERVICE_NAME")
            or "worker-0"
        )
        mission_id = os.getenv("CHIMERA_MISSION_ID") or f"mission-{int(time.time())}"
        hardware_seeds = allocate_hardware_entropy(worker_id=str(worker_id), mission_id=str(mission_id))
    except Exception as e:
        logger.debug(f"⚠️ Hardware entropy allocation skipped: {e}")

    if hardware_seeds:
        # Preserve baseline locale/timezone, but seed GPU/audio/canvas.
        fingerprint = FingerprintConfig(
            language=fingerprint.language,
            languages=list(fingerprint.languages),
            timezone=fingerprint.timezone,
            pixel_ratio=fingerprint.pixel_ratio,
            color_depth=fingerprint.color_depth,
            gpu_seed=int(hardware_seeds["gpu_seed"]),
            audio_seed=int(hardware_seeds["audio_seed"]),
            canvas_seed=int(hardware_seeds["canvas_seed"]),
        )

    # Align with workers: CHROME_UA_VERSION for JA3/header consistency (Chrome 142/Windows 11).
    chrome_version = os.getenv("CHROME_UA_VERSION", "142.0.0.0").strip()
    stealth_script = generate_stealth_script(profile, fingerprint, chrome_version, hardware_seeds=hardware_seeds or None)
    
    await page.add_init_script(stealth_script)
    try:
        seed_blob = json.dumps(
            {
                "platform": profile.platform,
                "vendor": profile.vendor,
                "hc": profile.hardware_concurrency,
                "seeds": hardware_seeds or {},
            },
            sort_keys=True,
        )
        hardware_id = hashlib.sha256(seed_blob.encode("utf-8")).hexdigest()[:12]
    except Exception:
        hardware_id = "chimera-core"
    await force_kernel_rendering(page, hardware_id=hardware_id, platform=profile.platform)
    logger.debug("🕵️ Stealth patches applied to page")

    return fingerprint
