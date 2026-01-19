# Enrichment pipeline – full test checklist

Use this to verify the **people-search / enrichment** flow: Queue CSV → Redis → Scrapegoat worker → Skip-trace, Telnyx, DNC, Demographics → Postgres → /enriched.

---

## 1. Code (done)

- [x] **Queue CSV** (`/api/enrichment/queue-csv`) – pushes to `leads_to_enrich`
- [x] **Queue status** (`/api/enrichment/queue-status`) – `LLEN` on `leads_to_enrich` and `failed_leads` (Redis only)
- [x] **v2-pilot Enrichment Pipeline** – In queue, Failed (DLQ), Last queued, link to /enriched
- [x] **load-enriched-results** – reads Postgres `leads` + `enriched-all-leads.json`, merges (Postgres wins)
- [x] **Scrapegoat pipeline** – `hybrid_smart`: Identity → BlueprintLoader → Chimera → ScraperEnrichment → **SkipTracing** → **TelnyxGatekeep** → **DNCGatekeeper** → **Demographics** → **DatabaseSaveStation**

---

## 2. Services that must be running

| Service | Role | How to run |
|--------|------|------------|
| **Redis** | `leads_to_enrich`, `failed_leads`, Chimera/workers | Railway or local |
| **Postgres** | `leads` table (DatabaseSaveStation writes, load-enriched-results reads) | Railway or local |
| **BrainScraper** | Queue CSV, queue-status, /enriched, v2-pilot | `npm run dev` or Railway |
| **Scrapegoat API** (`main.py`) | /health, /queue/status, /worker/process-lead | `python main.py` or Railway |
| **Scrapegoat worker** | BRPOP `leads_to_enrich`, runs pipeline, writes to Postgres | `python start_redis_worker.py` **separate process** |

Important: **Scrapegoat worker is not the same as Scrapegoat API.** The worker must be running (`python start_redis_worker.py`). On Railway that’s a separate service with start command `python start_redis_worker.py`.

---

## 3. Env vars

### BrainScraper

- `REDIS_URL` or `APP_REDIS_URL` – queue-csv (push), queue-status (LLEN)
- `DATABASE_URL` or `APP_DATABASE_URL` – load-enriched-results (read `leads` for /enriched)

### Scrapegoat (API and worker)

- `REDIS_URL` or `APP_REDIS_URL` – same Redis as BrainScraper
- `DATABASE_URL` or `APP_DATABASE_URL` – same Postgres as BrainScraper
- **RAPIDAPI_KEY** – SkipTracingStation, DemographicsStation (RapidAPI)
- **TELNYX_API_KEY** – TelnyxGatekeepStation (phone validation)
- **USHA DNC** (one of):
  - `USHA_JWT_TOKEN` (static), or
  - `USHA_EMAIL` + `USHA_PASSWORD` with Auth Worker (`python start_auth_worker.py`) so tokens are in Redis
- **CENSUS_API_KEY** – DemographicsStation (Census API; optional if using RapidAPI for income)

If these are missing, the pipeline can still run but skip-trace, Telnyx, DNC, or demographics may be no-ops and you’ll see fewer enriched fields.

---

## 4. CSV format for Queue CSV

Required:

- **LinkedIn URL**: column named `LinkedIn URL`, `linkedinUrl`, or `linkedin_url`

Optional (improve matching):

- Name, First Name, Last Name  
- Location, City, State  
- Title, Company  
- Email, Phone  

---

## 5. How to run a full test

1. **Start worker** (if local):
   ```bash
   cd scrapegoat && python start_redis_worker.py
   ```

2. **Open v2-pilot**  
   `https://<brainscraper>/v2-pilot` or `http://localhost:3000/v2-pilot`

3. **Queue a CSV**  
   - Use “Queue CSV for enrichment”, pick a CSV with a LinkedIn URL column.  
   - You should see: “Last: Queued X (Y skipped) at …” and **In queue** increase.

4. **Watch Enrichment Pipeline**  
   - **In queue** should decrease as the worker consumes.  
   - **Failed (DLQ)** increases if leads are sent to `failed_leads` after retries.

5. **Check /enriched**  
   - Click “View results in /enriched →”.  
   - `load-enriched-results` merges Postgres + JSON; Postgres wins.  
   - Only leads with `name` and `phone` length ≥ 10 are shown (`isValidLead`).

6. **If In queue stays high**  
   - Worker not running or wrong `REDIS_URL`.  
   - Logs: Scrapegoat worker (and Auth Worker if using USHA login).

7. **If In queue goes to 0 but /enriched empty**  
   - Worker ran but: no phone found (filtered), or DNC/validation failed, or `DATABASE_URL` wrong in Scrapegoat.  
   - Check worker logs and `failed_leads` (DLQ).

---

## 6. Railway

- **Scrapegoat worker**: separate service, root `scrapegoat`, start `python start_redis_worker.py`, same `REDIS_URL` and `DATABASE_URL` as Scrapegoat API.
- **BrainScraper**: `REDIS_URL`, `DATABASE_URL` (and optional `SCRAPEGOAT_API_URL` for `/api/pipeline/status`; queue-status does not need it).

---

## 7. Postgres schema

`leads` must exist. Scrapegoat’s `init_db` / `database.py` normally create it. If not:

- `linkedin_url` (unique), `name`, `phone`, `email`, `city`, `state`, `zipcode`, `age`, `income`, `dnc_status`, `can_contact`, `confidence_age`, `confidence_income`, `source_metadata`, `enriched_at`, `created_at`.

---

## Quick verification

```bash
# Queue depth (should change when you queue and when worker runs)
curl -s http://localhost:3000/api/enrichment/queue-status
# or Redis: redis-cli LLEN leads_to_enrich

# Enriched lead count from Postgres (BrainScraper’s load-enriched-results)
curl -s http://localhost:3000/api/load-enriched-results | jq '.sources, .stats'
```
