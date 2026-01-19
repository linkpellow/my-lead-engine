#!/usr/bin/env bash
# One-time alignment for Chimera people-search: same Redis as Scrapegoat, 90s timeouts, CHIMERA_PROVIDERS from probe, redeploys.
# Run from repo root with Railway project linked: ./scripts/railway-people-search-align.sh
# Optional: SCRAPEGOAT_URL=https://scrapegoat-xxx.up.railway.app to set CHIMERA_PROVIDERS from /probe/sites (only "ok" sites).
#
# 1) chimera-core: REDIS_URL same as Scrapegoat (needed for BRPOP chimera:missions, LPUSH chimera:results)
# 2) Scrapegoat: CHIMERA_STATION_TIMEOUT=90; 2b) if SCRAPEGOAT_URL: CHIMERA_PROVIDERS from /probe/sites (only ok)
# 3) Redeploy chimera-core and scrapegoat
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "People-search alignment (Chimera Core + Scrapegoat)"
echo ""

# Require Railway CLI and project link
if ! command -v railway >/dev/null 2>&1; then
  echo "railway CLI not found. Install: https://docs.railway.app/develop/cli"
  exit 1
fi
if ! railway whoami >/dev/null 2>&1; then
  echo "railway not linked or not logged in. Run: railway login && railway link"
  exit 1
fi

# --- 1) chimera-core: REDIS_URL (same as Scrapegoat) ---
REDIS_VAL=""
for v in REDIS_URL APP_REDIS_URL; do
  REDIS_VAL=$(railway run -s scrapegoat -- printenv "$v" 2>/dev/null || true)
  REDIS_VAL=$(printf '%s' "$REDIS_VAL" | tr -d '\n\r')
  if [ -n "$REDIS_VAL" ]; then break; fi
done
# Fallback: allow caller to pass REDIS_URL (e.g. REDIS_URL='redis://...' ./scripts/railway-people-search-align.sh)
if [ -z "$REDIS_VAL" ] && [ -n "$REDIS_URL" ]; then REDIS_VAL=$REDIS_URL; fi

if [ -n "$REDIS_VAL" ]; then
  railway variable set "REDIS_URL=$REDIS_VAL" -s chimera-core
  echo "   chimera-core: REDIS_URL set (from Scrapegoat or REDIS_URL env)"
else
  echo "   Could not read REDIS_URL/APP_REDIS_URL from Scrapegoat (railway run may not expose values)."
  echo "   Set chimera-core REDIS_URL manually: Railway Dashboard → chimera-core → Variables → REDIS_URL."
  echo "   Use the same value as Scrapegoat (redis.railway.internal) or a Variable Reference to your Redis service."
  echo "   Then: railway redeploy -s chimera-core -y"
  echo ""
  read -r -p "   Continue without setting REDIS_URL? Redeploys will still run. [y/N] " ans
  case "$ans" in [yY]|[yY][eE][sS]) ;; *) exit 1; esac
fi

# --- 2) Scrapegoat: CHIMERA_STATION_TIMEOUT=90 ---
railway variable set "CHIMERA_STATION_TIMEOUT=90" -s scrapegoat
echo "   scrapegoat: CHIMERA_STATION_TIMEOUT=90"

# --- 2b) Scrapegoat: CHIMERA_PROVIDERS from /probe/sites (only "ok" sites). SCRAPEGOAT_URL or RAILWAY_STATIC_URL from scrapegoat. ---
PROBE_BASE="${SCRAPEGOAT_URL:-}"
[ -z "$PROBE_BASE" ] && PROBE_BASE=$(railway run -s scrapegoat -- printenv RAILWAY_STATIC_URL 2>/dev/null | tr -d '\n\r' || true)
PROBE_BASE="${PROBE_BASE%/}"
if [ -n "$PROBE_BASE" ]; then
  echo "   Probing $PROBE_BASE/probe/sites for ok sites..."
  PROBE_JSON=$(curl -s --connect-timeout 10 --max-time 30 "$PROBE_BASE/probe/sites" 2>/dev/null || true)
  if [ -n "$PROBE_JSON" ]; then
    OK_SITES=$(printf '%s' "$PROBE_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(','.join(k for k, v in (d.items() if isinstance(d, dict) else []) if v == 'ok'))
except Exception:
    print('')
" 2>/dev/null || true)
    if [ -n "$OK_SITES" ]; then
      railway variable set "CHIMERA_PROVIDERS=$OK_SITES" -s scrapegoat
      echo "   scrapegoat: CHIMERA_PROVIDERS=$OK_SITES (from probe)"
    else
      echo "   No ok sites from probe; CHIMERA_PROVIDERS left unset (router uses default MAGAZINE)"
    fi
  else
    echo "   Probe request failed; CHIMERA_PROVIDERS left unset"
  fi
else
  echo "   SCRAPEGOAT_URL / scrapegoat RAILWAY_STATIC_URL not set; CHIMERA_PROVIDERS left unset. Set SCRAPEGOAT_URL to auto-set from /probe/sites"
fi

# --- 3) Redeploys ---
echo ""
echo "Redeploying chimera-core (picks up REDIS_URL, MISSION_TIMEOUT_SEC=90)..."
CORE_SKIP=0
if ! railway redeploy -s chimera-core -y; then
  CORE_SKIP=1
  echo "   chimera-core: redeploy skipped (service may be building or deploying). Run when idle: railway redeploy -s chimera-core -y"
fi

echo "Redeploying scrapegoat (picks up CHIMERA_STATION_TIMEOUT, CHIMERA_PROVIDERS)..."
GOAT_SKIP=0
if ! railway redeploy -s scrapegoat -y; then
  GOAT_SKIP=1
  echo "   scrapegoat: redeploy skipped (service may be building or deploying). Run when idle: railway redeploy -s scrapegoat -y"
fi

echo ""
echo "Done. Chimera Core will BRPOP chimera:missions and LPUSH chimera:results; Scrapegoat will wait 90s per provider."
if [ "$CORE_SKIP" = "1" ] || [ "$GOAT_SKIP" = "1" ]; then
  echo "Reminder — run when each service is idle:"
  [ "$CORE_SKIP" = "1" ] && echo "  railway redeploy -s chimera-core -y   # pick up REDIS_URL"
  [ "$GOAT_SKIP" = "1" ] && echo "  railway redeploy -s scrapegoat -y     # pick up CHIMERA_STATION_TIMEOUT, CHIMERA_PROVIDERS"
fi
echo "Verify: railway variable list -s chimera-core --kv | grep REDIS_URL"
echo "        railway variable list -s scrapegoat --kv | grep CHIMERA_STATION_TIMEOUT"
echo "        railway variable list -s scrapegoat --kv | grep CHIMERA_PROVIDERS"
