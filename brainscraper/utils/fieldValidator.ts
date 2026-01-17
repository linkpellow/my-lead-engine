/**
 * Field Validator - Prevents False Positives in Data Extraction
 * 
 * Validates extracted fields using:
 * 1. Format validation (strict patterns)
 * 2. Semantic validation (does value make sense?)
 * 3. Context validation (is surrounding data consistent?)
 * 4. Blacklist patterns (known false positive sources)
 * 5. Cross-field validation (do fields belong together?)
 */

import type { ExtractedField, LeadFieldType } from './leadFieldExtractor';

// ============================================
// Validation Result Types
// ============================================

export interface ValidationResult {
  isValid: boolean;
  confidence: number;         // 0-100, adjusted confidence
  originalConfidence: number; // Original confidence before validation
  issues: ValidationIssue[];
  qualityScore: 'high' | 'medium' | 'low' | 'suspect';
}

export interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

// ============================================
// Known False Positive Patterns
// ============================================

const FALSE_POSITIVE_CONTEXTS = [
  // Analytics/Tracking
  /analytics/i, /tracking/i, /gtm/i, /ga\d/i, /pixel/i,
  /facebook.*pixel/i, /fbevents/i, /segment/i, /mixpanel/i,
  // Authentication/Session
  /session/i, /token/i, /auth/i, /jwt/i, /csrf/i,
  /cookie/i, /credential/i, /password/i,
  // System/Internal
  /debug/i, /log/i, /error/i, /config/i, /setting/i,
  /version/i, /build/i, /timestamp/i, /_id$/i,
  // Commerce (not person data)
  /order.*id/i, /transaction/i, /invoice/i, /sku/i,
  /product.*id/i, /cart/i, /checkout/i,
];

const FALSE_POSITIVE_PATHS = [
  // API paths that rarely contain real lead data
  /_next/i, /webpack/i, /static/i, /assets/i,
  /api\/auth/i, /api\/analytics/i, /api\/tracking/i,
  /graphql.*mutation/i, /health/i, /status/i,
];

// ============================================
// Phone Number Validation
// ============================================

const VALID_PHONE_FORMATS = [
  // US formats
  /^\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
  /^\d{10}$/,
  /^\d{3}-\d{3}-\d{4}$/,
  /^\(\d{3}\)\s?\d{3}-\d{4}$/,
];

const INVALID_PHONE_PATTERNS = [
  // Sequential numbers (test data)
  /^1234567890$/,
  /^0{10}$/,
  /^1{10}$/,
  /^(\d)\1{9}$/,  // Same digit repeated
  // Premium/toll numbers
  /^1?900/,
  /^1?976/,
  // Known test numbers
  /^555\d{7}$/,
  // Area codes that don't exist
  /^[01]\d{9}$/,  // Can't start with 0 or 1
];

// Valid US area codes (partial list for validation)
const VALID_AREA_CODES = new Set([
  '201', '202', '203', '205', '206', '207', '208', '209', '210',
  '212', '213', '214', '215', '216', '217', '218', '219', '220',
  '224', '225', '228', '229', '231', '234', '239', '240', '248',
  '251', '252', '253', '254', '256', '260', '262', '267', '269',
  '270', '272', '276', '281', '301', '302', '303', '304', '305',
  '307', '308', '309', '310', '312', '313', '314', '315', '316',
  '317', '318', '319', '320', '321', '323', '325', '330', '331',
  '334', '336', '337', '339', '346', '347', '351', '352', '360',
  '361', '385', '386', '401', '402', '404', '405', '406', '407',
  '408', '409', '410', '412', '413', '414', '415', '417', '419',
  '423', '424', '425', '430', '432', '434', '435', '440', '442',
  '443', '458', '469', '470', '475', '478', '479', '480', '484',
  '501', '502', '503', '504', '505', '507', '508', '509', '510',
  '512', '513', '515', '516', '517', '518', '520', '530', '531',
  '534', '539', '540', '541', '551', '559', '561', '562', '563',
  '567', '570', '571', '573', '574', '575', '580', '585', '586',
  // Add more as needed
]);

