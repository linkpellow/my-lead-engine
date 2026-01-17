"""
API Scout - The "Free Option" Hunter
Scrapes RapidAPI to build a manifest of Data Enrichment APIs.
Extracts: Link, Name, Free Tier Limits, and Rate Limits.

This script builds a "Menu of Options" by discovering all data enrichment APIs
on RapidAPI Hub and extracting their free tier information for manual verification.
"""
import asyncio
import csv
import json
import os
import random
import re
import sys
from pathlib import Path
from typing import List, Dict, Optional
from loguru import logger

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.scraping.browser_mode import BrowserModeScraper

# 🎯 Target Categories for Data Enrichment
SEARCH_TERMS = [
    "skip tracing",
    "email verification",
    "phone validation",
    "linkedin profile",
    "background check",
    "people search",
    "company enrichment",
    "instagram scraper",
    "facebook scraper",
    "data enrichment",
    "identity resolution",
    "address validation",
    "reverse phone lookup",
    "email finder",
    "social media scraper"
]

OUTPUT_DIR = project_root / "data"
OUTPUT_CSV = OUTPUT_DIR / "discovered_rapidapi_free_tier.csv"
OUTPUT_JSON = OUTPUT_DIR / "discovered_rapidapi_free_tier.json"


async def extract_pricing_details(browser: BrowserModeScraper, api_link: str) -> Dict[str, str]:
    """
    Navigates to the Pricing tab and extracts free tier limits and rate limits.
    
    Returns:
        Dict with monthly_limit, rate_limit, and is_truly_free
    """
    pricing_info = {
        "monthly_limit": "Unknown",
        "rate_limit": "Unknown",
        "is_truly_free": False
    }
    
    try:
        # Navigate to pricing page
        pricing_url = f"{api_link}/pricing" if not api_link.endswith("/pricing") else api_link
        await browser.goto(pricing_url, wait_until="networkidle")
        await asyncio.sleep(2)  # Wait for React to render
        
        page = browser.page
        
        # Get page content
        html = await browser.get_html()
        text_content = await browser.evaluate("() => document.body.innerText")
        
        # Look for free tier indicators
        free_indicators = [
            "$0.00",
            "$0",
            "Free",
            "Basic",
            "Starter",
            "Free Tier",
            "Free Plan"
        ]
        
        has_free_tier = any(indicator.lower() in text_content.lower() or indicator in html for indicator in free_indicators)
        pricing_info["is_truly_free"] = has_free_tier
        
        if has_free_tier:
            # Extract monthly limit patterns
            # Common patterns: "500 / month", "1000 requests/month", "50 calls/month"
            monthly_patterns = [
                r'(\d+[\d,]*)\s*/\s*month',
                r'(\d+[\d,]*)\s*requests?\s*/?\s*month',
                r'(\d+[\d,]*)\s*calls?\s*/?\s*month',
                r'(\d+[\d,]*)\s*queries?\s*/?\s*month',
            ]
            
            for pattern in monthly_patterns:
                match = re.search(pattern, text_content, re.IGNORECASE)
                if match:
                    pricing_info["monthly_limit"] = match.group(0).strip()
                    break
            
            # Extract rate limit patterns
            # Common patterns: "1 request/sec", "2 requests/minute", "10 req/min"
            rate_patterns = [
                r'(\d+[\d,]*)\s*requests?\s*/?\s*(?:per\s*)?(?:sec|second|min|minute|hour)',
                r'(\d+[\d,]*)\s*req\s*/?\s*(?:sec|min|hour)',
                r'(\d+[\d,]*)\s*calls?\s*/?\s*(?:sec|second|min|minute)',
                r'rate\s*limit[:\s]+(\d+[\d,]*)\s*/?\s*(?:sec|min|hour)',
            ]
            
            for pattern in rate_patterns:
                match = re.search(pattern, text_content, re.IGNORECASE)
                if match:
                    pricing_info["rate_limit"] = match.group(0).strip()
                    break
            
            # If we found free tier but no specific limits, mark as "Free (Unknown Limits)"
            if pricing_info["monthly_limit"] == "Unknown" and pricing_info["rate_limit"] == "Unknown":
                pricing_info["monthly_limit"] = "Free (Check Pricing Page)"
        
        # Also check for "Hard Limit" which often indicates free tier
        if "hard limit" in text_content.lower():
            pricing_info["is_truly_free"] = True
            # Try to extract the hard limit number
            hard_limit_match = re.search(r'hard\s*limit[:\s]+(\d+[\d,]*)', text_content, re.IGNORECASE)
            if hard_limit_match and pricing_info["monthly_limit"] == "Unknown":
                pricing_info["monthly_limit"] = f"{hard_limit_match.group(1)} (Hard Limit)"
        
    except Exception as e:
        logger.warning(f"   ⚠️ Pricing extraction failed for {api_link}: {e}")
        pricing_info["monthly_limit"] = "Error"
        pricing_info["rate_limit"] = "Error"
    
    return pricing_info


