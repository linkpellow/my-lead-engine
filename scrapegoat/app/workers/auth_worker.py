"""
Auth Worker - The Session Manager

Maintains active sessions for protected services (USHA, People Search, etc.)
Runs on a loop, checks Redis, and only launches a browser if a token is missing/expired.

This is the "Keymaster" that keeps all your enrichment tools authenticated.

Services Managed:
- USHA DNC Portal: JWT token for DNC scrubbing
- TruePeopleSearch: Cloudflare clearance cookie for free phone lookups

Architecture:
- Checks Redis every 10 minutes
- Only launches browser when tokens are missing/expired
- Stores tokens in Redis with appropriate TTLs
- Enrichment workers read from Redis automatically

Environment Variables:
    REDIS_URL: Redis connection URL
    USHA_USERNAME / USHA_PASSWORD: For USHA DNC portal
    AUTH_REFRESH_INTERVAL_HOURS: Hours between checks (default: 4)
"""
import os
import time
import random
from typing import Optional
from loguru import logger

# Redis for token storage
try:
    import redis  # type: ignore[reportMissingImports]
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("⚠️ Redis not available")

# Playwright for browser automation
try:
    from playwright.sync_api import sync_playwright  # type: ignore[reportMissingImports]
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.warning("⚠️ Playwright not available. Run: pip install playwright && playwright install chromium")


# Configuration
REDIS_URL = os.getenv("REDIS_URL") or os.getenv("APP_REDIS_URL", "redis://localhost:6379")
CHECK_INTERVAL = 600  # Check every 10 minutes
USHA_TOKEN_TTL = 4 * 3600  # 4 hours
TPS_COOKIE_TTL = 2 * 3600  # 2 hours

# USHA Credentials
USHA_USERNAME = os.getenv("USHA_USERNAME") or os.getenv("USHA_EMAIL")
USHA_PASSWORD = os.getenv("USHA_PASSWORD")


def get_redis_client():
    """Get Redis client for token storage"""
    if not REDIS_AVAILABLE:
        raise RuntimeError("Redis not available. Install: pip install redis")
    if not REDIS_URL:
        raise RuntimeError("REDIS_URL not configured")
    return redis.from_url(REDIS_URL, decode_responses=True)


