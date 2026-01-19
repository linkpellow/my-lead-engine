# People-Search Enrichment — Execution Record

**Sites:** ThatsThem, SearchPeopleFree, ZabaSearch, FastPeopleSearch, TruePeopleSearch, AnyWho.

This doc records what the lead executes and what runs automatically. It is not an operator to‑do list.

---

## Final readiness: one-time setup and test

**You should not need to keep asking.** Variables are set, redeploys were run. The **only** thing left:

1. **Run the test** (§4 below).
2. **If it fails** → § Troubleshooting and § Debug with AI (and chimera-core Railway logs for people-search).

Nothing else is required from you for the pipeline to work. If the test passes, you’re done. If it fails, the logs + those sections identify the fix.

### 1. Variables (already set via Railway CLI in this project)

| Service | What | Status |
|---------|------|--------|
| **BrainScraper** | `REDIS_URL`, `APP_REDIS_URL`, `SCRAPEGOAT_API_URL`, `DATABASE_URL` | Set |
| **Scrapegoat** | `REDIS_URL`, `DATABASE_URL`, `SEED_MAGAZINE_ON_STARTUP=1` | Set |
| **Chimera Core** | `REDIS_URL`, `APP_DATABASE_URL` (or `DATABASE_URL`), `CHIMERA_BRAIN_ADDRESS`, `CAPSOLVER_API_KEY`, `DECODO_API_KEY` | Set |

### 2. One-time redeploys (after variable fixes)

```bash
railway redeploy -s chimera-core -y   # Picks up DATABASE_URL / APP_DATABASE_URL
railway redeploy -s scrapegoat -y     # Runs startup → seeds blueprint:{domain} when SEED_MAGAZINE_ON_STARTUP=1
```

*(Redeploys were run via CLI in this session. Re-run only if you change these variables again.)*

### 3. Verify (run from repo root, Railway linked)

```bash
# Same Redis everywhere
railway variable list -s scrapegoat --kv   | grep REDIS_URL
railway variable list -s chimera-core --kv | grep REDIS_URL
# → Both should show redis.railway.internal

# Scrapegoat, Chimera Core, Chimera Brain up (people-search needs Brain for VLM extract)
curl -s https://<SCRAPEGOAT_PUBLIC>/health
curl -s https://<CHIMERA_CORE_PUBLIC>/health
curl -s https://<CHIMERA_BRAIN_PUBLIC>/health
```

### 4. Test

1. **v2-pilot** → Pre-flight **Check** (Redis ✓, Scrapegoat ✓).
2. **Queue CSV:** Upload a CSV with header `LinkedIn URL,Name,Location` and at least one data row. Example: `https://linkedin.com/in/jane,Jane Doe,Denver CO`. Click **QUEUE FOR ENRICHMENT**.
3. **Enrich:** Click **ENRICH**. Expect a stream (Identity → BlueprintLoader → Chimera → …) then `Done` or `Enriched 1`. If it stalls or errors, use **Download logs**.
4. **Results:** Open **/enriched** or check Download logs. On failure: § Troubleshooting, § Debug with AI, and chimera-core Railway logs.

**If the test passes:** Queue more CSV → Enrich. People-search runs via ChimeraStation → Chimera Core → `_MAGAZINE_TARGETS` and `blueprint:{domain}`.

**If it fails:** See § Troubleshooting (network, BRPOP timeout, `all_log_lines` empty) and § Debug with AI. For `pivot_*_fail` or `capsolver_*`, include chimera-core Railway logs (last 50–100 lines).

---

## 1. Chimera Core

- **Running:** `railway service status chimera-core` or Dashboard.
- **Start:** `chimera-core/main.py` via `python main.py`; mission loop BRPOPs `chimera:missions`.
- **Required env (worker exits if missing):** `REDIS_URL` or `APP_REDIS_URL`; `DATABASE_URL` or `APP_DATABASE_URL` (main.py `test_db_connection()` exits with 1 on failure); `CHIMERA_BRAIN_ADDRESS`. For people-search: `CAPSOLVER_API_KEY`, `DECODO_API_KEY` (or `PROXY_URL`). See `V2_PILOT_RAILWAY_ALIGNMENT.md` §2.

---

## 2. Same Redis (Scrapegoat + Chimera Core)