async def extract_api_links_from_search(browser: BrowserModeScraper, search_term: str) -> List[str]:
    """
    Searches RapidAPI for a term and extracts all API links from the results.
    
    Returns:
        List of full API URLs
    """
    links = []
    
    try:
        # Construct search URL
        search_url = f"https://rapidapi.com/search/{search_term.replace(' ', '%20')}"
        logger.info(f"🔎 Searching: {search_url}")
        
        await browser.goto(search_url, wait_until="networkidle")
        await asyncio.sleep(3)  # Wait for React to render
        
        page = browser.page
        
        # Wait for API cards to load
        try:
            await page.wait_for_selector("a[href*='/api/']", timeout=10000)
        except Exception:
            logger.warning(f"   ⚠️ No API links found for '{search_term}'")
            return links
        
        # Extract all API links
        # RapidAPI structure: links like /oneapiproject/api/skip-tracing-working-api
        api_links = await browser.extract_all("a[href*='/api/']", "href")
        
        # Filter and normalize links
        for link in api_links:
            if link and "/api/" in link:
                # Handle relative URLs
                if link.startswith("/"):
                    full_link = f"https://rapidapi.com{link}"
                elif link.startswith("http"):
                    full_link = link
                else:
                    continue
                
                # Remove query params and fragments
                full_link = full_link.split("?")[0].split("#")[0]
                
                # Ensure it's a unique API link (not docs, pricing, etc.)
                if "/api/" in full_link and full_link not in links:
                    links.append(full_link)
        
        logger.info(f"   ✅ Found {len(links)} unique APIs for '{search_term}'")
        
    except Exception as e:
        logger.error(f"   ❌ Search failed for '{search_term}': {e}")
    
    return links


async def get_api_name(browser: BrowserModeScraper, api_link: str) -> str:
    """
    Extracts the API name from the API page.
    """
    try:
        await browser.goto(api_link, wait_until="networkidle")
        await asyncio.sleep(2)
        
        page = browser.page
        
        # Try multiple selectors for API name
        name_selectors = [
            "h1",
            "[data-testid='api-title']",
            ".api-title",
            "title"
        ]
        
        for selector in name_selectors:
            try:
                name = await browser.extract(selector, "text")
                if name:
                    # Clean up the name
                    name = name.strip()
                    # Remove common suffixes
                    name = re.sub(r'\s*API\s*$', '', name, flags=re.IGNORECASE)
                    name = re.sub(r'\s*on RapidAPI\s*$', '', name, flags=re.IGNORECASE)
                    if name and len(name) > 3:
                        return name
            except Exception:
                continue
        
        # Fallback: extract from URL
        url_parts = api_link.split("/")
        if len(url_parts) >= 2:
            api_slug = url_parts[-1]
            # Convert slug to readable name
            name = api_slug.replace("-", " ").replace("_", " ").title()
            return name
        
        return "Unknown"
        
    except Exception as e:
        logger.warning(f"   ⚠️ Failed to get API name: {e}")
        # Fallback to URL-based name
        url_parts = api_link.split("/")
        if len(url_parts) >= 2:
            return url_parts[-1].replace("-", " ").title()
        return "Unknown"


