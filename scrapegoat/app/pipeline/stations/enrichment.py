"""
Pipeline Station Implementations
Wraps existing enrichment logic into contract-based stations
"""
import asyncio
from typing import Dict, Any, Tuple
from loguru import logger

from app.pipeline.station import PipelineStation
from app.pipeline.types import PipelineContext, StopCondition

# Import existing enrichment functions
from app.enrichment.identity_resolution import resolve_identity
from app.enrichment.scraper_enrichment import enrich_with_scraper, scrape_enrich
from app.enrichment.skip_tracing import skip_trace
from app.enrichment.telnyx_gatekeep import validate_phone_telnyx
from app.enrichment.dnc_scrub import scrub_dnc
from app.enrichment.demographics import enrich_demographics
from app.enrichment.database import save_to_database


class IdentityStation(PipelineStation):
    """
    Station 1: Identity Resolution
    Resolves raw LinkedIn/Facebook data into structured identity
    """
    
    @property
    def name(self) -> str:
        return "Identity Resolution"
    
    @property
    def required_inputs(self) -> set:
        return {"name"}  # At minimum, we need a name
    
    @property
    def produces_outputs(self) -> set:
        return {"firstName", "lastName", "city", "state", "zipcode", "linkedinUrl", "company", "title"}
    
    @property
    def cost_estimate(self) -> float:
        return 0.0  # Free - just parsing
    
    async def process(self, ctx: PipelineContext) -> Tuple[Dict[str, Any], StopCondition]:
        """Resolve identity from raw lead data"""
        try:
            result = resolve_identity(ctx.data)
            
            # Validate required outputs
            if not result.get('firstName') or not result.get('lastName'):
                logger.warning("Identity resolution failed: missing firstName or lastName")
                return {}, StopCondition.FAIL
            
            logger.info(f"✅ Identity resolved: {result.get('firstName')} {result.get('lastName')}")
            return result, StopCondition.CONTINUE
            
        except Exception as e:
            logger.error(f"Identity resolution error: {e}")
            return {}, StopCondition.FAIL


class ScraperEnrichmentStation(PipelineStation):
    """
    Station 2a: Scraper-Based Enrichment (Preferred)
    Uses free scrapers to find phone, age, income
    """
    
    @property
    def name(self) -> str:
        return "Scraper Enrichment"
    
    @property
    def required_inputs(self) -> set:
        return {"firstName", "lastName", "city", "state"}
    
    @property
    def produces_outputs(self) -> set:
        return {"phone", "age", "income", "address", "email"}
    
    @property
    def cost_estimate(self) -> float:
        return 0.0  # Free scraping (uses proxies, but no API costs)
    
    async def process(self, ctx: PipelineContext) -> Tuple[Dict[str, Any], StopCondition]:
        """Enrich using scrapers (free alternative to skip-tracing)"""
        try:
            # Use async version directly
            result = await scrape_enrich(ctx.data)
            
            if result.get('phone'):
                logger.info(f"✅ Scraper found phone: {result.get('phone')}")
                return result, StopCondition.CONTINUE
            else:
                logger.info("⚠️  Scraper enrichment found no phone - will fallback to skip-tracing")
                return result, StopCondition.CONTINUE  # Continue to allow fallback
            
        except Exception as e:
            logger.error(f"Scraper enrichment error: {e}")
            return {}, StopCondition.CONTINUE  # Don't fail - allow skip-tracing fallback


class SkipTracingStation(PipelineStation):
    """
    Station 2b: Skip-Tracing API (Fallback)
    Uses paid APIs to find phone and email
    """
    
    @property
    def name(self) -> str:
        return "Skip-Tracing API"
    
    @property
    def required_inputs(self) -> set:
        return {"firstName", "lastName", "city", "state"}
    
    @property
    def produces_outputs(self) -> set:
        return {"phone", "email"}
    
    @property
    def cost_estimate(self) -> float:
        return 0.15  # Estimated cost per API call
    
    async def process(self, ctx: PipelineContext) -> Tuple[Dict[str, Any], StopCondition]:
        """Skip-trace using paid APIs (fallback if scraper fails)"""
        # Only run if phone not already found
        if ctx.data.get('phone'):
            logger.info("Phone already found, skipping skip-tracing")
            return {}, StopCondition.CONTINUE
        
        try:
            # Run sync function in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, skip_trace, ctx.data)
            
            if result.get('phone'):
                logger.info(f"✅ Skip-tracing found phone: {result.get('phone')}")
                return result, StopCondition.CONTINUE
            else:
                logger.warning("❌ Skip-tracing failed: No phone found")
                return {}, StopCondition.FAIL  # Fail if no phone found
            
        except Exception as e:
            logger.error(f"Skip-tracing error: {e}")
            return {}, StopCondition.FAIL


