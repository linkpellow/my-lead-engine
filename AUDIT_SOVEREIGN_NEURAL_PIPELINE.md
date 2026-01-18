# Sovereign Neural Pipeline – Full System Audit

Audit of all six layers from TLS handshakes to VLM reasoning. Gaps and implemented remedies are noted.

---

## 1. The "Invisible Handshake" Audit (TLS/JA3)

### Current State
- **chimera-core/network.py:** Proxy config (Decodo session, carrier) and TCP hints (MTU, TTL). **No TLS or JA3.**
- **Browser:** Playwright `chromium.launch()` with `get_stealth_launch_args()`. Uses bundled Chromium; JA3 is that of Playwright’s Chromium, not Chrome 142/Windows 11.
- **curl_cffi:** In `requirements.txt` and used in **scrapegoat** HTTP client for API calls. **Not used for chimera-core browser traffic**; the browser uses its own TLS stack.
- **CDP:** Only referenced in a JS comment in stealth; no `CDPSession` or TLS overrides.

### Gaps
- No TLS impersonation for the **browser** (Chrome 142/Windows 11 JA3).
- No explicit check that headers (User-Agent, Accept-Language, Sec-Ch-Ua) are consistent with the TLS fingerprint.

### Implemented
- **CHROMIUM_CHANNEL:** `workers.py` uses `CHROMIUM_CHANNEL` when set; if `CHROMIUM_USE_NATIVE_TLS=1` and `CHROMIUM_CHANNEL` is unset, it defaults to `"chrome"` so the native Chrome TLS stack is used.
- **Chrome 142 / Windows 11:** `CHROME_UA_VERSION` (default `142.0.0.0`) and `CHROME_UA_PLATFORM` (default `Windows`) control User-Agent and Sec-Ch-Ua. For Windows, the context gets:
  - `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/142.0.0.0 ...`
  - `Sec-Ch-Ua: "Google Chrome";v="142", "Chromium";v="142", "Not_A Brand";v="24"`
  - `Sec-Ch-Ua-Mobile: ?0`
  - `Sec-Ch-Ua-Platform: "Windows"`
- **Stealth:** `stealth.apply_stealth_patches` and `generate_stealth_script` use `CHROME_UA_VERSION`; `navigator.platform` and `userAgentData.platform`/`platformVersion` are set to `Win32` / `10.0.0` when `CHROME_UA_PLATFORM` is Windows, so JS matches the HTTP headers.
- **Recommendation:** Set `CHROMIUM_CHANNEL=chrome` (or `CHROMIUM_USE_NATIVE_TLS=1`) and `CHROME_UA_PLATFORM=Windows` with Chrome 142 installed for a consistent Chrome 142/Windows 11 JA3 and header profile.

---

## 2. The "Biological Probability" Audit (Stealth & Jitter)

### Current State
- **Gaussian jitter:** `stealth.DiffusionMouse.generate_bezier_path` uses `random.gauss(0, jitter)` on each point; `inject_micro_tremor()` adds 8–12 Hz sub-pixel tremor. ✓
- **Non-linear fatigue:** `stealth.compute_fatigue_multipliers(count)`, `set_fatigue_jitter_multiplier`, `get_fatigue_jitter_multiplier`. `workers._fatigue_delay(step_index, mission_count)` uses `random.gauss(mu, sigma)` with Session Decay (missions>20 → mu×1.6, sigma×1.3). ✓
- **Mouse:** `DiffusionMouse.move_to` uses Bezier + Gaussian noise + `inject_micro_tremor()` per step – human-like tremor, not straight lines. ✓
- **Thermal:** `thermal_mark_mission_start/end`, `thermal_extra_delay_s()` for micro-lags. ✓

### Gaps
- **Coffee break:** No pause every 50–100 requests for “human exhaustion.”

### Implemented
- **Coffee break:** In `main.run_worker_swarm`, `missions_since_coffee` is incremented each mission. When it reaches a random target in `[50, 100]`, the loop sleeps `random.randint(60, 180)` seconds, logs `"Coffee break"`, and resets the counter.

