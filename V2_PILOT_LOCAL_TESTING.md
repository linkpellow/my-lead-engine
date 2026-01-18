# V2 Pilot – Local Testing

## Can you run the full /v2-pilot flow locally?

**Partly.** The UI, fire-swarm, mission-status, quick-search, and Chimera Core consumption all work locally. Real enrichment (people-search, VLM, vision) does **not** run for the missions that fire-swarm creates, due to a mission format mismatch. Telemetry (Neural Sight, coordinate drift, fingerprints, etc.) is not wired in `workers.py`, so those panels stay empty.

---

## What works locally

| Part | Requirements | Notes |
|------|--------------|-------|
| **`/v2-pilot` page** | BrainScraper on host | `cd brainscraper && npm run dev` → http://localhost:3000/v2-pilot |
| **Fire Swarm** | Redis, `REDIS_URL` | Pushes to `chimera:missions` and `mission:{id}`. `.env.local` has `REDIS_URL=redis://localhost:6379`. |
| **Mission Status** | Redis | Polls `mission:*`. Same Redis as fire-swarm. |
| **Quick Search** | `RAPIDAPI_KEY` | Uses LinkedIn Sales Navigator. `.env.local` has it. |
| **Telemetry API** | Redis | `POST /api/v2-pilot/telemetry` writes to `mission:{id}`. Chimera Core can POST if `BRAINSCRAPER_URL` is set. |
| **Chimera Core** | Redis, Chimera Brain, Postgres, Scrapegoat (Dojo) | Consumes `chimera:missions` (BRPOP), runs `execute_mission`. |
| **Chimera Brain** | Redis (optional) | gRPC on 50051 for vision. |
| **Scrapegoat** | Redis, Postgres | For Dojo/blueprints used by Chimera Core. |

---

## What does *not* work as “full” enrichment

1. **Mission shape**  
   Fire-swarm sends:
   - `mission_type: 'enrichment'`
   - `lead_data: { name, location, city?, state? }`  

   Chimera Core’s `execute_mission` only handles:
   - `mission_type: 'enrichment_pivot'` (with `full_name`, `profile_url`/`linkedin_url`, etc.)
   - `instruction: 'deep_search'` (with `lead`, `linkedin_url`)
   - `steps` / `actions` (sequence of actions)

   For `mission_type: 'enrichment'` it falls through to the `steps`/`actions` branch; fire-swarm sends no `steps` or `actions`, so the loop is empty and the mission returns `completed` without doing people-search, VLM, or vision.

2. **Telemetry**  
   `get_telemetry_client` / `telemetry.push_*` are not used in `workers.py`. Screenshots, coordinate drift, fingerprints, and decision traces are never sent, so Neural Sight, Stealth Health, and similar panels stay empty even if Chimera Core runs.

---

## How to run it locally

### 1. Redis

```bash
docker compose up -d redis
# or: redis-server
```

Ensure `REDIS_URL=redis://localhost:6379` (e.g. in `.env.local` for BrainScraper). Docker Compose services will use `redis://redis:6379` on the compose network.

### 2. BrainScraper (on host)

```bash
cd brainscraper && npm run dev
```

Open http://localhost:3000/v2-pilot.  
Uses `.env.local` (REDIS_URL, RAPIDAPI_KEY, etc.).

### 3. Chimera + Scrapegoat + Postgres (Docker)

From project root, with `.env` (or the same vars) in the environment so `OPENAI_API_KEY`, `CAPSOLVER_API_KEY`, `DECODO_API_KEY`, etc. are set:

```bash
docker compose up -d redis postgres chimera-brain chimera-core scrapegoat
```

- Chimera Core gets `BRAINSCRAPER_URL=http://host.docker.internal:3000` by default so it can POST to `/api/v2-pilot/telemetry` when telemetry is integrated.  
- On Linux, if `host.docker.internal` is missing, set:
  `BRAINSCRAPER_URL=http://172.17.0.1:3000` (or your host IP)` before `docker compose up`.

### 4. Same Redis for host and Docker

- BrainScraper (host): `redis://localhost:6379` (port 6379 published by the `redis` container).
- Chimera Core (Docker): `redis://redis:6379` (same Redis on the compose network).

Fire-swarm and Chimera Core both use `chimera:missions` and `mission:{id}`, so they talk through the same Redis instance.

---

## What you’ll see

- **Stats**: Total / queued / processing / completed / failed / success rate from `mission:*`.
- **Mission log**: Rows for each mission. For fire-swarm’s current format, Chimera Core will quickly mark them `completed` without running people-search or vision.
- **Trauma triage**: Empty unless trauma fields are written (e.g. by a future telemetry integration).
- **Neural Sight, Stealth Health, VLM drift, Decision Trace, etc.**: Empty; telemetry is not sent from `workers.py`.

Quick Search → Fire Swarm will enqueue missions and Chimera Core will consume them; the “full” enrichment and diagnostic visuals are not active with the current fire-swarm payload and code.

---

## Changes made for local

- **`docker-compose.yml` (chimera-core)**  
  - `BRAINSCRAPER_URL=${BRAINSCRAPER_URL:-http://host.docker.internal:3000}`  
  So Chimera Core can reach BrainScraper on the host for `/api/v2-pilot/telemetry` once telemetry is wired.

---

## To get “full” local behaviour later

1. **Mission format**  
   - Either change fire-swarm to emit `mission_type: 'enrichment_pivot'` and `lead_data` in the shape `perform_enrichment_pivot` expects (`full_name`/`name`, `profile_url`/`linkedin_url`, etc.),  
   - Or add an `mission_type === 'enrichment'` branch in `execute_mission` that maps `{ name, location, city, state }` into that shape and calls `perform_enrichment_pivot` (or an equivalent).

2. **Telemetry**  
   - In `workers.py`, import `get_telemetry_client` and call `push`, `push_start`, `push_vlm_click`, `push_complete`, etc. at the right points (e.g. in `perform_enrichment_pivot`, `_run_deep_search`, and around vision/click steps) so `/api/v2-pilot/telemetry` receives data and the V2 Pilot panels can show it.