class TelnyxGatekeepStation(PipelineStation):
    """
    Station 3: Telnyx Gatekeep (Cost Saver)
    Validates phone and filters VOIP/Landline/junk carriers
    CRITICAL: Stops enrichment early to save API costs
    """
    
    @property
    def name(self) -> str:
        return "Telnyx Gatekeep"
    
    @property
    def required_inputs(self) -> set:
        return {"phone"}
    
    @property
    def produces_outputs(self) -> set:
        return {"is_valid", "is_mobile", "is_voip", "is_landline", "carrier", "is_junk"}
    
    @property
    def cost_estimate(self) -> float:
        return 0.01  # Telnyx API cost
    
    async def process(self, ctx: PipelineContext) -> Tuple[Dict[str, Any], StopCondition]:
        """Validate phone via Telnyx - STOP if invalid to save costs"""
        phone = ctx.data.get('phone')
        if not phone:
            return {}, StopCondition.FAIL
        
        try:
            # Run sync function in thread pool
            loop = asyncio.get_event_loop()
            validation = await loop.run_in_executor(None, validate_phone_telnyx, phone)
            
            # Check if we should reject
            is_junk = validation.get('is_junk', False)
            is_voip = validation.get('is_voip', False)
            is_landline = validation.get('is_landline', False)
            is_mobile = validation.get('is_mobile', False)
            
            # Reject if junk, VOIP, or landline (only mobile is acceptable)
            if is_junk or is_voip or (is_landline and not is_mobile):
                logger.warning(f"🚫 Phone rejected: {validation.get('carrier')} ({'VOIP' if is_voip else 'Landline' if is_landline else 'Junk'})")
                return validation, StopCondition.SKIP_REMAINING  # STOP HERE - save costs
            
            logger.info(f"✅ Phone validated: {validation.get('carrier')} (Mobile)")
            return validation, StopCondition.CONTINUE
            
        except Exception as e:
            logger.error(f"Telnyx validation error: {e}")
            # Fail open - continue if validation fails
            return {}, StopCondition.CONTINUE


class DNCGatekeeperStation(PipelineStation):
    """
    Station 4: DNC Scrubbing
    Checks phone against Do-Not-Call registry
    CRITICAL: Stops enrichment if on DNC list
    """
    
    @property
    def name(self) -> str:
        return "DNC Scrubbing"
    
    @property
    def required_inputs(self) -> set:
        return {"phone"}
    
    @property
    def produces_outputs(self) -> set:
        return {"dnc_status", "can_contact"}
    
    @property
    def cost_estimate(self) -> float:
        return 0.02  # USHA DNC API cost
    
    async def process(self, ctx: PipelineContext) -> Tuple[Dict[str, Any], StopCondition]:
        """Check DNC registry - STOP if on DNC list"""
        phone = ctx.data.get('phone')
        if not phone:
            return {}, StopCondition.FAIL
        
        try:
            # Run sync function in thread pool
            loop = asyncio.get_event_loop()
            dnc_result = await loop.run_in_executor(None, scrub_dnc, phone)
            
            can_contact = dnc_result.get('can_contact', True)
            
            if not can_contact:
                logger.warning(f"🚫 Lead on DNC list: {dnc_result.get('status')} - {dnc_result.get('reason')}")
                return dnc_result, StopCondition.SKIP_REMAINING  # STOP HERE - on DNC
            
            logger.info(f"✅ DNC status: {dnc_result.get('status')} - Safe to contact")
            return dnc_result, StopCondition.CONTINUE
            
        except Exception as e:
            logger.error(f"DNC scrub error: {e}")
            # Fail open - continue if DNC check fails
            return {"dnc_status": "UNKNOWN", "can_contact": True}, StopCondition.CONTINUE


class DemographicsStation(PipelineStation):
    """
    Station 5: Demographic Enrichment
    Pulls census data (income, age, address)
    """
    
    @property
    def name(self) -> str:
        return "Demographic Enrichment"
    
    @property
    def required_inputs(self) -> set:
        return {"zipcode"}  # Need zipcode for census data
    
    @property
    def produces_outputs(self) -> set:
        return {"income", "income_range", "age", "address"}
    
    @property
    def cost_estimate(self) -> float:
        return 0.01  # Census API cost (often free, but estimate conservatively)
    
    async def process(self, ctx: PipelineContext) -> Tuple[Dict[str, Any], StopCondition]:
        """Enrich with demographic data"""
        try:
            # Merge identity location into contact info for enrichment
            contact_info = {
                'zipcode': ctx.data.get('zipcode'),
                'city': ctx.data.get('city'),
                'state': ctx.data.get('state'),
                'age': ctx.data.get('age'),  # May already be from scraper
            }
            
            # Run sync function in thread pool
            loop = asyncio.get_event_loop()
            demographics = await loop.run_in_executor(None, enrich_demographics, contact_info)
            
            if demographics:
                logger.info(f"✅ Demographics enriched: Income={demographics.get('income')}, Age={demographics.get('age')}")
            
            return demographics, StopCondition.CONTINUE
            
        except Exception as e:
            logger.error(f"Demographic enrichment error: {e}")
            return {}, StopCondition.CONTINUE  # Non-critical, continue


class DatabaseSaveStation(PipelineStation):
    """
    Station 6: Database Save
    Saves enriched lead to PostgreSQL with deduplication
    """
    
    @property
    def name(self) -> str:
        return "Database Save"
    
    @property
    def required_inputs(self) -> set:
        return {"linkedinUrl"}  # Need at least LinkedIn URL for deduplication
    
    @property
    def produces_outputs(self) -> set:
        return {"saved", "lead_id"}  # Indicates successful save
    
    @property
    def cost_estimate(self) -> float:
        return 0.0  # Database write is free
    
    async def process(self, ctx: PipelineContext) -> Tuple[Dict[str, Any], StopCondition]:
        """Save enriched lead to database"""
        try:
            # Build enriched lead from context
            enriched_lead = ctx.data.copy()
            
            # Run sync function in thread pool
            loop = asyncio.get_event_loop()
            success = await loop.run_in_executor(None, save_to_database, enriched_lead)
            
            if success:
                logger.info(f"✅ Lead saved to database: {enriched_lead.get('name', 'Unknown')}")
                return {"saved": True}, StopCondition.CONTINUE
            else:
                logger.error("❌ Failed to save lead to database")
                return {"saved": False}, StopCondition.FAIL
            
        except Exception as e:
            logger.error(f"Database save error: {e}")
            return {"saved": False}, StopCondition.FAIL
