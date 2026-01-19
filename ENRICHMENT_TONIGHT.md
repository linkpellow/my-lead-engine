# Enrichment: Get Results Tonight (Minimal All‑Nighter)

**One‑website‑at‑a‑time and faster timeouts are supported.** Use the steps below to get something working in the next 1–2 hours.

---

## Will it still work?

Yes. The pipeline already runs end‑to‑end and has saved leads. These changes reduce wait time when Chimera Core is down and focus Chimera on one site so you see results sooner.

---

## 1. Set 3 Scrapegoat env vars (Railway)

In **Railway → scrapegoat → Variables**, add or update:

| Variable | Value | Why |
|----------|-------|-----|
| `CHIMERA_STATION_TIMEOUT` | `25` | When Chimera Core doesn’t respond, timeout in 25s instead of 90s. Saves ~6 min per lead. |
| `CHIMERA_PROVIDERS` | `FastPeopleSearch` | Use only one people‑search site for Chimera. 1×25s instead of 6×90s when Core is down. |
| *(optional)* `CHIMERA_PROVIDERS` | `FastPeopleSearch,TruePeopleSearch` | To try a second site only when the first fails. |

To try a different single site: `TruePeopleSearch`, `ThatsThem`, `ZabaSearch`, `SearchPeopleFree`, or `AnyWho`.

---

## 2. Redeploy Scrapegoat

- **Railway:** scrapegoat → Deploy → **Redeploy** (or push to the branch it deploys from).
- This picks up: impersonate fix (chrome101–110), `CHIMERA_PROVIDERS`, and skip‑trace alternative using the working API host.

---

## 3. (Optional, ~5 min) Chimera Core – same Redis

If you want Chimera Deep Search to actually return results (not just time out faster):

```bash
./scripts/railway-people-search-align.sh
```

Then check **chimera-core** logs in Railway for `[ChimeraCore] mission consumed` and `LPUSH chimera:results:...`. If you see those, Chimera is working.

---

## 4. Skip‑tracing

- **Primary:** `skip-tracing-working-api.p.rapidapi.com` with `RAPIDAPI_KEY`.
- The fallback now uses the same host (the old `skip-tracing-api.p.rapidapi.com` URL was 404).  
- If you still get no phone from skip‑trace: confirm the RapidAPI app for **skip-tracing-working-api** is subscribed and the key has access to `/search/bynameaddress` and `/search/byemail`.

---

## 5. Run a test

1. v2‑pilot → **Queue CSV** (e.g. 1–2 rows with `LinkedIn URL, Name, Location`).
2. **Enrich**.
3. With `CHIMERA_STATION_TIMEOUT=25` and `CHIMERA_PROVIDERS=FastPeopleSearch`, Chimera will wait at most **25s** per lead when Core doesn’t LPUSH, then continue to Scraper Enrichment and Skip‑tracing.

---

## 6. If you want two or three sites later

Set for example:

- `CHIMERA_PROVIDERS=FastPeopleSearch,TruePeopleSearch,ThatsThem`  
Chimera will try them in order until one succeeds or all are tried. With 25s timeout, worst case is 3×25s when Core is down.

---

## Summary

| Change | Effect |
|--------|--------|
| `CHIMERA_STATION_TIMEOUT=25` | Chimera step stops after 25s when Core doesn’t answer. |
| `CHIMERA_PROVIDERS=FastPeopleSearch` | Only one Chimera provider; 25s max instead of 6×90s. |
| Impersonate fix (in code) | STEALTH HTTP works with curl_cffi 0.5.x. |
| Skip‑trace alternative (in code) | Fallback uses working API host instead of 404. |
| `railway-people-search-align.sh` | Fixes Chimera Core `REDIS_URL` so it can consume missions and LPUSH results. |

Do **1 + 2** first, then run **5**. Add **3** when ready for Chimera; **4** if skip-trace still returns no phones.

**Which site works?** After redeploy: `curl -s "https://<SCRAPEGOAT_URL>/probe/sites"` (or `?site=fastpeoplesearch.com`). You get `ok`, `block`, `empty`, `client_error`, `timeout` per site. See **`ENRICHMENT_FAILURE_MAP.md`**.
