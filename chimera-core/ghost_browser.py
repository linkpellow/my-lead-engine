"""
Ghost Browser - Session warmup for stealth.

perform_warmup(worker): Navigate to a random news/social site for 30-60s
before starting a mission to build session trust. You aren't just a visitor;
you are a "User" with a history.
"""

import asyncio
import logging
import random

logger = logging.getLogger(__name__)

# Benign news/social sites for warmup (session trust)
WARMUP_URLS = [
    "https://www.bbc.com/news",
    "https://www.reuters.com",
    "https://www.npr.org",
    "https://www.washingtonpost.com",
    "https://news.ycombinator.com",
    "https://www.theguardian.com/us",
    "https://www.latimes.com",
    "https://www.nytimes.com",
    "https://www.reddit.com",
    "https://www.wikipedia.org",
]

WARMUP_DURATION_MIN = 30
WARMUP_DURATION_MAX = 60


async def perform_warmup(worker) -> None:
    """
    Navigate to a random news/social site for 30-60s before starting a mission.
    Builds session trust: you are a "User" with a history, not a fresh visitor.
    """
    page = getattr(worker, "_page", None)
    if not page:
        logger.debug("perform_warmup: no page, skip")
        return

    url = random.choice(WARMUP_URLS)
    duration = random.uniform(WARMUP_DURATION_MIN, WARMUP_DURATION_MAX)

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        # Simulate reading: stay 30-60s
        await asyncio.sleep(duration)
        logger.info("Ghost warmup done: %s for %.1fs", url, duration)
    except Exception as e:
        logger.debug("Ghost warmup failed (non-fatal): %s", e)
