"""
Spider Execution Worker
Listens to 'spider_jobs' queue and executes generated Spider classes.

This worker:
1. Polls the spider_jobs Redis queue
2. Dynamically imports the requested spider module
3. Executes the spider's extract() method
4. Updates stats in Redis
5. Optionally forwards results to enrichment pipeline
"""
import redis
import json
import os
import sys
import asyncio
import importlib.util
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List

from loguru import logger

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Configuration
REDIS_URL = os.getenv("REDIS_URL") or os.getenv("APP_REDIS_URL") or "redis://localhost:6379"
SPIDERS_DIR = PROJECT_ROOT / "app" / "scraping" / "spiders"
FORWARD_TO_ENRICHMENT = os.getenv("SPIDER_FORWARD_TO_ENRICHMENT", "false").lower() == "true"

# Queue names
SPIDER_JOBS_QUEUE = "spider_jobs"
LEADS_QUEUE = "leads_to_enrich"


def get_redis_client() -> redis.Redis:
    """Get Redis client connection"""
    return redis.from_url(REDIS_URL, decode_responses=True)


def update_spider_stats(
    redis_client: redis.Redis,
    spider_id: str,
    status: str,
    leads_count: int = 0,
    error: Optional[str] = None,
    duration: Optional[float] = None,
) -> None:
    """Update spider statistics in Redis"""
    stats_key = f"spider:stats:{spider_id}"
    history_key = f"spider:history:{spider_id}"
    
    now = datetime.now().isoformat()
    
    # Update current stats
    redis_client.hset(stats_key, mapping={
        "status": status,
        "lastRunAt": now,
        "lastError": error or "",
    })
    
    # Increment counters
    if status == "success":
        redis_client.hincrby(stats_key, "totalRuns", 1)
        redis_client.hincrby(stats_key, "successfulRuns", 1)
        redis_client.hincrby(stats_key, "totalLeads", leads_count)
    elif status == "error":
        redis_client.hincrby(stats_key, "totalRuns", 1)
        redis_client.hincrby(stats_key, "failedRuns", 1)
    
    # Add to history
    history_entry = {
        "runId": f"{spider_id}_{time.time()}",
        "startedAt": now,
        "completedAt": now,
        "status": status,
        "leadsFound": leads_count,
        "duration": duration or 0,
        "error": error,
    }
    redis_client.lpush(history_key, json.dumps(history_entry))
    redis_client.ltrim(history_key, 0, 99)  # Keep last 100 runs


def find_spider_class(module: Any) -> Optional[type]:
    """Find the Spider class in a module (inherits from BaseScraper)"""
    from app.scraping.base import BaseScraper
    
    for name, obj in module.__dict__.items():
        if (
            isinstance(obj, type) 
            and name.endswith("Spider") 
            and name != "BaseScraper"
            and issubclass(obj, BaseScraper)
        ):
            return obj
    
    # Fallback: find any class ending in Spider
    for name, obj in module.__dict__.items():
        if isinstance(obj, type) and name.endswith("Spider"):
            return obj
    
    return None


def load_spider_module(spider_id: str) -> Any:
    """Dynamically load a spider module from file"""
    spider_file = SPIDERS_DIR / f"{spider_id}.py"
    
    if not spider_file.exists():
        # Try with _spider suffix
        spider_file = SPIDERS_DIR / f"{spider_id}_spider.py"
    
    if not spider_file.exists():
        raise FileNotFoundError(f"Spider file not found: {spider_id}.py or {spider_id}_spider.py")
    
    # Load the module dynamically
    spec = importlib.util.spec_from_file_location(spider_id, spider_file)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load spec for {spider_file}")
    
    module = importlib.util.module_from_spec(spec)
    sys.modules[spider_id] = module
    spec.loader.exec_module(module)
    
    return module


