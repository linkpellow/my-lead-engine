"""
Chimera Core - Database Bridge

PostgreSQL persistence layer for mission results and worker performance.
Records 100% Human trust scores and selector repair history.

Uses connection pooling for high-concurrency worker swarm.
"""

import os
import logging
import psycopg2
import random
import hashlib
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, Optional
from datetime import datetime
import threading
from urllib.parse import quote_plus, urlparse
import secrets
import uuid

logger = logging.getLogger(__name__)

def _infer_log_role() -> str:
    explicit = os.getenv("CHIMERA_LOG_TAG")
    if explicit:
        tag = explicit.strip()
    else:
        tag = (os.getenv("RAILWAY_SERVICE_NAME") or "").strip().lower()
        if tag == "chimera-core" or "chimera-core" in tag:
            tag = "CHIMERA-BODY"
        elif "scrapegoat-worker-swarm" in tag or "worker-swarm" in tag:
            tag = "CHIMERA-SWARM"
        else:
            tag = "CHIMERA"
    return "BODY" if str(tag).endswith("BODY") else ("SWARM" if str(tag).endswith("SWARM") else str(tag))

def _clean_env_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    # Guard against literal placeholder strings being injected into env.
    if v in {"${DATABASE_URL}", "${APP_DATABASE_URL}", "$DATABASE_URL", "$APP_DATABASE_URL"}:
        return None
    return v


def _resolve_database_url() -> Optional[str]:
    """
    Resolve the PostgreSQL connection string in Railway environments.

    Primary keys:
      - DATABASE_URL
      - APP_DATABASE_URL

    Fallbacks (Railway/plugin variance):
      - PGURL / PG_URL / POSTGRES_URL / POSTGRESQL_URL
      - PG* components (PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD)
    """
    # Primary (per spec)
    for key in ("DATABASE_URL", "APP_DATABASE_URL"):
        v = _clean_env_value(os.getenv(key))
        if v:
            logger.info(f"🗄️ DB bridge: using {key}")
            return v

    # Common alternates
    for key in ("PGURL", "PG_URL", "POSTGRES_URL", "POSTGRESQL_URL"):
        v = _clean_env_value(os.getenv(key))
        if v:
            logger.info(f"🗄️ DB bridge: using {key}")
            return v

    # Component-based DSN
    host = _clean_env_value(os.getenv("PGHOST"))
    port = _clean_env_value(os.getenv("PGPORT")) or "5432"
    db = _clean_env_value(os.getenv("PGDATABASE"))
    user = _clean_env_value(os.getenv("PGUSER"))
    password = _clean_env_value(os.getenv("PGPASSWORD"))

    if host and db and user and password:
        safe_user = quote_plus(user)
        safe_password = quote_plus(password)
        dsn = f"postgresql://{safe_user}:{safe_password}@{host}:{port}/{db}"
        logger.info("🗄️ DB bridge: using PG* components (PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD)")
        return dsn

    logger.critical("❌ NO DATABASE_URL OR APP_DATABASE_URL FOUND")
    return None


DATABASE_URL = _resolve_database_url()

# Connection pool for high-concurrency worker swarm
_connection_pool: Optional[pool.ThreadedConnectionPool] = None
_pool_lock = threading.Lock()


def get_connection_pool():
    """
    Get or create PostgreSQL connection pool.
    
    Returns:
        ThreadedConnectionPool or None if DATABASE_URL not set
    """
    global _connection_pool
    
    if not DATABASE_URL:
        return None
    
    if _connection_pool is None:
        with _pool_lock:
            if _connection_pool is None:
                try:
                    # Connection pool: min 1, max 10 connections
                    # Supports high-concurrency worker swarm.
                    #
                    # IMPORTANT: Always set a connect timeout so Railway healthchecks
                    # don't time out if Postgres/DNS is temporarily unavailable.
                    connect_timeout = int(os.getenv("DB_CONNECT_TIMEOUT", "5"))
                    _connection_pool = pool.ThreadedConnectionPool(
                        minconn=1,
                        maxconn=int(os.getenv("DB_POOL_MAX", "10")),
                        dsn=DATABASE_URL,
                        connect_timeout=connect_timeout,
                        application_name="chimera-core",
                        keepalives=1,
                        keepalives_idle=30,
                        keepalives_interval=10,
                        keepalives_count=5,
                    )
                    logger.debug(
                        "✅ PostgreSQL connection pool created (1-10 connections, "
                        f"connect_timeout={connect_timeout}s)"
                    )
                except Exception as e:
                    logger.error(f"❌ Failed to create connection pool: {e}")
                    return None
    
    return _connection_pool