- **Verified via CLI:** `railway variable list -s scrapegoat` and `-s chimera-core` both show `REDIS_URL` → `redis.railway.internal:6379`.
- **Code:** Both use `REDIS_URL` or `APP_REDIS_URL`.

---

## 3. Seed blueprints (6 Magazine domains)

- **Automatic:** `SEED_MAGAZINE_ON_STARTUP=1` set on Scrapegoat via `railway variable set -s scrapegoat SEED_MAGAZINE_ON_STARTUP=1`. Scrapegoat startup seeds `blueprint:{domain}` for all 6. Log: `Seed-magazine on startup: done (6 Magazine domains)`.
- **Manual (when Scrapegoat is up):** `curl -s -X POST "https://<SCRAPEGOAT_PUBLIC_DOMAIN>/api/blueprints/seed-magazine"` → `{"status":"ok","seeded":[...],"count":6}`. `railway run -s scrapegoat -- python scrapegoat/scripts/seed_magazine_blueprints.py` cannot reach `redis.railway.internal` from a local shell; use the API.
- **Code:** `scrapegoat/main.py` startup, `POST /api/blueprints/seed-magazine`, `scrapegoat/scripts/seed_magazine_blueprints.py`, `app/enrichment/blueprint_commit.commit_blueprint_impl`.

---

## 4. CapSolver on Chimera Core

- **Verified via CLI:** `railway variable list -s chimera-core` includes `CAPSOLVER_API_KEY`.
- **Code:** `chimera-core/capsolver.py`, `workers._detect_and_solve_captcha`.

---

## 5. Decodo (or proxy) on Chimera Core

- **Verified via CLI:** `railway variable list -s chimera-core` includes `DECODO_API_KEY`.
- **Code:** `chimera-core/network.get_proxy_config`, `workers` context.

---

## 6. Chimera Brain

- **Verified via CLI:** `railway variable list -s chimera-core` includes `CHIMERA_BRAIN_ADDRESS` → `chimera-brain-v1.railway.internal:50051`.
- **Code:** `chimera-core/main.py`, `PhantomWorker`, `process_vision`, `_deep_search_extract_via_vision`.
- **Required for people-search:** Chimera Brain (chimera-brain-v1) must be **running**. If it’s down, Chimera Core will fail at VLM extract; check `curl -s https://<CHIMERA_BRAIN_PUBLIC>/health`.

---

## Lead input (queue/CSV)

Leads in `leads_to_enrich` must include **`name`** (or **`fullName`**) or **`firstName`** and **`lastName`**, and **`linkedinUrl`**. Pipeline normalizes `name`; ChimeraStation returns FAIL if no searchable name.

**v2-pilot Enrich:** BrainScraper needs `SCRAPEGOAT_API_URL` or `SCRAPEGOAT_URL` to reach Scrapegoat `POST /worker/process-one-stream`. See `V2_PILOT_RAILWAY_ALIGNMENT.md` §2.

---

## Commands the lead runs (from repo root, Railway linked)

```bash
# Variables
railway variable list -s scrapegoat
railway variable list -s chimera-core

# Ensure Scrapegoat seeds on startup
railway variable set -s scrapegoat SEED_MAGAZINE_ON_STARTUP=1

# Redeploy Scrapegoat so startup runs (seeds when up)
railway redeploy -s scrapegoat -y

# Optional: seed via API when Scrapegoat is reachable
# curl -s -X POST "https://<SCRAPEGOAT_PUBLIC_DOMAIN>/api/blueprints/seed-magazine"
```

---

## Debug with AI (Cursor)

Use when a run fails or stalls and you need to correlate logs with code.

### Steps

1. **v2-pilot** → Run Enrich → **Download logs** (or **Copy for Cursor**).
2. **Cursor** → Paste the Copy block, or attach `chimera-enrichment-logs-*.json`.
3. **@-mention** (so the model sees the code):
   - `chimera-core/workers.py`
   - `scrapegoat/app/pipeline/stations/enrichment.py`
   - `scrapegoat/app/pipeline/stations/blueprint_loader.py`
   - `chimera-core/main.py`
   - `scrapegoat/main.py`
   - If `mapping_required` / `redis_miss`: `scrapegoat/scripts/seed_magazine_blueprints.py`
   - If CAPTCHA / `capsolver_*`: `chimera-core/capsolver.py`
   - If Identity / `name_check_fail`: `scrapegoat/app/enrichment/identity_resolution.py`, `scrapegoat/app/pipeline/engine.py`
   - If `pivot_selector_fail` / `pivot_fill_fail` / `pivot_result_fail`: `chimera-core/workers.py` (`perform_enrichment_pivot`, `_MAGAZINE_TARGETS`); see § DOM/selectors.
