/**
 * Lead Field Extractor
 * 
 * Automatically detects and extracts lead-related fields from API responses.
 * Scans for: phone, email, address, zipcode, age, income, name, gender, etc.
 */

export interface ExtractedField {
  fieldType: LeadFieldType;
  fieldName: string;           // Original JSON key: e.g., "phoneNumber", "home_address"
  jsonPath: string;            // Full path: e.g., "$.data.person.phones[0].number"
  value: string;               // Actual value found
  confidence: number;          // 0-100 confidence score
  source: 'key_match' | 'value_pattern' | 'both';
  // Validation fields (added by validator)
  validated?: boolean;
  qualityScore?: 'high' | 'medium' | 'low' | 'suspect';
  validationIssues?: Array<{ code: string; message: string }>;
}

export type LeadFieldType = 
  | 'phone'
  | 'email'
  | 'address'
  | 'city'
  | 'state'
  | 'zipcode'
  | 'age'
  | 'dob'
  | 'income'
  | 'name'
  | 'first_name'
  | 'last_name'
  | 'gender'
  | 'ssn_last4'
  | 'linkedin_url'
  | 'facebook_url'
  | 'employer'
  | 'job_title';

// Field detection patterns
interface FieldPattern {
  type: LeadFieldType;
  keyPatterns: RegExp[];         // Match JSON key names
  valuePattern?: RegExp;         // Match value format
  valueValidator?: (value: string) => boolean;
  priority: number;              // Higher = more important
}

const FIELD_PATTERNS: FieldPattern[] = [
  // Phone numbers
  {
    type: 'phone',
    keyPatterns: [
      /phone/i, /mobile/i, /cell/i, /tel/i, /contact.*number/i,
      /primary.*phone/i, /home.*phone/i, /work.*phone/i
    ],
    valuePattern: /^[\d\s\-\(\)\+\.]{7,20}$/,
    valueValidator: (v) => v.replace(/\D/g, '').length >= 10,
    priority: 100,
  },
  // Email
  {
    type: 'email',
    keyPatterns: [/email/i, /e-mail/i, /mail/i, /contact.*email/i],
    valuePattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    priority: 95,
  },
  // Zipcode
  {
    type: 'zipcode',
    keyPatterns: [/zip/i, /postal/i, /postcode/i, /zip.*code/i],
    valuePattern: /^\d{5}(-\d{4})?$/,
    priority: 80,
  },
  // Age
  {
    type: 'age',
    keyPatterns: [/^age$/i, /current.*age/i, /person.*age/i],
    valuePattern: /^\d{1,3}$/,
    valueValidator: (v) => {
      const age = parseInt(v);
      return age >= 18 && age <= 120;
    },
    priority: 85,
  },
  // Date of Birth
  {
    type: 'dob',
    keyPatterns: [/dob/i, /birth/i, /birthday/i, /date.*birth/i, /born/i],
    valuePattern: /^(\d{4}[-\/]\d{2}[-\/]\d{2}|\d{2}[-\/]\d{2}[-\/]\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})$/,
    priority: 82,
  },
  // Income
  {
    type: 'income',
    keyPatterns: [/income/i, /salary/i, /earnings/i, /median.*income/i, /household.*income/i],
    valuePattern: /^[\$]?[\d,]+(\.\d{2})?$|^\d+k$/i,
    priority: 75,
  },
  // Full Name
  {
    type: 'name',
    keyPatterns: [/^name$/i, /full.*name/i, /display.*name/i, /person.*name/i],
    priority: 90,
  },
  // First Name
  {
    type: 'first_name',
    keyPatterns: [/first.*name/i, /given.*name/i, /fname/i, /forename/i],
    priority: 88,
  },
  // Last Name
  {
    type: 'last_name',
    keyPatterns: [/last.*name/i, /sur.*name/i, /lname/i, /family.*name/i],
    priority: 88,
  },
  // Address
  {
    type: 'address',
    keyPatterns: [
      /address/i, /street/i, /addr/i, /residence/i,
      /address.*line/i, /street.*address/i, /home.*address/i
    ],
    priority: 78,
  },
  // City
  {
    type: 'city',
    keyPatterns: [/^city$/i, /city.*name/i, /locality/i, /municipality/i],
    priority: 70,
  },
  // State
  {
    type: 'state',
    keyPatterns: [/^state$/i, /state.*code/i, /province/i, /region/i],
    valuePattern: /^[A-Z]{2}$|^[A-Za-z\s]{4,20}$/,
    priority: 70,
  },
  // Gender
  {
    type: 'gender',
    keyPatterns: [/gender/i, /sex/i],
    valuePattern: /^(male|female|m|f|other|non-binary)$/i,
    priority: 60,
  },
  // SSN Last 4
  {
    type: 'ssn_last4',
    keyPatterns: [/ssn/i, /social.*security/i, /last.*4/i, /ssn.*4/i],
    valuePattern: /^\d{4}$/,
    priority: 50,
  },
  // LinkedIn URL
  {
    type: 'linkedin_url',
    keyPatterns: [/linkedin/i, /li.*url/i, /li.*profile/i],
    valuePattern: /linkedin\.com\/in\//i,
    priority: 65,
  },
  // Facebook URL
  {
    type: 'facebook_url',
    keyPatterns: [/facebook/i, /fb.*url/i, /fb.*profile/i],
    valuePattern: /facebook\.com\//i,
    priority: 55,
  },
  // Employer
  {
    type: 'employer',
    keyPatterns: [/employer/i, /company/i, /organization/i, /workplace/i, /works.*at/i],
    priority: 60,
  },
  // Job Title
  {
    type: 'job_title',
    keyPatterns: [/title/i, /job.*title/i, /position/i, /role/i, /occupation/i],
    priority: 58,
  },
];