function validatePhone(value: string, jsonPath: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  let confidence = 80; // Start with base confidence
  
  // Clean the phone number
  const digits = value.replace(/\D/g, '');
  
  // Check length
  if (digits.length < 10) {
    issues.push({ code: 'PHONE_TOO_SHORT', severity: 'error', message: 'Phone number too short' });
    return { isValid: false, confidence: 0, originalConfidence: confidence, issues, qualityScore: 'suspect' };
  }
  
  if (digits.length > 11) {
    issues.push({ code: 'PHONE_TOO_LONG', severity: 'error', message: 'Phone number too long' });
    return { isValid: false, confidence: 0, originalConfidence: confidence, issues, qualityScore: 'suspect' };
  }
  
  // Check for invalid patterns
  for (const pattern of INVALID_PHONE_PATTERNS) {
    if (pattern.test(digits)) {
      issues.push({ code: 'PHONE_INVALID_PATTERN', severity: 'error', message: 'Phone matches known invalid pattern' });
      return { isValid: false, confidence: 0, originalConfidence: confidence, issues, qualityScore: 'suspect' };
    }
  }
  
  // Check area code validity (for US numbers)
  const areaCode = digits.length === 11 ? digits.slice(1, 4) : digits.slice(0, 3);
  if (!VALID_AREA_CODES.has(areaCode)) {
    issues.push({ code: 'PHONE_INVALID_AREA_CODE', severity: 'warning', message: `Area code ${areaCode} may not be valid` });
    confidence -= 20;
  }
  
  // Check format validity
  const formatValid = VALID_PHONE_FORMATS.some(f => f.test(value));
  if (!formatValid) {
    issues.push({ code: 'PHONE_ODD_FORMAT', severity: 'info', message: 'Phone format is unusual' });
    confidence -= 10;
  }
  
  // Check context for false positives
  for (const ctx of FALSE_POSITIVE_CONTEXTS) {
    if (ctx.test(jsonPath)) {
      issues.push({ code: 'CONTEXT_SUSPICIOUS', severity: 'warning', message: 'Found in suspicious context' });
      confidence -= 30;
      break;
    }
  }
  
  const qualityScore = confidence >= 70 ? 'high' : confidence >= 50 ? 'medium' : confidence >= 30 ? 'low' : 'suspect';
  
  return {
    isValid: confidence > 30,
    confidence: Math.max(0, Math.min(100, confidence)),
    originalConfidence: 80,
    issues,
    qualityScore,
  };
}

// ============================================
// Email Validation
// ============================================

const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com', 'throwaway.com', '10minutemail.com', 'guerrillamail.com',
  'mailinator.com', 'fakeinbox.com', 'sharklasers.com', 'yopmail.com',
];

const TEST_EMAIL_PATTERNS = [
  /test@/i, /example@/i, /demo@/i, /fake@/i, /sample@/i,
  /@example\./i, /@test\./i, /noreply@/i, /no-reply@/i,
];

function validateEmail(value: string, jsonPath: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  let confidence = 80;
  
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(value)) {
    issues.push({ code: 'EMAIL_INVALID_FORMAT', severity: 'error', message: 'Invalid email format' });
    return { isValid: false, confidence: 0, originalConfidence: confidence, issues, qualityScore: 'suspect' };
  }
  
  const domain = value.split('@')[1].toLowerCase();
  
  // Check for disposable domains
  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    issues.push({ code: 'EMAIL_DISPOSABLE', severity: 'warning', message: 'Disposable email domain' });
    confidence -= 30;
  }
  
  // Check for test patterns
  for (const pattern of TEST_EMAIL_PATTERNS) {
    if (pattern.test(value)) {
      issues.push({ code: 'EMAIL_TEST_PATTERN', severity: 'warning', message: 'Looks like test email' });
      confidence -= 40;
      break;
    }
  }
  
  // Check context
  for (const ctx of FALSE_POSITIVE_CONTEXTS) {
    if (ctx.test(jsonPath)) {
      issues.push({ code: 'CONTEXT_SUSPICIOUS', severity: 'warning', message: 'Found in suspicious context' });
      confidence -= 30;
      break;
    }
  }
  
  const qualityScore = confidence >= 70 ? 'high' : confidence >= 50 ? 'medium' : confidence >= 30 ? 'low' : 'suspect';
  
  return {
    isValid: confidence > 30,
    confidence: Math.max(0, Math.min(100, confidence)),
    originalConfidence: 80,
    issues,
    qualityScore,
  };
}

