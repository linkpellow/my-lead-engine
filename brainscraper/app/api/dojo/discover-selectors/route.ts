/**
 * Discover Selectors API
 * 
 * Fetches a people search URL (via Scrapegoat) and analyzes the HTML
 * to discover CSS selectors for phone, age, email, address, etc.
 * 
 * This bridges the gap between The Dojo (frontend) and the actual
 * HTML structure of people search sites.
 */

import { NextRequest, NextResponse } from 'next/server';

const SCRAPEGOAT_URL = process.env.SCRAPEGOAT_URL || 'http://localhost:8000';

// Patterns to find lead data in HTML
const FIELD_PATTERNS = {
  phone: [
    // tel: links
    { selector: "a[href^='tel:']", extract: 'text' },
    { selector: "a[href^='tel:']", extract: 'href', transform: 'stripTel' },
    // Common class patterns
    { selector: ".phone-number", extract: 'text' },
    { selector: ".phone", extract: 'text' },
    { selector: "[class*='phone']", extract: 'text' },
    { selector: "[data-phone]", extract: 'attr:data-phone' },
    // Microdata
    { selector: "[itemprop='telephone']", extract: 'text' },
    // Format-based (###-###-####)
    { regex: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/ },
  ],
  email: [
    { selector: "a[href^='mailto:']", extract: 'text' },
    { selector: "a[href^='mailto:']", extract: 'href', transform: 'stripMailto' },
    { selector: ".email", extract: 'text' },
    { selector: "[class*='email']", extract: 'text' },
    { selector: "[itemprop='email']", extract: 'text' },
    { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
  ],
  age: [
    { selector: ".age", extract: 'text' },
    { selector: "[class*='age']", extract: 'text' },
    { selector: ".detail-box-age", extract: 'text' },
    // Look for "Age: XX" pattern
    { regex: /\bAge[:\s]+(\d{1,3})\b/i, group: 1 },
    // Look for birth year and calculate
    { regex: /\b(19|20)\d{2}\b/, transform: 'yearToAge' },
  ],
  address: [
    { selector: "[itemprop='streetAddress']", extract: 'text' },
    { selector: ".address", extract: 'text' },
    { selector: "[class*='address']", extract: 'text' },
    { selector: ".detail-box-address", extract: 'text' },
  ],
  city: [
    { selector: "[itemprop='addressLocality']", extract: 'text' },
    { selector: ".city", extract: 'text' },
  ],
  state: [
    { selector: "[itemprop='addressRegion']", extract: 'text' },
    { selector: ".state", extract: 'text' },
  ],
  zipcode: [
    { selector: "[itemprop='postalCode']", extract: 'text' },
    { selector: ".zip", extract: 'text' },
    { selector: ".zipcode", extract: 'text' },
    { regex: /\b\d{5}(-\d{4})?\b/ },
  ],
  name: [
    { selector: "h1", extract: 'text' },
    { selector: "[itemprop='name']", extract: 'text' },
    { selector: ".card-title", extract: 'text' },
    { selector: ".name", extract: 'text' },
  ],
  income: [
    { selector: ".income", extract: 'text' },
    { selector: "[class*='income']", extract: 'text' },
    { regex: /\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*\/\s*(?:year|yr|annually))?/i },
  ],
};