async def scout_rapidapi():
    """
    Main scout function that discovers all data enrichment APIs on RapidAPI.
    """
    logger.info("🕵️ Starting API Scout - Building Menu of Options")
    logger.info(f"📋 Target Categories: {len(SEARCH_TERMS)} search terms")
    
    discovered_apis = []
    processed_links = set()
    
    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    async with BrowserModeScraper(headless=True, stealth=True) as browser:
        
        # Step 1: Search for APIs in each category
        all_api_links = []
        
        for term in SEARCH_TERMS:
            logger.info(f"\n{'='*60}")
            logger.info(f"🔍 Category: {term}")
            logger.info(f"{'='*60}")
            
            links = await extract_api_links_from_search(browser, term)
            
            for link in links:
                if link not in processed_links:
                    all_api_links.append((link, term))
                    processed_links.add(link)
        
        logger.info(f"\n{'='*60}")
        logger.info(f"📊 Found {len(all_api_links)} unique APIs across all categories")
        logger.info(f"{'='*60}\n")
        
        # Step 2: Visit each API to extract details
        total = len(all_api_links)
        for idx, (api_link, category) in enumerate(all_api_links, 1):
            logger.info(f"\n[{idx}/{total}] Processing: {api_link}")
            
            try:
                # Get API name
                api_name = await get_api_name(browser, api_link)
                logger.info(f"   📛 Name: {api_name}")
                
                # Extract pricing details
                pricing = await extract_pricing_details(browser, api_link)
                
                api_record = {
                    "Category": category,
                    "Name": api_name,
                    "Link": api_link,
                    "Is_Free": "YES" if pricing["is_truly_free"] else "NO",
                    "Free_Requests": pricing["monthly_limit"],
                    "Rate_Limit": pricing["rate_limit"]
                }
                
                if pricing["is_truly_free"]:
                    logger.success(f"   ✅ FREE TIER: {pricing['monthly_limit']} | Rate: {pricing['rate_limit']}")
                else:
                    logger.info(f"   💰 Paid Only / No Free Tier")
                
                discovered_apis.append(api_record)
                
                # Human-like delay between API visits
                await asyncio.sleep(random.uniform(2, 4))
                
            except Exception as e:
                logger.error(f"   ❌ Failed to process {api_link}: {e}")
                # Still add a record with error info
                discovered_apis.append({
                    "Category": category,
                    "Name": "Error",
                    "Link": api_link,
                    "Is_Free": "ERROR",
                    "Free_Requests": "Error",
                    "Rate_Limit": "Error"
                })
    
    # Step 3: Save results
    logger.info(f"\n{'='*60}")
    logger.info("💾 Saving results...")
    
    # Save as CSV
    fieldnames = ["Category", "Name", "Link", "Is_Free", "Free_Requests", "Rate_Limit"]
    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(discovered_apis)
    
    # Save as JSON for easier programmatic access
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(discovered_apis, f, indent=2, ensure_ascii=False)
    
    # Summary statistics
    free_apis = [api for api in discovered_apis if api["Is_Free"] == "YES"]
    
    logger.success(f"\n{'='*60}")
    logger.success(f"🎉 Scout Report Complete!")
    logger.success(f"{'='*60}")
    logger.info(f"📁 CSV: {OUTPUT_CSV}")
    logger.info(f"📁 JSON: {OUTPUT_JSON}")
    logger.info(f"📊 Total APIs: {len(discovered_apis)}")
    logger.info(f"🆓 Free Tier APIs: {len(free_apis)}")
    logger.info(f"💰 Paid Only: {len(discovered_apis) - len(free_apis)}")
    logger.success(f"{'='*60}\n")


if __name__ == "__main__":
    asyncio.run(scout_rapidapi())