async def execute_spider(
    spider_id: str,
    params: Dict[str, Any],
    redis_client: redis.Redis,
) -> List[Dict[str, Any]]:
    """Execute a spider and return results"""
    start_time = time.time()
    results = []
    
    try:
        # Update status to running
        update_spider_stats(redis_client, spider_id, "running")
        
        # Load the spider module
        logger.info(f"📦 Loading spider module: {spider_id}")
        module = load_spider_module(spider_id)
        
        # Find the Spider class
        SpiderClass = find_spider_class(module)
        if SpiderClass is None:
            raise ValueError(f"No Spider class found in {spider_id}.py")
        
        logger.info(f"🕷️ Launching Spider: {SpiderClass.__name__}")
        
        # Execute the spider
        async with SpiderClass() as spider:
            result = await spider.extract(**params)
            
            # Normalize results to list
            if result is None:
                results = []
            elif isinstance(result, list):
                results = result
            elif hasattr(result, 'model_dump'):  # Pydantic model
                results = [result.model_dump()]
            elif isinstance(result, dict):
                results = [result]
            else:
                results = [{"data": result}]
        
        duration = time.time() - start_time
        leads_count = len(results)
        
        logger.success(f"✅ Spider finished in {duration:.2f}s. Extracted {leads_count} items.")
        
        # Update stats
        update_spider_stats(
            redis_client, 
            spider_id, 
            "success", 
            leads_count=leads_count,
            duration=duration,
        )
        
        # Optionally forward results to enrichment pipeline
        if FORWARD_TO_ENRICHMENT and results:
            logger.info(f"📤 Forwarding {leads_count} items to enrichment queue")
            for item in results:
                redis_client.lpush(LEADS_QUEUE, json.dumps(item))
        
        return results
        
    except Exception as e:
        duration = time.time() - start_time
        error_msg = str(e)
        
        logger.error(f"🔥 Spider Execution Failed after {duration:.2f}s: {error_msg}")
        
        # Update stats with error
        update_spider_stats(
            redis_client,
            spider_id,
            "error",
            error=error_msg,
            duration=duration,
        )
        
        raise


def run_spider_job(job_data: Dict[str, Any], redis_client: redis.Redis) -> None:
    """Process a single spider job from the queue"""
    spider_id = job_data.get("spider_id")
    params = job_data.get("params", {})
    
    if not spider_id:
        logger.error("❌ Job missing spider_id")
        return
    
    logger.info(f"📥 Received job for spider: {spider_id}")
    logger.debug(f"   Params: {params}")
    
    try:
        # Run the spider in async context
        results = asyncio.run(execute_spider(spider_id, params, redis_client))
        logger.info(f"📊 Job complete. Results: {len(results)} items")
        
    except FileNotFoundError as e:
        logger.error(f"❌ {e}")
    except Exception as e:
        logger.error(f"❌ Job failed: {e}")


def start_worker() -> None:
    """Main worker loop - listens to spider_jobs queue"""
    logger.info("=" * 60)
    logger.info("🕷️ SPIDER EXECUTION WORKER")
    logger.info("=" * 60)
    logger.info(f"📍 Spiders directory: {SPIDERS_DIR}")
    logger.info(f"📡 Redis: {REDIS_URL[:30]}...")
    logger.info(f"📤 Forward to enrichment: {FORWARD_TO_ENRICHMENT}")
    logger.info(f"🎧 Listening on queue: {SPIDER_JOBS_QUEUE}")
    logger.info("=" * 60)
    
    redis_client = get_redis_client()
    
    # Test Redis connection
    try:
        redis_client.ping()
        logger.success("✅ Redis connected")
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
        sys.exit(1)
    
    # Ensure spiders directory exists
    SPIDERS_DIR.mkdir(parents=True, exist_ok=True)
    
    while True:
        try:
            # Blocking pop with 10s timeout
            result = redis_client.brpop(SPIDER_JOBS_QUEUE, timeout=10)
            
            if result is None:
                # Timeout, continue polling
                continue
            
            queue_name, job_json = result
            
            try:
                job_data = json.loads(job_json)
                run_spider_job(job_data, redis_client)
            except json.JSONDecodeError as e:
                logger.error(f"❌ Invalid JSON in job: {e}")
            except Exception as e:
                logger.error(f"❌ Job processing error: {e}")
                
        except redis.ConnectionError as e:
            logger.error(f"❌ Redis connection lost: {e}")
            logger.info("🔄 Reconnecting in 5s...")
            time.sleep(5)
            redis_client = get_redis_client()
        except KeyboardInterrupt:
            logger.info("👋 Shutting down Spider Worker...")
            break
        except Exception as e:
            logger.error(f"❌ Unexpected error: {e}")
            time.sleep(1)


if __name__ == "__main__":
    start_worker()