interface DiscoveredSelector {
  field: string;
  selector: string;
  value: string;
  confidence: number;
  method: 'css' | 'regex';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, testIdentity } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Discovering selectors for: ${url}`);

    // Step 1: Fetch the HTML via Scrapegoat (with stealth + proxy)
    let html: string;
    let statusCode: number;

    try {
      const scrapeResponse = await fetch(`${SCRAPEGOAT_URL}/api/fetch-html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          useProxy: true,
          useStealth: true,
          useBrowser: false, // Try HTTP first
        }),
      });

      const scrapeData = await scrapeResponse.json();
      
      if (!scrapeData.success) {
        // Try with browser mode
        console.log('⚠️ HTTP fetch failed, trying browser mode...');
        
        const browserResponse = await fetch(`${SCRAPEGOAT_URL}/api/fetch-html`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            useProxy: true,
            useStealth: true,
            useBrowser: true,
          }),
        });
        
        const browserData = await browserResponse.json();
        if (!browserData.success) {
          return NextResponse.json({
            success: false,
            error: browserData.error || 'Failed to fetch HTML',
            requiresManualMapping: true,
          });
        }
        
        html = browserData.html;
        statusCode = browserData.statusCode;
      } else {
        html = scrapeData.html;
        statusCode = scrapeData.statusCode;
      }
    } catch (fetchError) {
      // Fallback: Try direct fetch (less reliable but works for some sites)
      console.log('⚠️ Scrapegoat unavailable, trying direct fetch...');
      
      try {
        const directResponse = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        
        html = await directResponse.text();
        statusCode = directResponse.status;
      } catch (directError) {
        return NextResponse.json({
          success: false,
          error: 'Could not fetch URL. Site may be blocking automated requests.',
          requiresManualMapping: true,
        });
      }
    }

    // Check for CAPTCHA/block pages
    if (html.includes('captcha') || html.includes('challenge') || html.includes('cf-browser-verification')) {
      return NextResponse.json({
        success: false,
        error: 'Site returned CAPTCHA challenge. Browser mode with CAPTCHA solving required.',
        statusCode,
        captchaDetected: true,
        requiresBrowser: true,
      });
    }

    // Step 2: Analyze HTML to find selectors
    const discoveredSelectors: DiscoveredSelector[] = [];

    for (const [fieldName, patterns] of Object.entries(FIELD_PATTERNS)) {
      for (const pattern of patterns) {
        if ('selector' in pattern && pattern.selector) {
          // CSS selector pattern
          const matches = findBySelector(html, pattern.selector);
          if (matches.length > 0) {
            const value = extractValue(matches[0], pattern);
            if (value && isValidValue(fieldName, value)) {
              discoveredSelectors.push({
                field: fieldName,
                selector: formatSelector(pattern),
                value: cleanValue(fieldName, value),
                confidence: calculateConfidence(fieldName, value, pattern.selector),
                method: 'css',
              });
              break; // Found a match, move to next field
            }
          }
        } else if ('regex' in pattern) {
          // Regex pattern
          const regex = pattern.regex;
          if (!regex) continue; // Skip if regex is undefined
          const match = html.match(regex);
          if (match) {
            const value = pattern.group !== undefined ? match[pattern.group] : match[0];
            if (value && isValidValue(fieldName, value)) {
              discoveredSelectors.push({
                field: fieldName,
                selector: `regex:${regex.source}`,
                value: cleanValue(fieldName, value),
                confidence: 0.6, // Lower confidence for regex
                method: 'regex',
              });
              break;
            }
          }
        }
      }
    }

    // Step 3: Build suggested blueprint
    const extraction: Record<string, string> = {};
    for (const discovered of discoveredSelectors) {
      if (discovered.method === 'css') {
        extraction[discovered.field] = discovered.selector;
      }
    }

    return NextResponse.json({
      success: true,
      statusCode,
      htmlLength: html.length,
      discoveredSelectors,
      suggestedBlueprint: {
        targetUrl: url,
        method: 'GET',
        responseType: 'html',
        extraction,
      },
      fieldsFound: discoveredSelectors.map(s => s.field),
      fieldsMissing: Object.keys(FIELD_PATTERNS).filter(
        f => !discoveredSelectors.find(s => s.field === f)
      ),
    });
  } catch (error: any) {
    console.error('Selector discovery error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Helper: Simple HTML element finder (no DOM parser needed for basic cases)
function findBySelector(html: string, selector: string): string[] {
  const matches: string[] = [];
  
  // Handle simple selectors
  if (selector.startsWith('[itemprop=')) {
    const prop = selector.match(/\[itemprop=['"]?(\w+)['"]?\]/)?.[1];
    if (prop) {
      const regex = new RegExp(`<[^>]+itemprop=["']?${prop}["']?[^>]*>([^<]+)</`, 'gi');
      let match;
      while ((match = regex.exec(html)) !== null) {
        matches.push(match[0]);
      }
    }
  } else if (selector.startsWith("a[href^='tel:']")) {
    const regex = /<a[^>]+href=["']tel:([^"']+)["'][^>]*>([^<]*)</gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      matches.push(`<a href="tel:${match[1]}">${match[2]}</a>`);
    }
  } else if (selector.startsWith("a[href^='mailto:']")) {
    const regex = /<a[^>]+href=["']mailto:([^"']+)["'][^>]*>([^<]*)</gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      matches.push(`<a href="mailto:${match[1]}">${match[2]}</a>`);
    }
  } else if (selector.startsWith('.')) {
    const className = selector.slice(1);
    const regex = new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([^<]+)</`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      matches.push(match[0]);
    }
  } else if (selector.includes('[class*=')) {
    const partial = selector.match(/\[class\*=['"]?(\w+)['"]?\]/)?.[1];
    if (partial) {
      const regex = new RegExp(`<[^>]+class=["'][^"']*${partial}[^"']*["'][^>]*>([^<]+)</`, 'gi');
      let match;
      while ((match = regex.exec(html)) !== null) {
        matches.push(match[0]);
      }
    }
  } else if (selector === 'h1') {
    const regex = /<h1[^>]*>([^<]+)</gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      matches.push(match[0]);
    }
  }
  
  return matches;
}

function extractValue(html: string, pattern: any): string {
  if (pattern.extract === 'text') {
    const match = html.match(/>([^<]+)</);
    return match ? match[1].trim() : '';
  } else if (pattern.extract === 'href') {
    if (pattern.transform === 'stripTel') {
      const match = html.match(/href=["']tel:([^"']+)["']/);
      return match ? match[1] : '';
    } else if (pattern.transform === 'stripMailto') {
      const match = html.match(/href=["']mailto:([^"']+)["']/);
      return match ? match[1] : '';
    }
  } else if (pattern.extract?.startsWith('attr:')) {
    const attrName = pattern.extract.slice(5);
    const regex = new RegExp(`${attrName}=["']([^"']+)["']`);
    const match = html.match(regex);
    return match ? match[1] : '';
  }
  return '';
}

function formatSelector(pattern: any): string {
  const selector = pattern.selector || '';
  if (!selector) return '';
  
  if (pattern.extract === 'text') {
    return selector + '::text';
  } else if (pattern.extract === 'href') {
    return selector + '::attr(href)';
  } else if (pattern.extract?.startsWith('attr:')) {
    return selector + `::attr(${pattern.extract.slice(5)})`;
  }
  return selector;
}

function isValidValue(field: string, value: string): boolean {
  if (!value || value.trim().length === 0) return false;
  
  switch (field) {
    case 'phone':
      // Must have at least 10 digits
      return value.replace(/\D/g, '').length >= 10;
    case 'email':
      return value.includes('@') && value.includes('.');
    case 'age':
      const age = parseInt(value.replace(/\D/g, ''));
      return age >= 18 && age <= 120;
    case 'zipcode':
      return /^\d{5}(-\d{4})?$/.test(value.trim());
    default:
      return value.length > 1;
  }
}

function cleanValue(field: string, value: string): string {
  switch (field) {
    case 'phone':
      // Normalize phone format
      const digits = value.replace(/\D/g, '');
      if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
      if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
      return value;
    case 'age':
      return value.replace(/\D/g, '');
    default:
      return value.trim();
  }
}

function calculateConfidence(field: string, value: string, selector: string): number {
  let confidence = 0.5; // Base confidence
  
  // Microdata selectors are high confidence
  if (selector.includes('itemprop')) confidence += 0.3;
  
  // Class names matching field are medium confidence
  if (selector.includes(field)) confidence += 0.2;
  
  // tel: and mailto: links are high confidence
  if (selector.includes("tel:") || selector.includes("mailto:")) confidence += 0.3;
  
  // Value validation boosts confidence
  if (isValidValue(field, value)) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}
