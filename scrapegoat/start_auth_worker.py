#!/usr/bin/env python3
"""
Start Auth Worker - Automated Cookie Harvester

This worker runs independently and keeps session cookies fresh.
Deploy as a separate Railway service or run locally.

Usage:
    python start_auth_worker.py
    
Environment Variables (Required):
    REDIS_URL - Redis connection for cookie storage
    
    At least one platform credentials:
    LINKEDIN_EMAIL / LINKEDIN_PASSWORD
    FACEBOOK_EMAIL / FACEBOOK_PASSWORD
    USHA_EMAIL / USHA_PASSWORD
    
Optional:
    AUTH_REFRESH_INTERVAL_HOURS - Hours between refreshes (default: 6)
    PROXY_URL - Residential proxy for login requests
"""

import asyncio
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from loguru import logger

# Configure logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{extra[worker]}</cyan> | <level>{message}</level>",
    level="INFO",
)


def check_requirements():
    """Check that required dependencies are available"""
    
    # Check Redis URL
    redis_url = os.getenv("REDIS_URL") or os.getenv("APP_REDIS_URL")
    if not redis_url:
        logger.error("❌ REDIS_URL not set. Auth Worker needs Redis to store cookies.")
        return False
    
    # Check for at least one platform credentials
    has_linkedin = os.getenv("LINKEDIN_EMAIL") and os.getenv("LINKEDIN_PASSWORD")
    has_facebook = os.getenv("FACEBOOK_EMAIL") and os.getenv("FACEBOOK_PASSWORD")
    has_usha = os.getenv("USHA_EMAIL") and os.getenv("USHA_PASSWORD")
    
    if not (has_linkedin or has_facebook or has_usha):
        logger.error("❌ No platform credentials found. Set at least one of:")
        logger.error("   LINKEDIN_EMAIL + LINKEDIN_PASSWORD")
        logger.error("   FACEBOOK_EMAIL + FACEBOOK_PASSWORD")
        logger.error("   USHA_EMAIL + USHA_PASSWORD")
        return False
    
    # Check Playwright
    try:
        from playwright.async_api import async_playwright  # type: ignore[reportMissingImports]
        logger.info("✅ Playwright available")
    except ImportError:
        logger.error("❌ Playwright not installed. Run: pip install playwright && playwright install chromium")
        return False
    
    # Log configured platforms
    logger.info("🔧 Configured platforms:")
    if has_linkedin:
        logger.info(f"   ✅ LinkedIn ({os.getenv('LINKEDIN_EMAIL')})")
    if has_facebook:
        logger.info(f"   ✅ Facebook ({os.getenv('FACEBOOK_EMAIL')})")
    if has_usha:
        logger.info(f"   ✅ USHA ({os.getenv('USHA_EMAIL')})")
    
    # Log refresh interval
    interval = os.getenv("AUTH_REFRESH_INTERVAL_HOURS", "6")
    logger.info(f"🔄 Refresh interval: {interval} hours")
    
    # Log proxy if configured
    proxy = os.getenv("PROXY_URL") or os.getenv("ROTATING_PROXY_URL")
    if proxy:
        # Mask password in log
        masked = proxy.split('@')[-1] if '@' in proxy else proxy
        logger.info(f"🌐 Proxy configured: {masked}")
    
    return True


async def main():
    """Main entry point"""
    logger.info("=" * 60)
    logger.info("🤖 AUTH WORKER - Automated Cookie Harvester")
    logger.info("=" * 60)
    
    if not check_requirements():
        logger.error("❌ Requirements check failed. Exiting.")
        sys.exit(1)
    
    from app.workers.auth_worker import AuthWorker
    
    worker = AuthWorker()
    
    try:
        await worker.run()
    except KeyboardInterrupt:
        worker.stop()
        logger.info("👋 Auth Worker stopped by user")
    except Exception as e:
        logger.error(f"💀 Auth Worker crashed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