---

## 3. The "Neural Sight" Audit (VLM & OCR)

### Current State
- **DeepSeek-VL2:** `_load_deepseek_vl2`, used for coordinate grounding at 896px. ✓
- **olmOCR-2:** `_load_olmocr`, `_linearize_to_markdown` for Markdown; lazy-loaded. ✓
- **Consensus Protocol:** When DeepSeek returns `conf < 0.95` (CONFIDENCE_OLMOCR_THRESHOLD) and `VLM_TIER_2026 == "hybrid"`:
  - Runs `_linearize_to_markdown` (olmOCR-2) to linearize the image to Markdown. ✓
  - `_olmocr_finds_intent(md, text_command)` checks if the Markdown contains phone/age/income; if yes, `conf = 0.96`. ✓
  - Coordinates always come from DeepSeek; olmOCR-2 is used only for verification, not for producing coords.
- **Note:** If `VLM_TIER_2026` is `"speed"`, the olmOCR-2 consensus step is skipped; use `"hybrid"` (default) to enable it.

### Verdict
Fully aligned: conf < 0.95 → olmOCR-2 Markdown linearization and intent verification; coordinates from DeepSeek.

---

## 4. The "Sovereign Shield" Audit (Honeypots & Poison)

### Current State
- **visibility_check.check_before_selector_click:** Takes a screenshot, calls `process_vision` (VLM), and if the element is not on the “Visual Map” (`found`/coords) or in a Dojo forbidden region, returns (False, True) HONEYPOT_TRAP and the click is skipped. Flow: resolve selector→bbox (none→HONEYPOT); screenshot+VLM with element desc; VLM found nothing or coords far from element center (>120px L1)→HONEYPOT; forbidden rect→HONEYPOT. Used in `workers.safe_click`. ✓
- **check_before_coords_click:** Before VLM-derived coord clicks; blocks (x,y) in Dojo forbidden rects. ✓
- **validator.record_data_point:** Same phone/email for >3 distinct leads in 60 minutes → `blacklist_provider` for 4 hours and WEBHOOK. ✓

### Verdict
VLM-verified interaction and entropy-based poison detection are in place. Clicks that bypass `safe_click` / `_visual_click_fallback` (e.g. some captcha_agent or blueprint paths) may not use `check_before_selector_click`; acceptable for this audit.

---

## 5. The "Cloak & Dagger" Audit (Proxy & Session)

### Current State
- **Sticky session:** `network.get_proxy_config(sticky_session_id=mission_id, carrier)` appends `session-{id}` to the Decodo username (Decodo expects `session-<SESSION_ID>`). One mission_id ⇒ one session ⇒ same IP for that mission's lifetime. ✓
- **Duration:** Decodo controls how long a session stays pinned; we do not set a 30-minute TTL. Session persists for the mission’s lifetime (one `rotate_hardware_identity` per mission). For 30‑minute persistence, Decodo must support that; our `session-{id}` is stable for the mission.
- **403/Cloudflare:** Wired: response listener sets `_seen_403` on document 403; `_check_403_and_rotate` calls `rotate_hardware_identity(mission_id_r403_<ts>, carrier)` for a complete session rotation (fresh mobile IP).

### Implemented
- **get_proxy_config:** Appends `session-{sticky_session_id}` to the Decodo username (matches Decodo `session-<SESSION_ID>`); optional `carrier-{c}`. A single mission stays pinned to one mobile IP for its lifetime.
- **should_rotate_session_on_403():** Returns `True`. Wired: `page.on("response")` in `_create_context_and_page` sets `_seen_403` when status 403 and resource_type document. `_check_403_and_rotate` runs in the sequence step loop and in `_run_deep_search`; when `_seen_403` and `should_rotate_session_on_403()`, it calls `rotate_hardware_identity(mission_id_r403_<ts>, carrier)` and clears the flag.

