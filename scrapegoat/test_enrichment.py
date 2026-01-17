#!/usr/bin/env python3
"""
Test Script for Scraper-Based Enrichment
Tests the full enrichment pipeline with real people search sites

Usage:
    python test_enrichment.py
    
    # With specific name
    python test_enrichment.py "John Smith" "Los Angeles" "CA"
"""
import sys
import os
import asyncio
import json
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Set up environment for local testing
os.environ.setdefault("PYTHONUNBUFFERED", "1")

from app.enrichment.scraper_enrichment import (
    scrape_enrich,
    enrich_with_scraper,
    load_blueprint,
    BLUEPRINT_DIR,
    SITE_PRIORITY,
)


def print_header(text: str):
    """Print a formatted header"""
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}\n")


def print_result(label: str, value: any):
    """Print a result line"""
    status = "✅" if value else "❌"
    print(f"  {status} {label}: {value or 'Not found'}")


async def test_blueprint_loading():
    """Test that blueprints can be loaded"""
    print_header("1. Testing Blueprint Loading")
    
    print(f"📁 Blueprint directory: {BLUEPRINT_DIR}")
    print(f"📋 Site priority: {SITE_PRIORITY}\n")
    
    loaded_count = 0
    for site in SITE_PRIORITY:
        blueprint = load_blueprint(site)
        if blueprint:
            print(f"  ✅ {site}: Loaded ({len(blueprint.get('extraction', {}))} extraction rules)")
            loaded_count += 1
        else:
            print(f"  ⚠️  {site}: No blueprint found")
    
    print(f"\n📊 Loaded {loaded_count}/{len(SITE_PRIORITY)} blueprints")
    return loaded_count > 0


async def test_enrichment(identity: dict):
    """Test the full enrichment flow"""
    print_header("2. Testing Enrichment Flow")
    
    print(f"🔍 Searching for: {identity.get('firstName')} {identity.get('lastName')}")
    print(f"📍 Location: {identity.get('city')}, {identity.get('state')}")
    print()
    
    # Test async enrichment
    print("🚀 Starting scraper enrichment...")
    result = await scrape_enrich(identity)
    
    print_header("3. Results")
    
    if result:
        print_result("Phone", result.get('phone'))
        print_result("Age", result.get('age'))
        print_result("Income", result.get('income'))
        print_result("Email", result.get('email'))
        print_result("Address", result.get('address'))
        
        print(f"\n📦 Full result: {json.dumps(result, indent=2)}")
    else:
        print("  ❌ No data extracted")
    
    return result


async def test_sync_wrapper(identity: dict):
    """Test the synchronous wrapper (used by workers)"""
    print_header("4. Testing Sync Wrapper")
    
    print("🔄 Testing enrich_with_scraper() sync wrapper...")
    
    # This runs in a new event loop internally
    result = enrich_with_scraper(identity)
    
    if result:
        print(f"  ✅ Sync wrapper returned: {list(result.keys())}")
    else:
        print("  ⚠️  Sync wrapper returned empty result")
    
    return result


async def main():
    """Main test runner"""
    print("\n" + "="*60)
    print("  SCRAPER ENRICHMENT TEST SUITE")
    print("="*60)
    
    # Parse command line arguments for custom test
    if len(sys.argv) >= 4:
        name_parts = sys.argv[1].split()
        first_name = name_parts[0]
        last_name = name_parts[-1] if len(name_parts) > 1 else ""
        city = sys.argv[2]
        state = sys.argv[3]
    else:
        # Default test identity
        first_name = "John"
        last_name = "Smith"
        city = "Miami"
        state = "FL"
    
    identity = {
        "firstName": first_name,
        "lastName": last_name,
        "city": city,
        "state": state,
        "zipcode": "",  # Optional
    }
    
    # Run tests
    try:
        # Test 1: Blueprint loading
        blueprints_ok = await test_blueprint_loading()
        
        if not blueprints_ok:
            print("\n⛔ No blueprints available. Cannot proceed with enrichment test.")
            print("   Run The Dojo to map people search sites first.")
            return
        
        # Test 2: Async enrichment
        result = await test_enrichment(identity)
        
        # Test 3: Sync wrapper (skip if async failed)
        # Note: This creates a new event loop, so we run it separately
        
        print_header("5. Summary")
        
        if result and result.get('phone'):
            print("  ✅ ENRICHMENT SUCCESSFUL")
            print(f"     Found phone: {result.get('phone')}")
        else:
            print("  ⚠️  ENRICHMENT INCOMPLETE")
            print("     No phone number found from any site")
            print("\n  Possible reasons:")
            print("     - Person not found in people search databases")
            print("     - Site blocking/CAPTCHA (check logs)")
            print("     - Blueprint CSS selectors need updating")
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