4. **Invoke** the rule: `debug-enrichment-with-ai` or say: *"Analyze these enrichment logs using the Debug Enrichment rule."*
5. **Optional (people-search):** Paste chimera-core Railway logs (last 50–100 lines) so the model can see `[ChimeraCore]` pivot/CAPTCHA/extract errors.

### Rule and map

- **Rule:** `.cursor/rules/debug-enrichment-with-ai.mdc`
- **Log→code map:** inside the rule; use it to map `failure_mode`, `errors_summary`, and substeps (e.g. `pivot_fill_fail`, `waiting_core`, `redis_miss`) to files and symbols.

---

## Troubleshooting: 0% success, network error, or BRPOP timeout

- **`process-one: network error (TypeError)` after ~60–120s**  
  The request from the browser to BrainScraper (or BrainScraper to Scrapegoat) was closed before the pipeline finished. Often a **platform or proxy timeout** (e.g. Vercel 60s, or a proxy &lt; 300s). **Fix:** set `maxDuration` ≥ 300 for the process-one-stream route; ensure no reverse proxy or load balancer times out before 300s. BrainScraper `process-one-stream` and the v2-pilot client use a 330s timeout. BrainScraper and the client use 330s; the limiting factor is usually the host (Vercel/Railway) or a proxy in front.

- **Many `BRPOP timeout 120s` / `240s` across all 6 providers (FastPeopleSearch, TruePeopleSearch, ZabaSearch, SearchPeopleFree, ThatsThem, AnyWho)**  
  ChimeraStation pushes to `chimera:missions` and BRPOPs `chimera:results:{id}`. No LPUSH from Chimera Core in time. **Causes:** (1) Chimera Core not running or **not on the same Redis**; (2) Chimera Core stuck before LPUSH (pivot, CAPTCHA, or VLM) or crashing. **Fix:** Confirm Chimera Core is up and `REDIS_URL` matches Scrapegoat. Get **chimera-core Railway logs** (last 50–100 lines) and look for `[ChimeraCore]` (e.g. `pivot_fill_fail`, `capsolver_*`, `mission timeout`). Chimera Core now has `MISSION_TIMEOUT_SEC` (default 200): if a mission exceeds 200s it LPUSHes `{status: "failed", error: "mission_timeout_200s"}` so Scrapegoat does not wait the full 240s.

- **`all_log_lines` empty and `processed: false`**  
  The run never reached pipeline steps (or the stream was cut before the `done` payload). Usually the same as "network error" above—connection closed before Scrapegoat could stream back.

---

## DOM/selectors (people-search sites change)

When **`pivot_selector_fail`**, **`pivot_fill_fail`**, or **`pivot_result_fail`** appear in chimera-core logs (or in trauma_signals / Download logs), the site DOM or selectors are likely out of date.

1. **Debug with AI (Cursor):** Use the rule and @-mention `chimera-core/workers.py` (`perform_enrichment_pivot`, `_MAGAZINE_TARGETS`). The model will map the failing selector to the target and suggest an update.
2. **Update selectors:**
   - **Chimera Core:** `chimera-core/workers.py` → `_MAGAZINE_TARGETS` for `name_selector`, `result_selector` (and `url` if the site moved).
   - **Scrapegoat/BlueprintLoader:** Redis `blueprint:{domain}` overrides Core when present. Align `scrapegoat/scripts/seed_magazine_blueprints.py` and Scrapegoat `_MAGAZINE_BLUEPRINTS` / `POST /api/blueprints/seed-magazine` with `_MAGAZINE_TARGETS`.
3. **Re-seed:** After changing selectors, run `POST /api/blueprints/seed-magazine` (or set `SEED_MAGAZINE_ON_STARTUP=1` and redeploy Scrapegoat) so `blueprint:{domain}` is updated. If only Core was changed, redeploy chimera-core.

---

## References

- **Env by service:** `V2_PILOT_RAILWAY_ALIGNMENT.md` §5 and §8.
- **Flow:** `V2_PILOT_RAILWAY_ALIGNMENT.md` §8 (people-search).
