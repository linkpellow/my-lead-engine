"""
Redis Cookie Store - Centralized session/cookie storage.

Stores authentication cookies in Redis so all workers can access them.
The Auth Worker writes fresh cookies, Spiders read them automatically.

Cookie Keys:
    - linkedin:cookies      → LinkedIn session (li_at, JSESSIONID, etc.)
    - facebook:cookies      → Facebook session (c_user, xs, etc.)
    - salesnavigator:cookies → LinkedIn Sales Navigator
    - ushadvisors:cookies   → USHA DNC portal tokens

TTL: 24 hours (cookies refreshed every 6 hours by Auth Worker)

Usage:
    # Get cookies for a platform
    cookies = await cookie_store.get_cookies("linkedin")
    
    # Set cookies (usually done by Auth Worker)
    await cookie_store.set_cookies("linkedin", cookie_list)
    
    # Get specific cookie value
    li_at = await cookie_store.get_cookie_value("linkedin", "li_at")
"""

import os
import json
import time
from typing import Any, Dict, List, Optional
from datetime import datetime

from loguru import logger

# Redis client
try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    try:
        import aioredis
        REDIS_AVAILABLE = True
    except ImportError:
        REDIS_AVAILABLE = False
        logger.warning("⚠️ Redis not available for cookie storage")


# Cookie TTL: 24 hours (refreshed every 6 hours)
COOKIE_TTL = 24 * 60 * 60  # seconds

# Redis key prefix
COOKIE_PREFIX = "auth:cookies:"
META_PREFIX = "auth:meta:"


