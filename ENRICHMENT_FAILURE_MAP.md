# Why It’s Failing: Mechanisms vs. What’s Actually Breaking

You’ve added CAPTCHA, honeypots, rate limiting, DOM parsing, OCR, etc. Those apply at the **site/protocol** layer. The current failures are mostly **before** we get to that layer, or in **different** layers.

---

## 1. What each mechanism is for

| Mechanism | What it handles | Where it runs |
|-----------|-----------------|---------------|
| **CAPTCHA solving** (CapSolver, etc.) | reCAPTCHA, Turnstile, Cloudflare challenge, etc. | HTTP: `_make_request` on 403/503. **Chimera Core:** `_detect_and_solve_captcha`. **Browser (Scraper/TruePeopleSearch):** not wired in. |
| **Honeypots** | Form traps, fake fields | Form fill (Chimera pivot, etc.). Doesn’t help if we never load the form. |
| **Rate limiting** | 429, Retry-After, backoff | `_make_request`, circuit breaker, `RateLimitState`. Doesn’t help if the request fails in our client before we get a response. |
| **DOM parsing / selectors** | Changing layouts, extraction | BlueprintExtractor, TruePeopleSearch card selectors, LLM parse. Doesn’t help if we never get valid HTML (block, empty, or client error). |
| **OCR** | Image CAPTCHA, scanned content | Used where we explicitly call it. Doesn’t help if we fail earlier. |
| **verify_page_content** | Soft blocks, “empty” pages | Block indicators + success keywords. **Browser path only.** No `detect_captcha_in_html` and no CAPTCHA solver in that path. |
| **Vision verify** | “Is this a real results page or block/empty?” | `_verify_with_vision` in base. **Not used:** TruePeopleSearch calls `verify_page_content` without `use_vision` or `screenshot_path`. |

So: we have a lot of **site‑facing** logic. The issues below are either **upstream** of that, or in **browser‑specific** wiring.

---

## 2. What’s actually failing (and where the gap is)

| Observed failure | Mechanism that *could* help | Why it doesn’t | Real cause / gap |
|------------------|----------------------------|----------------|------------------|
| **Chimera: `waiting_core`, no LPUSH** | CAPTCHA, pivot, DOM, etc. in Chimera Core | Core often never runs the mission (no consume or crash before pivot). | **Infra:** REDIS_URL, Core not running, or exit in DB/CreepJS/worker init. Not a site-defense problem. |
| **Scraper HTTP: “impersonate chrome119 is not supported”** | Rate limit, CAPTCHA, DOM | Request fails in `curl_cffi` **before** we get a response. No status, no HTML. | **Our stack:** `curl_cffi` 0.5.x doesn’t support chrome116/119/120. IMPERSONATE_PROFILES was using those. Fixed to chrome101–110. |
| **Scraper HTTP: “object NoneType can’t be used in ‘await’ expression”** | — | Follows from the impersonate error in the client. | Same as above; fixing impersonate fixes this. |
| **Scraper browser: “No success keywords found – page may be empty or blocked”** | CAPTCHA, block detection, vision | 1) `verify_page_content` does **not** call `detect_captcha_in_html`. 2) Vision verify is never used (`use_vision`/`screenshot_path` not passed). 3) If the page is a soft block with different copy, block_indicators can miss it. | **Gap:** In **browser/Playwright** flows we never run CAPTCHA detection or solving on the fetched HTML. Success keywords can also be wrong or too strict for “no results” or changed layout. |
| **Skip-trace: 404 on alternative API** | — | Wrong host/path. | **Config:** `skip-tracing-api.p.rapidapi.com` was wrong. Fallback now uses `skip-tracing-working-api.p.rapidapi.com` like the primary. |

---

## 3. “We’ve covered every base” – what’s actually covered

- **HTTP path (BlueprintExtractor, `_make_request`):**  
  - CAPTCHA: ✅ on 403/503 we run `detect_captcha_in_html` and `get_captcha_solver()`.  
  - Rate limits, circuit breaker, retries: ✅.  
  - Impersonate: ✅ **after** the chrome101–110 fix and redeploy.

- **Chimera Core (when it runs):**  
  - CAPTCHA, pivot, VLM: ✅ in workers.  
  - **But:** if Core never gets the mission or exits earlier, none of this runs. That’s infra/Redis/startup, not “one more CAPTCHA.”

- **Browser path (TruePeopleSearch, Playwright):**  
  - `verify_page_content`: block_indicators, success_keywords, **empty_indicators** (no-results not treated as block), **`detect_captcha_in_html`**, **_verify_with_vision** when `use_vision`+`screenshot_path` are passed.  
  - **Solver wired:** when verify returns False and CAPTCHA is detected, TruePeopleSearch runs `_try_solve_captcha_in_browser` (CapSolver: recaptcha/hCaptcha/turnstile/cloudflare_challenge; VLM for recaptcha image), then **solve-then-reload** and retries `verify_page_content` once. Screenshot + `use_vision`/`screenshot_path` on first run.

