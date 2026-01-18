# Test enrichment with your CSV

Use **`linkedin-leads-2025-12-17 pre enrichment.csv`** (or any CSV with `LinkedIn URL`, `Name`, `Location`, etc.) to run the enrichment pipeline and view results in `/enriched`.

---

## 1. Start infrastructure

**Redis** (required for the queue):

```bash
redis-server
# or: docker compose up -d redis
```

**Postgres** (required for the worker and for /enriched):

```bash
# If using docker-compose:
docker compose up -d postgres

# Then use: postgresql://postgres:postgres@localhost:5432/railway
```

If you use a different Postgres, have a `DATABASE_URL` that works for both BrainScraper and Scrapegoat.

---

## 2. Configure DATABASE_URL for BrainScraper

In **`brainscraper/.env.local`**, set:

- `DATABASE_URL` and `APP_DATABASE_URL` to your Postgres URL (e.g. `postgresql://postgres:postgres@localhost:5432/railway` if using docker postgres).

`/enriched` and the queue API use this to read/write and dedupe.

---

## 3. Start BrainScraper

```bash
cd brainscraper && npm run dev
```

Open: http://localhost:3000/v2-pilot

---

## 4. Start the Scrapegoat worker

The worker consumes `leads_to_enrich`, runs the pipeline, and writes to Postgres.

```bash
cd scrapegoat
export REDIS_URL=redis://localhost:6379
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/railway   # or your URL
export RAPIDAPI_KEY=your-key
export TELNYX_API_KEY=your-key
export CENSUS_API_KEY=your-key
# USHA_JWT_TOKEN optional; rest from root .env if you prefer
python start_redis_worker.py
```

Or, from project root, load `.env` and run:

```bash
set -a && source .env && set +a
cd scrapegoat && python start_redis_worker.py
```

---

## 5. Queue your CSV

1. Go to http://localhost:3000/v2-pilot  
2. In **"📤 QUEUE CSV FOR ENRICHMENT"**:
   - Click **Choose File** and select `linkedin-leads-2025-12-17 pre enrichment.csv`
   - Click **QUEUE FOR ENRICHMENT**
3. You should see: `Queued X for enrichment (Y skipped).`

---

## 6. View results

- Open **http://localhost:3000/enriched**
- Results are merged from Postgres (queue path) and `enriched-all-leads.json`.
- Only leads with **name + phone (≥10 digits)** are shown.

The worker may take a few minutes per lead (skip-trace, Telnyx, DNC, census, etc.). Watch the worker logs for progress.

---

## If something fails

- **"Queue failed" / 0 pushed**  
  - Check `REDIS_URL` in `brainscraper/.env.local` and that Redis is running.

- **Worker exits or no rows in Postgres**  
  - Check `REDIS_URL`, `DATABASE_URL`, and API keys in the environment where you run `start_redis_worker.py`.
  - Ensure `leads` table exists; `init_db` in the worker should create it.

- **/enriched is empty**  
  - Confirm `DATABASE_URL` in `brainscraper/.env.local` points to the same Postgres the worker uses.
  - Only enriched leads with a valid phone are shown; check worker logs for DNC, Telnyx, or skip-trace failures.
