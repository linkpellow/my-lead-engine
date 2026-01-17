"""
Telnyx Gatekeep Module
Validates phone numbers and filters out VOIP/Landline/junk carriers
CRITICAL: Stops enrichment early to save API costs
"""
import os
import requests
from typing import Dict, Any

TELNYX_API_KEY = os.getenv("TELNYX_API_KEY")

# Known junk/VOIP carriers to reject
JUNK_CARRIERS = [
    'Google Voice',
    'TextNow',
    'Burner',
    'Twilio',
    'Bandwidth',
    'Vonage',
    'RingCentral',
    '8x8',
    'Nextiva',
    'Ooma',
    'MagicJack',
    'Grasshopper',
]

def validate_phone_telnyx(phone: str) -> Dict[str, Any]:
    """
    Validate phone via Telnyx API
    
    Args:
        phone: Phone number to validate
        
    Returns:
        Validation result with is_valid, is_mobile, is_voip, is_landline, carrier, is_junk
    """
    if not TELNYX_API_KEY:
        print("⚠️  TELNYX_API_KEY not set, skipping Telnyx validation")
        # Return permissive result if API key not set (for development)
        return {
            'is_valid': True,
            'is_mobile': True,
            'is_voip': False,
            'is_landline': False,
            'carrier': None,
            'is_junk': False
        }
    
    try:
        # Clean phone number
        cleaned_phone = ''.join(filter(str.isdigit, phone))
        if cleaned_phone.startswith('1') and len(cleaned_phone) == 11:
            cleaned_phone = cleaned_phone[1:]  # Remove country code for US
        
        if len(cleaned_phone) != 10:
            return {
                'is_valid': False,
                'is_mobile': False,
                'is_voip': False,
                'is_landline': False,
                'carrier': None,
                'is_junk': False
            }
        
        # Call Telnyx Phone Number Lookup API
        url = "https://api.telnyx.com/v2/phone_numbers/lookup"
        headers = {
            "Authorization": f"Bearer {TELNYX_API_KEY}"
        }
        params = {
            "phone_number": f"+1{cleaned_phone}"
        }
        
        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        carrier_info = data.get('data', {}).get('carrier', {})
        carrier_name = carrier_info.get('name', '')
        carrier_type = carrier_info.get('type', '').lower()
        
        is_junk = is_junk_carrier(carrier_name)
        is_mobile = carrier_type == 'mobile'
        is_voip = carrier_type == 'voip'
        is_landline = carrier_type == 'landline'
        
        return {
            'is_valid': data.get('data', {}).get('valid', False),
            'is_mobile': is_mobile,
            'is_voip': is_voip,
            'is_landline': is_landline,
            'carrier': carrier_name,
            'is_junk': is_junk
        }
        
    except requests.RequestException as e:
        print(f"⚠️  Telnyx API error: {e}")
        # On API error, allow to proceed (fail open for development)
        # In production, you might want to fail closed
        return {
            'is_valid': True,
            'is_mobile': True,
            'is_voip': False,
            'is_landline': False,
            'carrier': None,
            'is_junk': False
        }
    except Exception as e:
        print(f"❌ Telnyx validation error: {e}")
        return {
            'is_valid': False,
            'is_mobile': False,
            'is_voip': False,
            'is_landline': False,
            'carrier': None,
            'is_junk': False
        }

def is_junk_carrier(carrier_name: str) -> bool:
    """Check if carrier is known junk/VOIP provider"""
    if not carrier_name:
        return False
    
    carrier_lower = carrier_name.lower()
    for junk in JUNK_CARRIERS:
        if junk.lower() in carrier_lower:
            return True
    
    return False

def should_reject_lead(validation: Dict[str, Any]) -> bool:
    """
    Determine if lead should be rejected based on Telnyx validation
    
    Returns True if lead should be rejected (STOP enrichment)
    """
    # Reject if invalid
    if not validation.get('is_valid'):
        print("🚫 Rejecting: Phone number is invalid")
        return True
    
    # Reject if VOIP or Landline
    if validation.get('is_voip') or validation.get('is_landline'):
        print(f"🚫 Rejecting: Phone is {validation.get('carrier')} ({'VOIP' if validation.get('is_voip') else 'Landline'})")
        return True
    
    # Reject if junk carrier
    if validation.get('is_junk'):
        print(f"🚫 Rejecting: Junk carrier detected: {validation.get('carrier')}")
        return True
    
    # Reject if not mobile
    if not validation.get('is_mobile'):
        print(f"🚫 Rejecting: Phone is not mobile type")
        return True
    
    return False
