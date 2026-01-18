# How to See and Apply Local Changes

## 1. See what changed (files)

`.env` and `.env.local` are in `.gitignore`, so they **don’t show in `git status`**. You have to open them.

**In the repo (tracked files):**
```bash
git status
git diff .env.local   # no output: it's ignored
git diff .env         # no output: it's ignored
git diff docker-compose.yml
git diff scrapegoat/app/enrichment/skip_tracing.py
```

**Env files (ignored) – open in editor:**
- `.env.local` – API keys, REDIS_URL, etc.; RAPIDAPI_KEY_SKIP_TRACING and USHA_JWT_TOKEN removed
- `.env` – RAPIDAPI_KEY_SKIP_TRACING removed; USHA marked optional

---

## 2. Make apps actually use the changes

Env and config are only read at **startup**. Restart the right process(es).

### BrainScraper (Next.js)

`.env.local` is loaded when the dev server starts. Restart and clear cache:

```bash
cd brainscraper
rm -rf .next
npm run dev
```

Then reload http://localhost:3000 (and /v2-pilot if you use it).

### Docker (chimera-core, chimera-brain, scrapegoat, etc.)

`docker-compose.yml` and `${VAR}` from `.env` are read when you run `docker compose up`. Recreate so containers get new env and compose config:

```bash
# from project root
docker compose down
docker compose up -d
```

Only chimera-core (for BRAINSCRAPER_URL):

```bash
docker compose up -d --force-recreate chimera-core
```

Note: **docker-compose does not load `.env.local`**. It only uses `.env`. For `CAPSOLVER_API_KEY`, `DECODO_API_KEY`, etc. in Docker, they must be in `.env` (or exported in the shell before `docker compose up`).

### Scrapegoat (if run on host, not Docker)

`skip_tracing.py` and env are read at process start. Restart:

```bash
# stop the running process (Ctrl+C or kill)
# then:
cd scrapegoat && python main.py
# or: python start_redis_worker.py
```

### Chimera-core (if run on host, not Docker)

Restart the Python process so it picks up env and code.

---

## 3. Quick checklist

| Change | Where | What to do |
|--------|--------|------------|
| `.env.local` (keys, no SKIP_TRACING, no USHA) | BrainScraper | `rm -rf brainscraper/.next` then `npm run dev` |
| `.env` (no SKIP_TRACING, USHA optional) | root | Used by `docker compose` and any tool that loads `.env`; restart those processes |
| `docker-compose.yml` (BRAINSCRAPER_URL for chimera-core) | Docker | `docker compose down` then `docker compose up -d` or `--force-recreate chimera-core` |
| `scrapegoat/.../skip_tracing.py` (no RAPIDAPI_KEY_SKIP_TRACING) | Scrapegoat | Restart Scrapegoat / worker process |

---

## 4. Verify .env.local is loaded (BrainScraper)

In `brainscraper`, after restarting dev:

```bash
# in brainscraper dir, with dev server running:
node -e "require('dotenv').config({ path: '.env.local' }); console.log('RAPIDAPI_KEY:', process.env.RAPIDAPI_KEY ? 'set' : 'missing'); console.log('RAPIDAPI_KEY_SKIP_TRACING:', process.env.RAPIDAPI_KEY_SKIP_TRACING || 'not set (expected)');"
```

Or add a temporary debug route that logs `process.env.RAPIDAPI_KEY_SKIP_TRACING` and then remove it.