def get_db_connection():
    """
    Get PostgreSQL connection from pool.
    
    Returns:
        psycopg2 connection object or None if pool unavailable
    """
    pool = get_connection_pool()
    if not pool:
        return None
    
    try:
        conn = pool.getconn()
        return conn
    except Exception as e:
        logger.error(f"❌ Failed to get connection from pool: {e}")
        return None


def return_db_connection(conn):
    """
    Return connection to pool.
    
    Args:
        conn: Connection to return
    """
    pool = get_connection_pool()
    if pool and conn:
        try:
            pool.putconn(conn)
        except Exception as e:
            logger.error(f"❌ Failed to return connection to pool: {e}")
            try:
                conn.close()
            except:
                pass


def ensure_mission_results_table(conn):
    """
    Ensure mission_results table exists.
    
    Creates table if it doesn't exist (idempotent).
    
    Args:
        conn: PostgreSQL connection
    """
    try:
        cur = conn.cursor()
        
        # Create mission_results table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS mission_results (
                id SERIAL PRIMARY KEY,
                worker_id VARCHAR(100) NOT NULL,
                trust_score FLOAT NOT NULL,
                is_human BOOLEAN NOT NULL,
                validation_method VARCHAR(50) DEFAULT 'creepjs',
                fingerprint_details JSONB,
                mission_type VARCHAR(100),
                mission_status VARCHAR(50) DEFAULT 'completed',
                error_message TEXT,
                trace_url TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                completed_at TIMESTAMP
            )
        """)
        
        # Create indexes for faster lookups
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_mission_results_worker_id 
            ON mission_results(worker_id)
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_mission_results_trust_score 
            ON mission_results(trust_score)
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_mission_results_is_human 
            ON mission_results(is_human)
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_mission_results_created_at 
            ON mission_results(created_at)
        """)
        
        conn.commit()
        cur.close()
        logger.debug("✅ mission_results table verified")
        
    except Exception as e:
        logger.error(f"❌ Failed to create mission_results table: {e}")
        conn.rollback()


def log_selector_repair(
    worker_id: str,
    original_selector: str,
    new_selector: str,
    method: str = "isomorphic",
    confidence: float = 0.85,
    intent: Optional[str] = None
) -> bool:
    """
    Log selector repair to PostgreSQL.
    
    Records self-healing selector repairs for future reference.
    
    Args:
        worker_id: Worker identifier
        original_selector: The selector that failed
        new_selector: The repaired selector
        method: Repair method (e.g., "isomorphic", "id-fallback")
        confidence: Confidence score (0.0-1.0)
        intent: Intent description (e.g., "click login button")
    
    Returns:
        True if logged successfully, False otherwise
    """
    if not DATABASE_URL:
        logger.debug("⚠️ DATABASE_URL not set - skipping selector repair log")
        return False
    
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        ensure_selector_repairs_table(conn)
        
        cur = conn.cursor()
        
        # Insert selector repair
        cur.execute("""
            INSERT INTO selector_repairs (
                worker_id,
                original_selector,
                new_selector,
                repair_method,
                confidence,
                intent,
                created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (
            worker_id,
            original_selector,
            new_selector,
            method,
            confidence,
            intent
        ))
        
        conn.commit()
        cur.close()
        return_db_connection(conn)
        
        logger.info(f"✅ Selector self-healed and updated in Postgres")
        logger.debug(f"   Original: {original_selector}")
        logger.debug(f"   New: {new_selector} (method: {method}, confidence: {confidence})")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to log selector repair: {e}")
        if conn:
            try:
                conn.rollback()
            except:
                pass
            return_db_connection(conn)
        return False


def get_global_heuristic(selector_id: str) -> Optional[Dict[str, Any]]:
    """
    Phase 8: Global heuristic bridge.

    Look up the latest known-good selector repair for a given selector_id.
    In this codebase, selector_id maps to the original selector string.
    """
    if not selector_id:
        return None
    if not DATABASE_URL:
        return None

    conn = get_db_connection()
    if not conn:
        return None

    try:
        ensure_selector_repairs_table(conn)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            SELECT
              original_selector,
              new_selector,
              repair_method,
              confidence,
              intent,
              created_at
            FROM selector_repairs
            WHERE original_selector = %s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (selector_id,),
        )
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)

        if not row:
            return None

        # Normalize keys for caller
        return {
            "original_selector": row.get("original_selector"),
            "new_selector": row.get("new_selector"),
            "method": row.get("repair_method"),
            "confidence": row.get("confidence"),
            "intent": row.get("intent"),
            "created_at": row.get("created_at"),
        }
    except Exception as e:
        logger.debug(f"⚠️ Global heuristic lookup failed: {e}")
        try:
            conn.rollback()
        except Exception:
            pass
        return_db_connection(conn)
        return None


def ensure_selector_repairs_table(conn):
    """
    Ensure selector_repairs table exists.
    
    Args:
        conn: PostgreSQL connection
    """
    try:
        cur = conn.cursor()
        
        # Create selector_repairs table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS selector_repairs (
                id SERIAL PRIMARY KEY,
                worker_id VARCHAR(100) NOT NULL,
                original_selector TEXT NOT NULL,
                new_selector TEXT NOT NULL,
                repair_method VARCHAR(50) DEFAULT 'isomorphic',
                confidence FLOAT DEFAULT 0.85,
                intent VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        
        # Create indexes
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_selector_repairs_worker_id 
            ON selector_repairs(worker_id)
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_selector_repairs_created_at 
            ON selector_repairs(created_at)
        """)
        
        conn.commit()
        cur.close()
        logger.debug("✅ selector_repairs table verified")
        
    except Exception as e:
        logger.error(f"❌ Failed to create selector_repairs table: {e}")
        conn.rollback()