// ============================================
// Age Validation
// ============================================

function validateAge(value: string, jsonPath: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  let confidence = 70;
  
  const age = parseInt(value, 10);
  
  if (isNaN(age)) {
    issues.push({ code: 'AGE_NOT_NUMBER', severity: 'error', message: 'Age is not a number' });
    return { isValid: false, confidence: 0, originalConfidence: confidence, issues, qualityScore: 'suspect' };
  }
  
  // Strict age range
  if (age < 18 || age > 100) {
    issues.push({ code: 'AGE_OUT_OF_RANGE', severity: 'error', message: 'Age out of valid range (18-100)' });
    return { isValid: false, confidence: 0, originalConfidence: confidence, issues, qualityScore: 'suspect' };
  }
  
  // Check if it might be a year
  if (age >= 1900 && age <= 2100) {
    issues.push({ code: 'AGE_LOOKS_LIKE_YEAR', severity: 'error', message: 'Value looks like a year, not age' });
    return { isValid: false, confidence: 0, originalConfidence: confidence, issues, qualityScore: 'suspect' };
  }
  
  // Check JSON path for suspicious contexts
  const suspiciousAgePaths = [
    /count/i, /total/i, /length/i, /size/i, /quantity/i, /amount/i,
    /limit/i, /offset/i, /page/i, /index/i, /version/i, /year/i,
  ];
  
  for (const pattern of suspiciousAgePaths) {
    if (pattern.test(jsonPath)) {
      issues.push({ code: 'AGE_SUSPICIOUS_PATH', severity: 'error', message: `Path "${jsonPath}" suggests this is not an age` });
      return { isValid: false, confidence: 0, originalConfidence: confidence, issues, qualityScore: 'suspect' };
    }
  }
  
  // Path should contain "age" or "person" or "profile"
  const expectedAgePaths = [/age/i, /person/i, /profile/i, /user/i, /member/i, /customer/i];
  const hasExpectedPath = expectedAgePaths.some(p => p.test(jsonPath));
  
  if (!hasExpectedPath) {
    issues.push({ code: 'AGE_UNEXPECTED_PATH', severity: 'warning', message: 'Path does not suggest person data' });
    confidence -= 30;
  }
  
  const qualityScore = confidence >= 70 ? 'high' : confidence >= 50 ? 'medium' : confidence >= 30 ? 'low' : 'suspect';
  
  return {
    isValid: confidence > 30,
    confidence: Math.max(0, Math.min(100, confidence)),
    originalConfidence: 70,
    issues,
    qualityScore,
  };
}

// ============================================
// Zipcode Validation
// ============================================

function validateZipcode(value: string, jsonPath: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  let confidence = 80;
  
  // US zipcode format
  const zipcodeRegex = /^\d{5}(-\d{4})?$/;
  if (!zipcodeRegex.test(value)) {
    issues.push({ code: 'ZIP_INVALID_FORMAT', severity: 'error', message: 'Invalid US zipcode format' });
    return { isValid: false, confidence: 0, originalConfidence: confidence, issues, qualityScore: 'suspect' };
  }
  
  const zip5 = value.slice(0, 5);
  
  // Check for invalid ranges
  // Valid US zipcodes are 00501-99950 (roughly)
  const zipNum = parseInt(zip5, 10);
  if (zipNum < 501 || zipNum > 99950) {
    issues.push({ code: 'ZIP_INVALID_RANGE', severity: 'warning', message: 'Zipcode may not exist' });
    confidence -= 20;
  }
  
  // Check for test patterns
  if (/^0{5}$|^1{5}$|^12345$/.test(zip5)) {
    issues.push({ code: 'ZIP_TEST_PATTERN', severity: 'error', message: 'Looks like test zipcode' });
    return { isValid: false, confidence: 0, originalConfidence: confidence, issues, qualityScore: 'suspect' };
  }
  
  const qualityScore = confidence >= 70 ? 'high' : confidence >= 50 ? 'medium' : confidence >= 30 ? 'low' : 'suspect';
  
  return {
    isValid: confidence > 30,
    confidence: Math.max(0, Math.min(100, confidence)),
    originalConfidence: 80,
    issues,
    qualityScore,
  };
}

