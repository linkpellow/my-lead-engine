#!/usr/bin/env python3
"""
Database Initialization - Ensures leads table exists before workers start.

Called by start_redis_worker.py during system startup.
"""
import os
import psycopg2
from loguru import logger

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("APP_DATABASE_URL")


def init_db():
    """
    Initialize database schema.
    
    Creates the leads table if it doesn't exist.
    Safe to call multiple times (idempotent).
    """
    if not DATABASE_URL:
        logger.warning("DATABASE_URL not set, skipping database initialization")
        return False
    
    logger.info("Initializing database...")

    conn = None
    cur = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Create leads table (Golden Record: confidence_*, source_metadata)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS leads (
                id SERIAL PRIMARY KEY,
                linkedin_url VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                phone VARCHAR(20),
                email VARCHAR(255),
                city VARCHAR(100),
                state VARCHAR(50),
                zipcode VARCHAR(10),
                age INTEGER,
                income VARCHAR(50),
                dnc_status VARCHAR(20),
                can_contact BOOLEAN DEFAULT false,
                confidence_age NUMERIC(3,2),
                confidence_income NUMERIC(3,2),
                source_metadata JSONB,
                enriched_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        for col, typ in [("confidence_age", "NUMERIC(3,2)"), ("confidence_income", "NUMERIC(3,2)"), ("source_metadata", "JSONB")]:
            cur.execute(f"ALTER TABLE leads ADD COLUMN IF NOT EXISTS {col} {typ}")

        # Create index for faster lookups
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_leads_linkedin_url ON leads(linkedin_url)
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_leads_can_contact ON leads(can_contact)
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_leads_enriched_at ON leads(enriched_at)
        """)

        # site_blueprints: Dojo Golden Routes for Map-to-Engine (Redis + PG)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS site_blueprints (
                domain VARCHAR(255) PRIMARY KEY,
                blueprint JSONB NOT NULL DEFAULT '{}',
                source VARCHAR(64) DEFAULT 'dojo',
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        conn.commit()
        logger.success("Database initialized successfully")
        return True

    except Exception as e:
        if conn:
            conn.rollback()
        logger.exception("Database initialization failed: %s", e)
        return False
    finally:
        if cur:
            try:
                cur.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    init_db()