def ensure_site_cognitive_maps_table(conn) -> None:
    """
    Phase 9: Ensure site_cognitive_maps table exists.

    Stores per-site cognitive maps (element locations + structure hash).
    """
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS site_cognitive_maps (
                id SERIAL PRIMARY KEY,
                url TEXT UNIQUE NOT NULL,
                structure_hash VARCHAR(128),
                map_data JSONB,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_site_cognitive_maps_url
            ON site_cognitive_maps(url)
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_site_cognitive_maps_updated_at
            ON site_cognitive_maps(updated_at)
        """)
        conn.commit()
        cur.close()
        logger.debug("✅ site_cognitive_maps table verified")
    except Exception as e:
        logger.error(f"❌ Failed to create site_cognitive_maps table: {e}")
        conn.rollback()


def map_expiration_logic(updated_at: Optional[datetime], days: int = 7) -> bool:
    """
    Phase 9: Determine whether a cognitive map is stale.
    """
    if not updated_at:
        return True
    age = datetime.utcnow() - updated_at.replace(tzinfo=None)
    return age.days >= int(days)


def get_latency_buffer(target_url: str) -> float:
    """
    Vanguard v2.0: Compute RTT buffer based on hardware location affinity.
    Returns latency in seconds.
    """
    hardware_id = (
        os.getenv("CHIMERA_HARDWARE_ID")
        or os.getenv("CHIMERA_WORKER_ID")
        or os.getenv("WORKER_ID")
        or os.getenv("RAILWAY_SERVICE_NAME")
        or "chimera-core"
    )
    try:
        host = urlparse(target_url or "").hostname or ""
    except Exception:
        host = ""

    regions = [
        ("us-east", 38),
        ("us-west", 52),
        ("eu-west", 68),
        ("ap-south", 92),
        ("ap-northeast", 104),
        ("sa-east", 118),
    ]
    seed = hashlib.sha256(f"{hardware_id}:{host}".encode("utf-8")).hexdigest()
    idx = int(seed[:2], 16) % len(regions)
    region, base_ms = regions[idx]
    domain_bump = min(18, max(0, len(host) - 8))
    jitter = random.uniform(-6.0, 8.0)
    latency_ms = max(12.0, float(base_ms + domain_bump + jitter))
    logger.info(f"Latency buffer applied: {int(latency_ms)}ms ({region})")
    return latency_ms / 1000.0


def get_site_map(url: str) -> Optional[Dict[str, Any]]:
    """
    Phase 9: Fetch cognitive map for a site URL.
    """
    if not url or not DATABASE_URL:
        return None

    conn = get_db_connection()
    if not conn:
        return None

    try:
        ensure_site_cognitive_maps_table(conn)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            """
            SELECT url, structure_hash, map_data, updated_at
            FROM site_cognitive_maps
            WHERE url = %s
            LIMIT 1
            """,
            (url,),
        )
        row = cur.fetchone()
        cur.close()
        return_db_connection(conn)
        if not row:
            return None
        stale = map_expiration_logic(row.get("updated_at"))
        return {
            "url": row.get("url"),
            "structure_hash": row.get("structure_hash"),
            "map_data": row.get("map_data"),
            "updated_at": row.get("updated_at"),
            "stale": stale,
        }
    except Exception as e:
        logger.debug(f"⚠️ Cognitive map lookup failed: {e}")
        try:
            conn.rollback()
        except Exception:
            pass
        return_db_connection(conn)
        return None


def update_site_map(url: str, data: Dict[str, Any]) -> bool:
    """
    Phase 9: Upsert cognitive map for a site URL.
    """
    if not url or not DATABASE_URL:
        return False

    conn = get_db_connection()
    if not conn:
        return False

    try:
        ensure_site_cognitive_maps_table(conn)
        cur = conn.cursor()
        structure_hash = data.get("structure_hash")
        map_data = data.get("map_data", data)
        cur.execute(
            """
            INSERT INTO site_cognitive_maps (url, structure_hash, map_data, created_at, updated_at)
            VALUES (%s, %s, %s, NOW(), NOW())
            ON CONFLICT (url) DO UPDATE SET
              structure_hash = EXCLUDED.structure_hash,
              map_data = EXCLUDED.map_data,
              updated_at = NOW()
            """,
            (url, structure_hash, psycopg2.extras.Json(map_data) if map_data is not None else None),
        )
        conn.commit()
        cur.close()
        return_db_connection(conn)
        return True
    except Exception as e:
        logger.error(f"❌ Failed to update cognitive map: {e}")
        try:
            conn.rollback()
        except Exception:
            pass
        return_db_connection(conn)
        return False


def ensure_hardware_entropy_table(conn) -> None:
    """
    Phase 6: Ensure hardware_entropy table exists.

    Stores per-mission entropy seeds for GPU/Audio/Canvas so each mission can
    present a unique, stable hardware signature.
    """
    try:
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS hardware_entropy (
                id SERIAL PRIMARY KEY,
                worker_id VARCHAR(100) NOT NULL,
                mission_id VARCHAR(255) NOT NULL,
                gpu_seed BIGINT NOT NULL,
                audio_seed BIGINT NOT NULL,
                canvas_seed BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_hardware_entropy_worker_id
            ON hardware_entropy(worker_id)
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_hardware_entropy_mission_id
            ON hardware_entropy(mission_id)
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_hardware_entropy_created_at
            ON hardware_entropy(created_at)
        """)

        conn.commit()
        cur.close()
        logger.debug("✅ hardware_entropy table verified")
    except Exception as e:
        logger.error(f"❌ Failed to create hardware_entropy table: {e}")
        conn.rollback()