// ============================================
// Generic Validation
// ============================================

function validateGeneric(fieldType: LeadFieldType, value: string, jsonPath: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  let confidence = 60;
  
  // Check context
  for (const ctx of FALSE_POSITIVE_CONTEXTS) {
    if (ctx.test(jsonPath)) {
      issues.push({ code: 'CONTEXT_SUSPICIOUS', severity: 'warning', message: 'Found in suspicious context' });
      confidence -= 30;
      break;
    }
  }
  
  // Check for overly short values
  if (value.length < 2) {
    issues.push({ code: 'VALUE_TOO_SHORT', severity: 'warning', message: 'Value suspiciously short' });
    confidence -= 20;
  }
  
  const qualityScore = confidence >= 70 ? 'high' : confidence >= 50 ? 'medium' : confidence >= 30 ? 'low' : 'suspect';
  
  return {
    isValid: confidence > 30,
    confidence: Math.max(0, Math.min(100, confidence)),
    originalConfidence: 60,
    issues,
    qualityScore,
  };
}

// ============================================
// Main Validation Function
// ============================================

export function validateField(field: ExtractedField): ValidationResult {
  switch (field.fieldType) {
    case 'phone':
      return validatePhone(field.value, field.jsonPath);
    case 'email':
      return validateEmail(field.value, field.jsonPath);
    case 'age':
      return validateAge(field.value, field.jsonPath);
    case 'zipcode':
      return validateZipcode(field.value, field.jsonPath);
    default:
      return validateGeneric(field.fieldType, field.value, field.jsonPath);
  }
}

/**
 * Validate all fields and filter out false positives
 */
export function validateAndFilterFields(fields: ExtractedField[]): {
  validFields: ExtractedField[];
  suspectFields: ExtractedField[];
  validationResults: Map<string, ValidationResult>;
} {
  const validFields: ExtractedField[] = [];
  const suspectFields: ExtractedField[] = [];
  const validationResults = new Map<string, ValidationResult>();
  
  for (const field of fields) {
    const result = validateField(field);
    const key = `${field.fieldType}:${field.jsonPath}`;
    validationResults.set(key, result);
    
    // Update field confidence based on validation
    const validatedField = {
      ...field,
      confidence: result.confidence,
    };
    
    if (result.isValid && result.qualityScore !== 'suspect') {
      validFields.push(validatedField);
    } else {
      suspectFields.push(validatedField);
    }
  }
  
  return { validFields, suspectFields, validationResults };
}

/**
 * Cross-validate multiple fields to check consistency
 */
export function crossValidateFields(fields: ExtractedField[]): {
  isConsistent: boolean;
  consistencyScore: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;
  
  // Check for phone + name consistency (same response)
  const phoneFields = fields.filter(f => f.fieldType === 'phone');
  const nameFields = fields.filter(f => f.fieldType === 'name' || f.fieldType === 'first_name' || f.fieldType === 'last_name');
  
  // If we have phone but no name, that's suspicious for lead data
  if (phoneFields.length > 0 && nameFields.length === 0) {
    issues.push('Phone found without associated name');
    score -= 20;
  }
  
  // Check for location consistency
  const cityFields = fields.filter(f => f.fieldType === 'city');
  const stateFields = fields.filter(f => f.fieldType === 'state');
  const zipFields = fields.filter(f => f.fieldType === 'zipcode');
  
  // If we have zipcode, we should probably have city/state
  if (zipFields.length > 0 && cityFields.length === 0 && stateFields.length === 0) {
    issues.push('Zipcode found without city/state');
    score -= 10;
  }
  
  return {
    isConsistent: score >= 60,
    consistencyScore: score,
    issues,
  };
}

export default {
  validateField,
  validateAndFilterFields,
  crossValidateFields,
};