def harvest_usha_token(p):
    """
    Logs into USHA portal and saves the JWT token.
    
    Args:
        p: Playwright sync_playwright context
    """
    if not USHA_USERNAME or not USHA_PASSWORD:
        logger.warning("⚠️ USHA credentials missing. Skipping USHA token harvest.")
        return False

    logger.info("🛡️ Refreshing USHA DNC Token...")
    browser = None
    
    try:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ]
        )
        
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )
        
        page = context.new_page()
        
        # USHA portal URLs (adjust based on your specific portal)
        login_urls = [
            "https://agent.ushadvisors.com",
            "https://tampausha.ushadvisors.com",
            "https://portal.usha.com/login",
        ]
        
        token = None
        
        for login_url in login_urls:
            try:
                logger.info(f"🌐 Navigating to {login_url}")
                page.goto(login_url, timeout=60000, wait_until="networkidle")
                time.sleep(2)
                
                # Try multiple selectors for email/username
                email_selectors = [
                    "input[name='username']",
                    "input[name='email']",
                    "input[type='email']",
                    "input[id='username']",
                    "input[id='email']",
                    "input[placeholder*='email' i]",
                    "input[placeholder*='username' i]",
                ]
                
                password_selectors = [
                    "input[name='password']",
                    "input[type='password']",
                    "input[id='password']",
                ]
                
                submit_selectors = [
                    "button[type='submit']",
                    "input[type='submit']",
                    "button:has-text('Sign in')",
                    "button:has-text('Login')",
                    "button:has-text('Log in')",
                    ".login-button",
                    "#login-btn",
                ]
                
                # Find and fill email
                email_input = None
                for selector in email_selectors:
                    try:
                        element = page.query_selector(selector)
                        if element and element.is_visible():
                            email_input = selector
                            break
                    except:
                        continue
                
                if not email_input:
                    logger.debug(f"   No email input found at {login_url}, trying next...")
                    continue
                
                # Find and fill password
                password_input = None
                for selector in password_selectors:
                    try:
                        element = page.query_selector(selector)
                        if element and element.is_visible():
                            password_input = selector
                            break
                    except:
                        continue
                
                if not password_input:
                    logger.debug(f"   No password input found at {login_url}, trying next...")
                    continue
                
                # Fill credentials with human-like typing
                logger.info("⌨️ Entering credentials...")
                page.click(email_input)
                time.sleep(0.3)
                page.fill(email_input, "")
                for char in USHA_USERNAME:
                    page.type(email_input, char, delay=50 + random.randint(-20, 20))
                
                time.sleep(0.5)
                
                page.click(password_input)
                time.sleep(0.3)
                page.fill(password_input, "")
                for char in USHA_PASSWORD:
                    page.type(password_input, char, delay=50 + random.randint(-20, 20))
                
                time.sleep(0.5)
                
                # Submit form
                submit_button = None
                for selector in submit_selectors:
                    try:
                        element = page.query_selector(selector)
                        if element and element.is_visible():
                            submit_button = selector
                            break
                    except:
                        continue
                
                if submit_button:
                    logger.info("🖱️ Clicking submit...")
                    page.click(submit_button)
                else:
                    logger.info("⏎ Pressing Enter to submit...")
                    page.keyboard.press("Enter")
                
                # Wait for navigation/auth completion
                logger.info("⏳ Waiting for authentication...")
                time.sleep(5)
                page.wait_for_load_state("networkidle", timeout=30000)
                time.sleep(2)
                
                # Extract token from localStorage
                local_storage = page.evaluate("""() => {
                    const items = {};
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        items[key] = localStorage.getItem(key);
                    }
                    return items;
                }""")
                
                # Look for token in localStorage
                for key, value in local_storage.items():
                    key_lower = key.lower()
                    if any(t in key_lower for t in ["token", "jwt", "auth", "access", "cognito"]):
                        if value and (value.startswith("eyJ") or len(value) > 50):
                            token = value
                            logger.info(f"🗄️ Token extracted from localStorage: {key}")
                            break
                
                # Also check sessionStorage
                if not token:
                    session_storage = page.evaluate("""() => {
                        const items = {};
                        for (let i = 0; i < sessionStorage.length; i++) {
                            const key = sessionStorage.key(i);
                            items[key] = sessionStorage.getItem(key);
                        }
                        return items;
                    }""")
                    
                    for key, value in session_storage.items():
                        key_lower = key.lower()
                        if any(t in key_lower for t in ["token", "jwt", "auth", "access"]):
                            if value and (value.startswith("eyJ") or len(value) > 50):
                                token = value
                                logger.info(f"🗄️ Token extracted from sessionStorage: {key}")
                                break
                
                # Check cookies for token
                if not token:
                    cookies = context.cookies()
                    for cookie in cookies:
                        name = cookie.get("name", "").lower()
                        value = cookie.get("value", "")
                        if any(t in name for t in ["token", "jwt", "auth", "session"]):
                            if value and len(value) > 50:
                                token = value
                                logger.info(f"🍪 Token extracted from cookie: {cookie.get('name')}")
                                break
                
                if token:
                    break  # Success, exit URL loop
                else:
                    logger.warning(f"⚠️ Login at {login_url} appeared successful but no token found")
                    # Try next URL
                    continue
                    
            except Exception as e:
                logger.debug(f"   Error at {login_url}: {e}")
                continue
        
        # Save token to Redis
        if token:
            try:
                r = get_redis_client()
                r.setex("auth:usha:token", USHA_TOKEN_TTL, token)
                logger.success(f"✅ USHA Token stored in Redis (TTL: {USHA_TOKEN_TTL}s)")
                logger.info(f"   Token preview: {token[:20]}...{token[-10:]}")
                return True
            except Exception as e:
                logger.error(f"❌ Failed to store USHA token in Redis: {e}")
                return False
        else:
            logger.error("❌ USHA login failed - no token found after trying all URLs")
            return False
            
    except Exception as e:
        logger.error(f"💥 USHA login error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if browser:
            browser.close()


def harvest_peoplesearch_cookie(p):
    """
    Visits TruePeopleSearch to get Cloudflare clearance cookie.
    
    Args:
        p: Playwright sync_playwright context
    """
    logger.info("🔎 Refreshing PeopleSearch Cloudflare Cookie...")
    browser = None
    
    try:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ]
        )
        
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )
        
        page = context.new_page()
        
        # Visit the site to trigger Cloudflare challenge
        logger.info("🌐 Visiting TruePeopleSearch...")
        page.goto("https://www.truepeoplesearch.com/", timeout=60000, wait_until="networkidle")
        
        # Wait for Cloudflare challenge to solve (if present)
        logger.info("⏳ Waiting for Cloudflare challenge...")
        time.sleep(5)
        page.wait_for_load_state("networkidle", timeout=30000)
        time.sleep(2)
        
        # Extract cookies
        cookies = context.cookies()
        cf_cookie = None
        for cookie in cookies:
            if cookie.get('name') == 'cf_clearance':
                cf_cookie = cookie.get('value')
                break
        
        # Get user agent (must match for Cloudflare)
        user_agent = page.evaluate("navigator.userAgent")
        
        if cf_cookie:
            try:
                r = get_redis_client()
                r.setex("auth:tps:cookie", TPS_COOKIE_TTL, cf_cookie)
                r.setex("auth:tps:ua", TPS_COOKIE_TTL, user_agent)
                logger.success("✅ PeopleSearch Cookie stored in Redis")
                logger.info(f"   Cookie: {cf_cookie[:20]}...")
                logger.info(f"   User-Agent: {user_agent[:50]}...")
                return True
            except Exception as e:
                logger.error(f"❌ Failed to store cookie in Redis: {e}")
                return False
        else:
            # Sometimes there is no challenge, just mark as ready
            logger.info("ℹ️ No Cloudflare cookie found (maybe not required right now)")
            try:
                r = get_redis_client()
                r.setex("auth:tps:ready", 3600, "true")
                return True
            except Exception as e:
                logger.warning(f"⚠️ Failed to mark as ready: {e}")
                return False
                
    except Exception as e:
        logger.error(f"💥 PeopleSearch cookie harvest failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if browser:
            browser.close()


def check_token_freshness(redis_client, key: str, min_ttl: int = 3600) -> bool:
    """
    Check if a token exists and has sufficient TTL remaining.
    
    Args:
        redis_client: Redis client
        key: Redis key to check
        min_ttl: Minimum TTL in seconds to consider "fresh" (default: 1 hour)
        
    Returns:
        True if token exists and is fresh, False otherwise
    """
    try:
        token = redis_client.get(key)
        if not token:
            return False
        
        ttl = redis_client.ttl(key)
        if ttl < min_ttl:
            return False
        
        return True
    except Exception:
        return False


def start_auth_loop():
    """
    Main Session Manager loop.
    
    Checks Redis every CHECK_INTERVAL seconds and only launches browser
    when tokens are missing or expiring soon.
    """
    logger.info("=" * 60)
    logger.info("🔐 SESSION MANAGER - Online")
    logger.info("=" * 60)
    logger.info(f"   Check interval: {CHECK_INTERVAL}s (10 minutes)")
    logger.info(f"   USHA token TTL: {USHA_TOKEN_TTL}s (4 hours)")
    logger.info(f"   TPS cookie TTL: {TPS_COOKIE_TTL}s (2 hours)")
    logger.info(f"   USHA credentials: {'✅ Configured' if USHA_USERNAME else '❌ Not set'}")
    logger.info("=" * 60)
    
    if not PLAYWRIGHT_AVAILABLE:
        logger.error("❌ Playwright not available - Session Manager cannot function")
        logger.info("   Install: pip install playwright && playwright install chromium")
        return
    
    if not REDIS_AVAILABLE:
        logger.error("❌ Redis not available - Session Manager cannot function")
        logger.info("   Install: pip install redis")
        return
    
    # Initial harvest on startup
    logger.info("🚀 Performing initial session check...")
    with sync_playwright() as p:
        # Check USHA token
        try:
            r = get_redis_client()
            if not check_token_freshness(r, "auth:usha:token"):
                harvest_usha_token(p)
        except Exception as e:
            logger.warning(f"⚠️ Initial USHA check failed: {e}")
        
        # Check PeopleSearch cookie
        try:
            r = get_redis_client()
            if not check_token_freshness(r, "auth:tps:cookie") and not r.get("auth:tps:ready"):
                harvest_peoplesearch_cookie(p)
        except Exception as e:
            logger.warning(f"⚠️ Initial TPS check failed: {e}")
    
    # Main loop - check every CHECK_INTERVAL seconds
    while True:
        try:
            logger.debug(f"💤 Sleeping for {CHECK_INTERVAL}s until next check...")
            time.sleep(CHECK_INTERVAL)
            
            logger.info("🔄 Checking session freshness...")
            
            with sync_playwright() as p:
                # Check USHA token
                try:
                    r = get_redis_client()
                    if not check_token_freshness(r, "auth:usha:token"):
                        logger.info("🔄 USHA token missing/expiring - refreshing...")
                        harvest_usha_token(p)
                    else:
                        ttl = r.ttl("auth:usha:token")
                        logger.debug(f"✅ USHA token fresh (TTL: {ttl}s)")
                except Exception as e:
                    logger.warning(f"⚠️ USHA check failed: {e}")
                
                # Check PeopleSearch cookie
                try:
                    r = get_redis_client()
                    if not check_token_freshness(r, "auth:tps:cookie") and not r.get("auth:tps:ready"):
                        logger.info("🔄 PeopleSearch cookie missing/expiring - refreshing...")
                        harvest_peoplesearch_cookie(p)
                    else:
                        logger.debug("✅ PeopleSearch cookie fresh")
                except Exception as e:
                    logger.warning(f"⚠️ TPS check failed: {e}")
                    
        except KeyboardInterrupt:
            logger.info("🛑 Session Manager stopped by user")
            break
        except Exception as e:
            logger.error(f"💥 Session Manager error: {e}")
            time.sleep(60)  # Wait 1 minute before retry


# CLI entry point
if __name__ == "__main__":
    start_auth_loop()