def allocate_hardware_entropy(worker_id: str, mission_id: Optional[str] = None) -> Optional[Dict[str, int]]:
    """
    Phase 6: Allocate per-mission hardware seeds (GPU/Audio/Canvas) and persist them.

    Returns:
      {
        "gpu_seed": int,
        "audio_seed": int,
        "canvas_seed": int,
      }
    """
    if not DATABASE_URL:
        logger.critical("❌ NO DATABASE_URL OR APP_DATABASE_URL FOUND")
        return None

    mission_id = mission_id or f"mission-{uuid.uuid4()}"

    # Use 31-bit seeds to stay within JS bitwise ops cleanly.
    gpu_seed = secrets.randbelow(2**31 - 1) + 1
    audio_seed = secrets.randbelow(2**31 - 1) + 1
    canvas_seed = secrets.randbelow(2**31 - 1) + 1

    conn = get_db_connection()
    if not conn:
        return None

    try:
        ensure_hardware_entropy_table(conn)
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO hardware_entropy (worker_id, mission_id, gpu_seed, audio_seed, canvas_seed)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (worker_id, mission_id, gpu_seed, audio_seed, canvas_seed),
        )
        conn.commit()
        cur.close()
        return_db_connection(conn)

        logger.info(f"🧬 Hardware entropy allocated for mission: {mission_id}")
        return {"gpu_seed": gpu_seed, "audio_seed": audio_seed, "canvas_seed": canvas_seed}
    except Exception as e:
        logger.error(f"❌ Failed to allocate hardware entropy: {e}")
        try:
            conn.rollback()
        except Exception:
            pass
        return_db_connection(conn)
        return None


