"""
Demographic Enrichment Module
Pulls high-accuracy US census data (Income, Age, Address)
"""
import os
import requests
from typing import Dict, Any, Optional

from loguru import logger

CENSUS_API_KEY = os.getenv("CENSUS_API_KEY")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY")

def enrich_demographics(contact_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich with demographic data from Census API
    
    Args:
        contact_info: Contact information with zipcode
        
    Returns:
        Dictionary with income, age, address details
    """
    zipcode = contact_info.get('zipcode')
    if not zipcode:
        logger.warning("No zipcode available for demographic enrichment")
        return {}
    
    result = {}
    
    # Get income data
    income_data = get_income_by_zipcode(zipcode)
    if income_data:
        result['income'] = income_data.get('median_income') or income_data.get('income')
        result['income_range'] = income_data.get('income_range')
    
    # Get age from contact_info when available (e.g. skip-trace, Chimera, scraper).
    # Census does not provide individual age by ZIP; zip-based median age would be
    # inaccurate for individuals. No estimation is performed.
    age = contact_info.get('age')
    if age is not None:
        result['age'] = age
    
    # Address details (already in contact_info, but ensure completeness)
    if contact_info.get('address'):
        result['address'] = contact_info['address']
    if contact_info.get('city'):
        result['city'] = contact_info['city']
    if contact_info.get('state'):
        result['state'] = contact_info['state']
    if zipcode:
        result['zipcode'] = zipcode
    
    return result

def get_income_by_zipcode(zipcode: str) -> Optional[Dict[str, Any]]:
    """Get median household income for zipcode"""
    # Try RapidAPI first
    if RAPIDAPI_KEY:
        try:
            url = f"https://household-income-by-zip-code.p.rapidapi.com/v1/Census/HouseholdIncomeByZip/{zipcode}"
            headers = {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': 'household-income-by-zip-code.p.rapidapi.com'
            }
            
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Extract income from response (structure may vary)
            income = None
            if isinstance(data, dict):
                income = (data.get('medianIncome') or data.get('median_income') or 
                         data.get('income') or data.get('householdIncome'))
                if isinstance(income, (int, float)):
                    return {
                        'median_income': f"${income:,.0f}",
                        'income': income
                    }
                elif isinstance(income, str):
                    return {
                        'median_income': income,
                        'income': income
                    }
            
            return data if isinstance(data, dict) else None
            
        except Exception as e:
            logger.warning("RapidAPI income lookup failed: {}", e)
    
    # Fallback to Census API
    if CENSUS_API_KEY:
        try:
            # Census API endpoint for income data
            # Note: This is a simplified example - actual Census API may require more complex queries
            url = "https://api.census.gov/data/2021/acs/acs5"
            params = {
                'get': 'B19013_001E',  # Median household income
                'for': f'zip code tabulation area:{zipcode}',
                'key': CENSUS_API_KEY
            }
            
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            if data and len(data) > 1:
                income_value = data[1][0]  # First data row, first value
                if income_value and income_value != '-':
                    income = int(income_value)
                    return {
                        'median_income': f"${income:,.0f}",
                        'income': income
                    }
            
        except Exception as e:
            logger.warning("Census API income lookup failed: {}", e)
    
    return None
