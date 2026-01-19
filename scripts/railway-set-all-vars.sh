#!/usr/bin/env bash
# Set REDIS_URL, DATABASE_URL, APP_* and common literals on all Railway services via CLI.
# Run from repo root with project linked: ./scripts/railway-set-all-vars.sh
#
# Override infra refs if your Redis/Postgres services have different names:
#   REDIS_REF='${{Redis.REDIS_URL}}' DB_REF='${{Postgres.DATABASE_URL}}' ./scripts/railway-set-all-vars.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Default Variable References (Railway: ${{ServiceName.VariableName}})
# - Redis (or redis-bridge); Postgres. Use DATABASE_PUBLIC_URL when Postgres.DATABASE_URL is empty.
REDIS_REF="${REDIS_REF:-\${{Redis.REDIS_URL}}}"
DB_REF="${DB_REF:-\${{Postgres.DATABASE_PUBLIC_URL}}}"

if ! command -v railway >/dev/null 2>&1; then
  echo "railway CLI not found. Install: https://docs.railway.app/develop/cli"
  exit 1
fi
if ! railway whoami >/dev/null 2>&1; then
  echo "railway not linked or not logged in. Run: railway login && railway link"
  exit 1
fi

echo "Railway: setting REDIS_URL, DATABASE_URL, APP_*, and common literals"
echo "  REDIS_REF=$REDIS_REF"
echo "  DB_REF=$DB_REF"
echo ""

# --- brainscraper ---
echo "--- brainscraper ---"
railway variable set "REDIS_URL=$REDIS_REF" -s brainscraper 2>/dev/null || { echo "  skip REDIS_URL (railway variable set failed; set in Dashboard)"; }
railway variable set "APP_REDIS_URL=$REDIS_REF" -s brainscraper 2>/dev/null || true
railway variable set "DATABASE_URL=$DB_REF" -s brainscraper 2>/dev/null || { echo "  skip DATABASE_URL (set in Dashboard)"; }
railway variable set "APP_DATABASE_URL=$DB_REF" -s brainscraper 2>/dev/null || true
railway variable set "NODE_ENV=production" -s brainscraper 2>/dev/null || true
railway variable set "PORT=3000" -s brainscraper 2>/dev/null || true
railway variable set "DATA_DIR=/data" -s brainscraper 2>/dev/null || true
railway variable set 'OPENAI_API_KEY=${{scrapegoat.OPENAI_API_KEY}}' -s brainscraper 2>/dev/null || true
echo "  Set SCRAPEGOAT_API_URL or SCRAPEGOAT_URL, RAPIDAPI_KEY, NEXT_PUBLIC_BASE_URL manually if missing."
echo ""

# --- scrapegoat ---
echo "--- scrapegoat ---"
railway variable set "REDIS_URL=$REDIS_REF" -s scrapegoat 2>/dev/null || { echo "  skip REDIS_URL (set in Dashboard)"; }
railway variable set "APP_REDIS_URL=$REDIS_REF" -s scrapegoat 2>/dev/null || true
railway variable set "DATABASE_URL=$DB_REF" -s scrapegoat 2>/dev/null || { echo "  skip DATABASE_URL (set in Dashboard)"; }
railway variable set "APP_DATABASE_URL=$DB_REF" -s scrapegoat 2>/dev/null || true
railway variable set "APP_CELERY_BROKER_URL=${REDIS_REF}/1" -s scrapegoat 2>/dev/null || true
railway variable set "APP_CELERY_RESULT_BACKEND=${REDIS_REF}/2" -s scrapegoat 2>/dev/null || true
railway variable set "PYTHONUNBUFFERED=1" -s scrapegoat 2>/dev/null || true
railway variable set "CHIMERA_STATION_TIMEOUT=90" -s scrapegoat 2>/dev/null || true
echo "  Set OPENAI_API_KEY, CENSUS_API_KEY, RAPIDAPI_KEY, CAPSOLVER_API_KEY, DECODO_API_KEY, CHIMERA_BRAIN_HTTP_URL (or CHIMERA_BRAIN_ADDRESS) manually if missing."
echo ""

# --- chimera-core ---
echo "--- chimera-core ---"
railway variable set "REDIS_URL=$REDIS_REF" -s chimera-core 2>/dev/null || { echo "  skip REDIS_URL (set in Dashboard; must match Scrapegoat)"; }
railway variable set "APP_REDIS_URL=$REDIS_REF" -s chimera-core 2>/dev/null || true
railway variable set "DATABASE_URL=$DB_REF" -s chimera-core 2>/dev/null || { echo "  skip DATABASE_URL (set in Dashboard)"; }
railway variable set "APP_DATABASE_URL=$DB_REF" -s chimera-core 2>/dev/null || true
echo "  Set CHIMERA_BRAIN_ADDRESS, BRAINSCRAPER_URL, SCRAPEGOAT_URL (or DOJO_TRAUMA_URL), CAPSOLVER_API_KEY, DECODO_API_KEY manually if missing."
echo ""