def record_stealth_check(
    worker_id: str,
    score: float,
    fingerprint: Optional[Dict[str, Any]] = None,
    trace_url: Optional[str] = None
) -> bool:
    """
    Record stealth check result (100% human gate).
    
    Convenience function for logging CreepJS validation results.
    
    Args:
        worker_id: Worker identifier (e.g., "worker-0")
        score: Trust score (0.0-100.0)
        fingerprint: Optional fingerprint details dict
        trace_url: Optional trace file URL
    
    Returns:
        True if logged successfully, False otherwise
    """
    return log_mission_result(
        worker_id=worker_id,
        trust_score=score,
        is_human=(score >= 100.0),
        validation_method="creepjs",
        fingerprint_details=fingerprint,
        mission_type="stealth_validation",
        mission_status="completed" if score >= 100.0 else "failed",
        trace_url=trace_url
    )


def log_mission_result(
    worker_id: str,
    trust_score: float,
    is_human: bool,
    validation_method: str = "creepjs",
    fingerprint_details: Optional[Dict[str, Any]] = None,
    mission_type: Optional[str] = None,
    mission_status: str = "completed",
    error_message: Optional[str] = None,
    trace_url: Optional[str] = None
) -> bool:
    """
    Log mission result to PostgreSQL.
    
    Records 100% Human trust scores and validation outcomes.
    
    Args:
        worker_id: Worker identifier (e.g., "worker-0")
        trust_score: CreepJS trust score (0.0-100.0)
        is_human: Whether score indicates human (>= 100.0)
        validation_method: Validation method used (default: "creepjs")
        fingerprint_details: Optional fingerprint details dict
        mission_type: Optional mission type identifier
        mission_status: Mission status (default: "completed")
        error_message: Optional error message if validation failed
    
    Returns:
        True if logged successfully, False otherwise
    """
    if not DATABASE_URL:
        logger.debug("⚠️ DATABASE_URL not set - skipping mission result log")
        return False
    
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        ensure_mission_results_table(conn)
        
        cur = conn.cursor()
        
        # Insert mission result
        cur.execute("""
            INSERT INTO mission_results (
                worker_id,
                trust_score,
                is_human,
                validation_method,
                fingerprint_details,
                mission_type,
                mission_status,
                error_message,
                trace_url,
                completed_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        """, (
            worker_id,
            trust_score,
            is_human,
            validation_method,
            psycopg2.extras.Json(fingerprint_details) if fingerprint_details else None,
            mission_type,
            mission_status,
            error_message,
            trace_url
        ))
        
        conn.commit()
        cur.close()
        return_db_connection(conn)  # Return to pool instead of closing
        
        if is_human and trust_score >= 100.0:
            logger.info(f"✅ Mission result logged: {worker_id} - {trust_score}% HUMAN")
        else:
            logger.warning(f"⚠️ Mission result logged: {worker_id} - {trust_score}% (NOT HUMAN)")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to log mission result: {e}")
        if conn:
            try:
                conn.rollback()
            except:
                pass
            return_db_connection(conn)  # Return to pool even on error
        return False


def test_db_connection() -> bool:
    """
    Test PostgreSQL connection on boot.
    
    Returns:
        True if connection successful, False otherwise
    """
    if not DATABASE_URL:
        logger.warning("⚠️ DATABASE_URL not set - PostgreSQL persistence disabled")
        return False
    
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        cur.close()
        return_db_connection(conn)  # Return to pool instead of closing
        
        role = _infer_log_role()
        logger.info(f"✅ [{role}] Connected to PostgreSQL Persistence Layer")
        logger.debug(f"   PostgreSQL version: {version.split(',')[0]}")
        logger.debug(f"   Connection pool: 2-10 connections (high-concurrency ready)")
        return True
        
    except Exception as e:
        logger.error(f"❌ PostgreSQL connection test failed: {e}")
        if conn:
            return_db_connection(conn)  # Return to pool even on error
        return False
