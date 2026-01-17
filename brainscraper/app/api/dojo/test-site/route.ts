import { NextRequest, NextResponse } from 'next/server';
import { validateField } from '@/utils/fieldValidator';
import type { ExtractedField } from '@/utils/leadFieldExtractor';

// Known test identities for validation (people with public records)
const TEST_IDENTITIES = {
  // Using public figures/common names for testing
  default: { firstName: 'John', lastName: 'Smith', city: 'Miami', state: 'FL' },
  florida: { firstName: 'Michael', lastName: 'Johnson', city: 'Orlando', state: 'FL' },
  texas: { firstName: 'Robert', lastName: 'Williams', city: 'Houston', state: 'TX' },
};

// Test a site's blueprint with a sample identity
export async function POST(request: NextRequest) {
  try {
    const { siteId, domain, blueprint, testIdentity, validateResults } = await request.json();
    
    if (!domain || !blueprint) {
      return NextResponse.json({ error: 'Domain and blueprint required' }, { status: 400 });
    }
    
    // Default test identity
    const identity = testIdentity || TEST_IDENTITIES.default;
    
    // Build the test URL from blueprint
    let testUrl = blueprint.targetUrl || `https://${domain}`;
    
    // Replace placeholders
    const name = `${identity.firstName} ${identity.lastName}`.trim();
    testUrl = testUrl
      .replace('{name}', encodeURIComponent(name))
      .replace('{firstName}', encodeURIComponent(identity.firstName || ''))
      .replace('{lastName}', encodeURIComponent(identity.lastName || ''))
      .replace('{city}', encodeURIComponent(identity.city || ''))
      .replace('{state}', encodeURIComponent(identity.state || ''))
      .replace('{zipcode}', encodeURIComponent(identity.zipcode || ''));
    
    console.log(`🧪 Testing site: ${domain}`);
    console.log(`📍 URL: ${testUrl}`);
    
    // Try to call the scrapegoat service for actual testing
    const scrapegoatUrl = process.env.SCRAPEGOAT_URL || 'http://localhost:8000';
    
    try {
      // Call scrapegoat's test endpoint
      const scrapegoatResponse = await fetch(`${scrapegoatUrl}/api/test-blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          targetUrl: testUrl,
          method: blueprint.method || 'GET',
          responseType: blueprint.responseType || 'html',
          extraction: blueprint.extraction || {},
          headers: blueprint.headers || {},
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
      
      if (scrapegoatResponse.ok) {
        const result = await scrapegoatResponse.json();
        
        return NextResponse.json({
          success: result.success,
          extractedFields: result.extractedFields || {},
          statusCode: result.statusCode,
          error: result.error,
          rawResponse: result.rawResponse?.substring(0, 500),
        });
      } else {
        const errorText = await scrapegoatResponse.text();
        return NextResponse.json({
          success: false,
          error: `Scrapegoat error: ${scrapegoatResponse.status} - ${errorText.substring(0, 200)}`,
        });
      }
    } catch (fetchError: any) {
      // Scrapegoat not available - do a simple fetch test
      console.log('⚠️ Scrapegoat not available, doing basic test');
      
      try {
        const response = await fetch(testUrl, {
          method: blueprint.method || 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            ...blueprint.headers,
          },
          signal: AbortSignal.timeout(15000),
        });
        
        const statusCode = response.status;
        const text = await response.text();
        
        // Check for common blocking patterns
        const isBlocked = 
          statusCode === 403 ||
          statusCode === 503 ||
          text.includes('CAPTCHA') ||
          text.includes('captcha') ||
          text.includes('challenge') ||
          text.includes('cf-mitigated') ||
          text.includes('cloudflare');
        
        if (isBlocked) {
          return NextResponse.json({
            success: false,
            statusCode,
            error: `Blocked (${statusCode}): Site requires CAPTCHA/proxy`,
            extractedFields: {},
          });
        }
        
        // Try basic extraction if we have patterns
        const extractedFields: Record<string, string> = {};
        const validationResults: Record<string, { isValid: boolean; confidence: number; qualityScore: string; issues: string[] }> = {};
        
        if (blueprint.extraction && blueprint.responseType === 'html') {
          // Very basic regex extraction for common patterns
          for (const [field, selector] of Object.entries(blueprint.extraction || {})) {
            // Try to find phone numbers
            if (field === 'phone') {
              const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
              if (phoneMatch) {
                extractedFields.phone = phoneMatch[0];
                // Validate the extracted phone
                const validation = validateField({
                  fieldType: 'phone',
                  fieldName: 'phone',
                  jsonPath: '$.extracted.phone',
                  value: phoneMatch[0],
                  confidence: 70,
                  source: 'value_pattern',
                } as ExtractedField);
                validationResults.phone = {
                  isValid: validation.isValid,
                  confidence: validation.confidence,
                  qualityScore: validation.qualityScore,
                  issues: validation.issues.map(i => i.message),
                };
              }
            }
            // Try to find ages
            if (field === 'age') {
              const ageMatch = text.match(/\b(age|Age|AGE)[:\s]*(\d{2,3})\b/);
              if (ageMatch) {
                extractedFields.age = ageMatch[2];
                // Validate the extracted age
                const validation = validateField({
                  fieldType: 'age',
                  fieldName: 'age',
                  jsonPath: '$.extracted.age',
                  value: ageMatch[2],
                  confidence: 70,
                  source: 'both',
                } as ExtractedField);
                validationResults.age = {
                  isValid: validation.isValid,
                  confidence: validation.confidence,
                  qualityScore: validation.qualityScore,
                  issues: validation.issues.map(i => i.message),
                };
              }
            }
            // Try to find emails
            if (field === 'email') {
              const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
              if (emailMatch) {
                extractedFields.email = emailMatch[0];
                // Validate the extracted email
                const validation = validateField({
                  fieldType: 'email',
                  fieldName: 'email',
                  jsonPath: '$.extracted.email',
                  value: emailMatch[0],
                  confidence: 70,
                  source: 'value_pattern',
                } as ExtractedField);
                validationResults.email = {
                  isValid: validation.isValid,
                  confidence: validation.confidence,
                  qualityScore: validation.qualityScore,
                  issues: validation.issues.map(i => i.message),
                };
              }
            }
          }
        }
        
        const hasExtracted = Object.keys(extractedFields).length > 0;
        const validCount = Object.values(validationResults).filter(v => v.isValid).length;
        const suspectCount = Object.values(validationResults).filter(v => v.qualityScore === 'suspect').length;
        
        return NextResponse.json({
          success: statusCode === 200 && !isBlocked,
          statusCode,
          extractedFields,
          validationResults,
          summary: {
            fieldsFound: Object.keys(extractedFields).length,
            validFields: validCount,
            suspectFields: suspectCount,
          },
          error: statusCode !== 200 ? `HTTP ${statusCode}` : undefined,
          note: hasExtracted 
            ? `Extracted ${Object.keys(extractedFields).length} fields (${validCount} valid, ${suspectCount} suspect)` 
            : 'No fields extracted - CSS selectors may need updating',
        });
      } catch (fetchErr: any) {
        return NextResponse.json({
          success: false,
          error: fetchErr.message || 'Request failed',
        });
      }
    }
  } catch (error: any) {
    console.error('Test site error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Test failed',
    }, { status: 500 });
  }
}
