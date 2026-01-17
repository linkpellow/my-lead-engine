"""
Database Module
Saves enriched leads to PostgreSQL with deduplication
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("APP_DATABASE_URL")

def save_to_database(enriched_lead: Dict[str, Any]) -> bool:
    """
    Save enriched lead to PostgreSQL with deduplication
    
    Args:
        enriched_lead: Complete enriched lead data
        
    Returns:
        True if saved successfully, False otherwise
    """
    if not DATABASE_URL:
        print("❌ DATABASE_URL not set, cannot save to database")
        return False
    
    try:
        # psycopg2.connect accepts postgresql:// URLs directly
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Ensure table exists
        ensure_table_exists(cur)
        
        # Extract values
        linkedin_url = enriched_lead.get('linkedinUrl') or enriched_lead.get('linkedin_url')
        name = enriched_lead.get('name') or f"{enriched_lead.get('firstName', '')} {enriched_lead.get('lastName', '')}".strip()
        phone = enriched_lead.get('phone')
        email = enriched_lead.get('email')
        city = enriched_lead.get('city')
        state = enriched_lead.get('state')
        zipcode = enriched_lead.get('zipcode')
        age = enriched_lead.get('age')
        income = enriched_lead.get('income') or enriched_lead.get('median_income')
        dnc_status = enriched_lead.get('dnc_status') or enriched_lead.get('status', 'UNKNOWN')
        can_contact = enriched_lead.get('can_contact', False)
        
        # Insert or update with deduplication
        cur.execute("""
            INSERT INTO leads (
                linkedin_url, name, phone, email,
                city, state, zipcode, age, income,
                dnc_status, can_contact, enriched_at, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), COALESCE((SELECT created_at FROM leads WHERE linkedin_url = %s), NOW()))
            ON CONFLICT (linkedin_url) 
            DO UPDATE SET
                phone = COALESCE(EXCLUDED.phone, leads.phone),
                email = COALESCE(EXCLUDED.email, leads.email),
                age = COALESCE(EXCLUDED.age, leads.age),
                income = COALESCE(EXCLUDED.income, leads.income),
                dnc_status = COALESCE(EXCLUDED.dnc_status, leads.dnc_status),
                can_contact = COALESCE(EXCLUDED.can_contact, leads.can_contact),
                city = COALESCE(EXCLUDED.city, leads.city),
                state = COALESCE(EXCLUDED.state, leads.state),
                zipcode = COALESCE(EXCLUDED.zipcode, leads.zipcode),
                enriched_at = NOW()
            RETURNING id
        """, (
            linkedin_url, name, phone, email,
            city, state, zipcode, age, income,
            dnc_status, can_contact, linkedin_url
        ))
        
        result = cur.fetchone()
        lead_id = result[0] if result else None
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"✅ Saved lead to database (ID: {lead_id}, LinkedIn: {linkedin_url})")
        return True
        
    except psycopg2.IntegrityError as e:
        print(f"⚠️  Database integrity error (likely duplicate): {e}")
        return True  # Consider duplicate as success
    except Exception as e:
        print(f"❌ Database save error: {e}")
        import traceback
        traceback.print_exc()
        return False

def ensure_table_exists(cur):
    """Ensure leads table exists with correct schema"""
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
            enriched_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