// Results summary
export interface ExtractionResult {
  domain: string;
  url: string;
  timestamp: number;
  fields: ExtractedField[];
  summary: {
    totalFields: number;
    byType: Record<LeadFieldType, number>;
    highConfidence: number;  // Fields with confidence >= 80
  };
}

/**
 * Extract lead fields from a JSON response body
 */
export function extractLeadFields(
  responseBody: string,
  url: string,
  domain: string
): ExtractionResult {
  const fields: ExtractedField[] = [];
  
  let data: unknown;
  try {
    data = JSON.parse(responseBody);
  } catch {
    // Not valid JSON
    return createEmptyResult(domain, url);
  }
  
  // Recursively scan the object
  scanObject(data, '$', fields);
  
  // Sort by priority/confidence
  fields.sort((a, b) => b.confidence - a.confidence);
  
  // Build summary
  const byType: Record<string, number> = {};
  let highConfidence = 0;
  
  for (const field of fields) {
    byType[field.fieldType] = (byType[field.fieldType] || 0) + 1;
    if (field.confidence >= 80) highConfidence++;
  }
  
  return {
    domain,
    url,
    timestamp: Date.now(),
    fields,
    summary: {
      totalFields: fields.length,
      byType: byType as Record<LeadFieldType, number>,
      highConfidence,
    },
  };
}

function createEmptyResult(domain: string, url: string): ExtractionResult {
  return {
    domain,
    url,
    timestamp: Date.now(),
    fields: [],
    summary: {
      totalFields: 0,
      byType: {} as Record<LeadFieldType, number>,
      highConfidence: 0,
    },
  };
}

/**
 * Recursively scan object for lead fields
 */
function scanObject(
  obj: unknown,
  path: string,
  results: ExtractedField[]
): void {
  if (obj === null || obj === undefined) return;
  
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      scanObject(item, `${path}[${index}]`, results);
    });
    return;
  }
  
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const currentPath = `${path}.${key}`;
      
      // Check if this key/value matches any pattern
      const match = findFieldMatch(key, value, currentPath);
      if (match) {
        results.push(match);
      }
      
      // Recurse into nested objects
      scanObject(value, currentPath, results);
    }
    return;
  }
  
  // For primitive values at root level (unlikely but handle)
  // Already handled by parent object scan
}

/**
 * Find matching field pattern for a key/value pair
 */
function findFieldMatch(
  key: string,
  value: unknown,
  jsonPath: string
): ExtractedField | null {
  // Skip non-string values for pattern matching
  const stringValue = typeof value === 'string' ? value : 
                      typeof value === 'number' ? String(value) : null;
  
  if (!stringValue || stringValue.length === 0 || stringValue.length > 500) {
    return null;
  }
  
  for (const pattern of FIELD_PATTERNS) {
    let keyMatch = false;
    let valueMatch = false;
    let confidence = 0;
    
    // Check key patterns
    for (const keyPattern of pattern.keyPatterns) {
      if (keyPattern.test(key)) {
        keyMatch = true;
        confidence += 50;
        break;
      }
    }
    
    // Check value pattern
    if (pattern.valuePattern && pattern.valuePattern.test(stringValue)) {
      valueMatch = true;
      confidence += 40;
    }
    
    // Check value validator
    if (pattern.valueValidator && pattern.valueValidator(stringValue)) {
      confidence += 10;
    }
    
    // Must have at least key or value match
    if (!keyMatch && !valueMatch) continue;
    
    // Boost confidence for both matches
    if (keyMatch && valueMatch) {
      confidence = Math.min(100, confidence + 10);
    }
    
    return {
      fieldType: pattern.type,
      fieldName: key,
      jsonPath,
      value: stringValue.substring(0, 100), // Truncate long values
      confidence,
      source: keyMatch && valueMatch ? 'both' : keyMatch ? 'key_match' : 'value_pattern',
    };
  }
  
  return null;
}

/**
 * Get a summary of extraction for display
 */
export function formatExtractionSummary(result: ExtractionResult): string {
  if (result.fields.length === 0) {
    return 'No lead fields detected';
  }
  
  const lines: string[] = [];
  lines.push(`Found ${result.fields.length} fields (${result.summary.highConfidence} high confidence):`);
  
  // Group by type
  const byType = new Map<LeadFieldType, ExtractedField[]>();
  for (const field of result.fields) {
    if (!byType.has(field.fieldType)) {
      byType.set(field.fieldType, []);
    }
    byType.get(field.fieldType)!.push(field);
  }
  
  // Format each type
  for (const [type, fields] of byType) {
    const samples = fields.slice(0, 2).map(f => f.value).join(', ');
    lines.push(`  ${type}: ${fields.length}x (${samples})`);
  }
  
  return lines.join('\n');
}

/**
 * Quick check if response likely contains lead data
 * Used for filtering before full extraction
 */
export function likelyContainsLeadData(responseBody: string): boolean {
  const quickPatterns = [
    /phone/i,
    /email/i,
    /address/i,
    /zipcode/i,
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,  // Phone pattern
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,  // Email pattern
    /\b\d{5}(-\d{4})?\b/,  // Zipcode pattern
  ];
  
  return quickPatterns.some(p => p.test(responseBody));
}

export default {
  extractLeadFields,
  formatExtractionSummary,
  likelyContainsLeadData,
};