class CookieStore:
    """
    Redis-backed cookie storage for authenticated sessions.
    
    Features:
    - 🍪 Store/retrieve platform-specific cookies
    - 📊 Track cookie freshness (last refresh time)
    - ⏰ Automatic TTL management
    - 🔄 Async-first design for workers
    """
    
    def __init__(self, redis_url: Optional[str] = None):
        """
        Initialize cookie store.
        
        Args:
            redis_url: Redis connection URL (defaults to REDIS_URL env var)
        """
        self.redis_url = redis_url or os.getenv("REDIS_URL") or os.getenv("APP_REDIS_URL")
        self._client: Optional[Any] = None
        self.logger = logger.bind(component="cookie_store")
    
    async def _get_client(self):
        """Get or create Redis client"""
        if not REDIS_AVAILABLE:
            raise RuntimeError("Redis not available. Install: pip install redis")
        
        if self._client is None:
            if not self.redis_url:
                raise RuntimeError("REDIS_URL not configured")
            
            self._client = aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
        
        return self._client
    
    async def close(self) -> None:
        """Close Redis connection"""
        if self._client:
            await self._client.close()
            self._client = None
    
    def _cookie_key(self, platform: str) -> str:
        """Get Redis key for platform cookies"""
        return f"{COOKIE_PREFIX}{platform.lower()}"
    
    def _meta_key(self, platform: str) -> str:
        """Get Redis key for platform metadata"""
        return f"{META_PREFIX}{platform.lower()}"
    
    async def set_cookies(
        self,
        platform: str,
        cookies: List[Dict[str, Any]],
        ttl: int = COOKIE_TTL,
    ) -> bool:
        """
        Store cookies for a platform.
        
        Args:
            platform: Platform name (linkedin, facebook, etc.)
            cookies: List of cookie dicts (Playwright format)
            ttl: Time-to-live in seconds
            
        Returns:
            True if stored successfully
        """
        try:
            client = await self._get_client()
            
            # Store cookies as JSON
            cookie_key = self._cookie_key(platform)
            await client.setex(
                cookie_key,
                ttl,
                json.dumps(cookies)
            )
            
            # Store metadata
            meta = {
                "refreshed_at": datetime.utcnow().isoformat(),
                "cookie_count": len(cookies),
                "ttl": ttl,
            }
            await client.setex(
                self._meta_key(platform),
                ttl,
                json.dumps(meta)
            )
            
            self.logger.info(f"🍪 Stored {len(cookies)} cookies for {platform}")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Failed to store cookies for {platform}: {e}")
            return False
    
    async def get_cookies(self, platform: str) -> Optional[List[Dict[str, Any]]]:
        """
        Retrieve cookies for a platform.
        
        Args:
            platform: Platform name (linkedin, facebook, etc.)
            
        Returns:
            List of cookie dicts, or None if not found/expired
        """
        try:
            client = await self._get_client()
            cookie_key = self._cookie_key(platform)
            
            cookie_json = await client.get(cookie_key)
            if not cookie_json:
                self.logger.warning(f"⚠️ No cookies found for {platform}")
                return None
            
            cookies = json.loads(cookie_json)
            self.logger.debug(f"🍪 Retrieved {len(cookies)} cookies for {platform}")
            return cookies
            
        except Exception as e:
            self.logger.error(f"❌ Failed to retrieve cookies for {platform}: {e}")
            return None
    
    async def get_cookie_value(
        self,
        platform: str,
        cookie_name: str,
    ) -> Optional[str]:
        """
        Get specific cookie value by name.
        
        Args:
            platform: Platform name
            cookie_name: Cookie name (e.g., "li_at" for LinkedIn)
            
        Returns:
            Cookie value string, or None
        """
        cookies = await self.get_cookies(platform)
        if not cookies:
            return None
        
        for cookie in cookies:
            if cookie.get("name") == cookie_name:
                return cookie.get("value")
        
        return None
    
    async def get_cookie_header(self, platform: str) -> Optional[str]:
        """
        Get cookies formatted as HTTP Cookie header.
        
        Args:
            platform: Platform name
            
        Returns:
            Cookie header string (e.g., "li_at=xxx; JSESSIONID=yyy")
        """
        cookies = await self.get_cookies(platform)
        if not cookies:
            return None
        
        parts = []
        for cookie in cookies:
            name = cookie.get("name")
            value = cookie.get("value")
            if name and value:
                parts.append(f"{name}={value}")
        
        return "; ".join(parts) if parts else None
    
    async def get_metadata(self, platform: str) -> Optional[Dict[str, Any]]:
        """
        Get cookie metadata (last refresh time, count, etc.)
        
        Args:
            platform: Platform name
            
        Returns:
            Metadata dict or None
        """
        try:
            client = await self._get_client()
            meta_json = await client.get(self._meta_key(platform))
            
            if not meta_json:
                return None
            
            return json.loads(meta_json)
            
        except Exception as e:
            self.logger.error(f"❌ Failed to get metadata for {platform}: {e}")
            return None
    
    async def is_fresh(self, platform: str, max_age_hours: float = 6.0) -> bool:
        """
        Check if cookies are fresh (recently refreshed).
        
        Args:
            platform: Platform name
            max_age_hours: Maximum age in hours to consider fresh
            
        Returns:
            True if cookies exist and are fresh
        """
        meta = await self.get_metadata(platform)
        if not meta:
            return False
        
        refreshed_at = meta.get("refreshed_at")
        if not refreshed_at:
            return False
        
        try:
            refresh_time = datetime.fromisoformat(refreshed_at)
            age_seconds = (datetime.utcnow() - refresh_time).total_seconds()
            age_hours = age_seconds / 3600
            
            return age_hours < max_age_hours
            
        except Exception:
            return False
    
    async def delete_cookies(self, platform: str) -> bool:
        """
        Delete cookies for a platform.
        
        Args:
            platform: Platform name
            
        Returns:
            True if deleted
        """
        try:
            client = await self._get_client()
            await client.delete(self._cookie_key(platform))
            await client.delete(self._meta_key(platform))
            
            self.logger.info(f"🗑️ Deleted cookies for {platform}")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Failed to delete cookies for {platform}: {e}")
            return False
    
    async def list_platforms(self) -> List[str]:
        """
        List all platforms with stored cookies.
        
        Returns:
            List of platform names
        """
        try:
            client = await self._get_client()
            keys = await client.keys(f"{COOKIE_PREFIX}*")
            
            platforms = []
            for key in keys:
                platform = key.replace(COOKIE_PREFIX, "")
                platforms.append(platform)
            
            return platforms
            
        except Exception as e:
            self.logger.error(f"❌ Failed to list platforms: {e}")
            return []
    
    async def get_all_status(self) -> Dict[str, Dict[str, Any]]:
        """
        Get status of all stored cookies.
        
        Returns:
            Dict mapping platform to status info
        """
        platforms = await self.list_platforms()
        status = {}
        
        for platform in platforms:
            meta = await self.get_metadata(platform)
            is_fresh = await self.is_fresh(platform)
            
            status[platform] = {
                "has_cookies": True,
                "is_fresh": is_fresh,
                "metadata": meta,
            }
        
        return status


# Singleton instance
_cookie_store: Optional[CookieStore] = None


def get_cookie_store() -> CookieStore:
    """Get singleton cookie store instance"""
    global _cookie_store
    if _cookie_store is None:
        _cookie_store = CookieStore()
    return _cookie_store


# Convenience functions for common operations
async def get_linkedin_cookies() -> Optional[List[Dict[str, Any]]]:
    """Get LinkedIn session cookies"""
    return await get_cookie_store().get_cookies("linkedin")


async def get_linkedin_cookie_header() -> Optional[str]:
    """Get LinkedIn cookies as HTTP header"""
    return await get_cookie_store().get_cookie_header("linkedin")


async def get_facebook_cookies() -> Optional[List[Dict[str, Any]]]:
    """Get Facebook session cookies"""
    return await get_cookie_store().get_cookies("facebook")


async def get_salesnavigator_cookies() -> Optional[List[Dict[str, Any]]]:
    """Get LinkedIn Sales Navigator cookies"""
    return await get_cookie_store().get_cookies("salesnavigator")