---

## 4. What’s left to do

1. **Chimera not LPUSHing**  
   - Fix: `./scripts/railway-people-search-align.sh`, REDIS_URL on chimera-core, check Core logs for exits during CreepJS or worker init. Chimera logs remind to run the align script when REDIS_URL is missing.

2. **Impersonate / client_error**  
   - Fix: IMPERSONATE_PROFILES = chrome101–110 only. **Redeploy Scrapegoat immediately** to clear NoneType and impersonate errors.

3. **Browser “empty or blocked”**  
   - **Done:** `verify_page_content` runs `detect_captcha_in_html`, **empty_indicators** (no-results not treated as block), and `_verify_with_vision` when the spider passes a screenshot. TruePeopleSearch passes `use_vision=True` and `screenshot_path`. **Solver wired:** on CAPTCHA detect, `_try_solve_captcha_in_browser` (recaptcha/hCaptcha/turnstile/cloudflare_challenge) and **solve-then-reload**; one retry of `verify_page_content`.

4. **Which site works**  
   - Use **`GET /probe/sites`** (and `?site=fastpeoplesearch.com` for one).  
   - It uses the same HTTP/stealth stack as production. After the impersonate fix and redeploy, `ok` means we got a non‑blocked, “success‑like” page; `block` / `empty` / `client_error` / `timeout` narrow it down.

---

## 5. How to use the probe

After Scrapegoat is redeployed (with the impersonate fix):

```bash
# All 3 Scraper sites
curl -s "https://<SCRAPEGOAT_URL>/probe/sites"

# One site
curl -s "https://<SCRAPEGOAT_URL>/probe/sites?site=fastpeoplesearch.com"
```

Example:

```json
{
  "fastpeoplesearch.com": "ok",
  "thatsthem.com": "block",
  "truepeoplesearch.com": "client_error"
}
```

- **`ok`** – reached the page and it looks like a normal people-search page (good candidate to focus on).  
- **`block`** – block-like text (Cloudflare, “blocked”, etc.).  
- **`empty`** – no block phrases, no success keywords (soft block or “no results” style page).  
- **`client_error`** – our client failed (e.g. impersonate, connection).  
- **`timeout`** – request timed out.  
- **`http_403`** etc. – HTTP 4xx/5xx.

Use `ok` to choose `CHIMERA_PROVIDERS` or to prioritize which Scraper site to fix first (e.g. selectors, browser, or CAPTCHA for that domain).

---

## 6. Bottom-up order of operations (priority checklist)

| Priority | Component | Fix |
|----------|-----------|-----|
| 1 (Critical) | Scraper HTTP | IMPERSONATE_PROFILES = chrome101–110 only. Redeploy Scrapegoat. |
| 2 (Critical) | Infra/Redis | Run `./scripts/railway-people-search-align.sh`. Check Chimera Core logs for exits during CreepJS or worker init. |
| 3 (Important) | Browser flow | `detect_captcha_in_html` in `verify_page_content`; `use_vision` + `screenshot_path`; **CAPTCHA solver + solve-then-reload** in TruePeopleSearch (`_try_solve_captcha_in_browser`); empty_indicators so "No results" is not a block. |
| 4 (Testing) | Probe | `curl -s "https://<SCRAPEGOAT_URL>/probe/sites"` to pick `CHIMERA_PROVIDERS`. Use only `ok` sites. |

---

## 7. Final success checklist (all automated)

- **Impersonate:** No profile higher than chrome110. Enforced by assert in `base.py`; IMPERSONATE_PROFILES = chrome101–110.
- **Core missions:** `./scripts/railway-people-search-align.sh` sets chimera-core REDIS_URL (from Scrapegoat), redeploys chimera-core. Check Core logs only if missions still don’t run.
- **Browser wiring:** `detect_captcha_in_html` in `verify_page_content`; on CAPTCHA, `_try_solve_captcha_in_browser` + solve-then-reload in TruePeopleSearch. ✓ wired.
- **Provider list:** The align script sets `CHIMERA_PROVIDERS` from `/probe/sites` (only `ok` sites) when `SCRAPEGOAT_URL` or scrapegoat’s `RAILWAY_STATIC_URL` is available, then redeploys Scrapegoat.

**Single command (no manual steps):**  
`./scripts/railway-people-search-align.sh`  
(Optionally `SCRAPEGOAT_URL=https://scrapegoat-xxx.up.railway.app` if Railway doesn’t set `RAILWAY_STATIC_URL` on scrapegoat.)