---

## 6. The "Dojo Cartography" Audit (Blueprint Registry)

### Current State
- **Dojo → Redis:** Scrapegoat `commit_blueprint_to_swarm` writes `blueprint:{domain}` and `dojo:active_domain:{domain}`; `BluePrintLoaderStation` reads `BLUEPRINT:` / `blueprint:` from Redis. ✓
- **Coordinate Drift:** `vision_service.get_click_coordinates` returns `coordinate_drift=True` when VLM (x,y) differs from suggested by >50px. `process_vision` and the gRPC response carry `coordinate_drift`. **Previously:** nothing wrote this back into the Blueprint in Redis, so workers did not “adopt the new map.”

### Implemented
- **workers._report_coordinate_drift(field, x, y):** Derives `domain` from `self._page.url`, POSTs to Scrapegoat `POST /api/dojo/coordinate-drift` with `{domain, field, x, y}`.
- **Scrapegoat `/api/dojo/coordinate-drift`:** `Body()` for JSON; `HSET blueprint:{domain} {field}_x {x}`, `{field}_y {y}` so future workers use the VLM-corrected coordinates.
- **workers._deep_search_extract_via_vision:** Loads `blueprint:{domain}` / `BLUEPRINT:{domain}` from Redis; for each label passes `suggested_x`, `suggested_y` into `process_vision`. When `coordinate_drift=True` and valid `x,y`, calls `_report_coordinate_drift(label, x, y)`.
- **process_vision(suggested_x=, suggested_y=):** Forwards to Brain gRPC `ProcessVisionRequest`; Brain returns `coordinate_drift` when VLM (x,y) differs from suggested by >50px (L1).
- **chimera-core proto:** `ProcessVisionRequest` has `optional suggested_x`, `suggested_y`; `VisionResponse` has `coordinate_drift` (aligned with Brain / @proto).

**coordinate_drift** is True only when the Brain receives `suggested_x`/`suggested_y` and the VLM result deviates by >50px. This is now wired: `_deep_search_extract_via_vision` loads the Blueprint and passes suggested coords, and `_report_coordinate_drift` → Scrapegoat → Redis updates the blueprint for all future workers.

---

## 7. Pre-Flight Smoke Test

Run:

```bash
REDIS_URL=redis://... python scripts/preflight_smoke_test.py
```

Optional: `CHIMERA_BRAIN_HTTP_URL` or `CHIMERA_BRAIN_ADDRESS`, `SCRAPEGOAT_URL`, `SMOKE_RESULTS_TIMEOUT` (default 120).

See `scripts/preflight_smoke_test.py`. It:

1. Checks health of Redis, Chimera Brain, Scrapegoat (and optionally Chimera Core).
2. Pushes 5 test `deep_search` missions to `chimera:missions` and waits on `chimera:results:{id}`.
3. For each result, logs **Trauma** if:
   - `status == "failed"` or missing `status`/`completed`
   - `vision_confidence` present and &lt; 0.95 (NEEDS_OLMOCR)
   - Indication of CAPTCHA that the autonomous agent could not solve (e.g. `captcha_solved is False` and mission failed).
4. Prints a short summary and, if any Trauma occurred, a “Final review” block with the exact events.

---

## Quick Reference

| Layer            | Status | Notes |
|-----------------|--------|-------|
| TLS/JA3         | Partial | `CHROMIUM_CHANNEL=chrome`; no JA3 override for Playwright. |
| Gaussian/Fatigue| OK     | Coffee break added. |
| Neural Sight    | OK     | DeepSeek + olmOCR + consensus. |
| Honeypot/Poison | OK     | visibility_check + validator. |
| Sticky/403      | OK     | Sticky `session-{id}`; 403→`_check_403_and_rotate`→`rotate_hardware_identity` wired. |
| Dojo/Drift      | OK     | coordinate_drift → `/api/dojo/coordinate-drift` → Redis blueprint. |