# --- chimera-brain-v1 (or chimera-brain) ---
for svc in chimera-brain-v1 chimera-brain; do
  if railway variable list -s "$svc" --kv 2>/dev/null | head -1 >/dev/null 2>&1; then
    echo "--- $svc ---"
    railway variable set "REDIS_URL=$REDIS_REF" -s "$svc" 2>/dev/null || true
    railway variable set "APP_REDIS_URL=$REDIS_REF" -s "$svc" 2>/dev/null || true
    railway variable set "PYTHONUNBUFFERED=1" -s "$svc" 2>/dev/null || true
    echo "  Set PORT=8080, CHIMERA_BRAIN_PORT=50051 if missing."
    echo ""
    break
  fi
done

# --- scrapegoat-worker (if exists) ---
for svc in scrapegoat-worker scrapegoat-worker-swarm; do
  if railway variable list -s "$svc" --kv 2>/dev/null | head -1 >/dev/null 2>&1; then
    echo "--- $svc ---"
    railway variable set "REDIS_URL=$REDIS_REF" -s "$svc" 2>/dev/null || true
    railway variable set "APP_REDIS_URL=$REDIS_REF" -s "$svc" 2>/dev/null || true
    railway variable set "DATABASE_URL=$DB_REF" -s "$svc" 2>/dev/null || true
    railway variable set "APP_DATABASE_URL=$DB_REF" -s "$svc" 2>/dev/null || true
    railway variable set "PYTHONUNBUFFERED=1" -s "$svc" 2>/dev/null || true
    railway variable set 'OPENAI_API_KEY=${{scrapegoat.OPENAI_API_KEY}}' -s "$svc" 2>/dev/null || true
    railway variable set 'USHA_JWT_TOKEN=${{scrapegoat.USHA_JWT_TOKEN}}' -s "$svc" 2>/dev/null || true
    railway variable set 'CHIMERA_BRAIN_HTTP_URL=${{scrapegoat.CHIMERA_BRAIN_HTTP_URL}}' -s "$svc" 2>/dev/null || true
    railway variable set 'CHIMERA_STATION_TIMEOUT=${{scrapegoat.CHIMERA_STATION_TIMEOUT}}' -s "$svc" 2>/dev/null || true
    railway variable set 'ENVIRONMENT=${{scrapegoat.ENVIRONMENT}}' -s "$svc" 2>/dev/null || true
    echo "  Match Scrapegoat: CAPSOLVER, DECODO, USHA_JWT_TOKEN, CHIMERA_BRAIN_HTTP_URL, CHIMERA_STATION_TIMEOUT, OPENAI_API_KEY, ENVIRONMENT."
    echo ""
    break
  fi
done

echo "Done. Run ./scripts/railway-people-search-align.sh to align chimera-core REDIS_URL from Scrapegoat and redeploy (if not using refs)."
echo ""
echo "=============================================="
echo "SHARED VARIABLES YOU CAN SET MANUALLY (Dashboard)"
echo "=============================================="
echo "In Railway: Service → Variables → Add Variable → Reference (or paste the string)."
echo ""
echo "From Redis service (e.g. Redis, redis-bridge):"
echo "  REDIS_URL      = \${{<YourRedisService>.REDIS_URL}}"
echo "  APP_REDIS_URL  = (same)"
echo ""
echo "From Postgres service (e.g. Postgres, PostgreSQL):"
echo "  DATABASE_URL    = \${{<YourPostgresService>.DATABASE_PUBLIC_URL}}  (or .DATABASE_URL if set)"
echo "  APP_DATABASE_URL= (same)"
echo ""
echo "Replace <YourRedisService> / <YourPostgresService> with the exact service names in your project."
echo "If this script's REDIS_REF/DB_REF failed (wrong names), set REDIS_URL and DATABASE_URL in each"
echo "service using the Dashboard Reference picker to the matching infra service."
echo ""
echo "--- Secrets (set manually, never commit) ---"
echo "  RAPIDAPI_KEY, OPENAI_API_KEY, CENSUS_API_KEY, CAPSOLVER_API_KEY, DECODO_API_KEY,"
echo "  USHA_JWT_TOKEN, TELNYX_API_KEY."
echo ""
echo "--- Service-to-service (set manually or in Dashboard) ---"
echo "  SCRAPEGOAT_API_URL or SCRAPEGOAT_URL   (on brainscraper → Scrapegoat URL)"
echo "  CHIMERA_BRAIN_HTTP_URL or CHIMERA_BRAIN_ADDRESS (on scrapegoat, chimera-core → chimera-brain)"
echo "  CHIMERA_BRAIN_ADDRESS                  (on chimera-core → chimera-brain gRPC, e.g. chimera-brain.railway.internal:50051)"
echo "  BRAINSCRAPER_URL                       (on chimera-core → brainscraper, for telemetry)"
echo "  SCRAPEGOAT_URL or DOJO_TRAUMA_URL      (on chimera-core, for Dojo trauma/coordinate-drift)"
echo ""
