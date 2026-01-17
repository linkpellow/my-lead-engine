import { NextRequest, NextResponse } from 'next/server';

/**
 * The Dojo - AI Analysis API
 * 
 * Analyzes captured HTTP requests using LLM to identify:
 * - Relevant data fields
 * - Dynamic parameters
 * - Code snippets for extraction
 * - TypeScript/Pydantic schema generation
 */

// Analysis result interface
export interface AnalysisResult {
  relevanceScore: number; // 0-100
  summary: string;
  isGoldenRoute: boolean;
  extractedFields: string[];
  dynamicParameters: Array<{
    name: string;
    location: 'url' | 'header' | 'body' | 'query';
    example: string;
  }>;
  codeSnippet?: string;
  schema?: {
    typescript?: string;
    pydantic?: string;
  };
  warnings?: string[];
}

// Request payload interface
interface AnalyzePayload {
  request: {
    id: string;
    url: string;
    method: string;
    status: number;
    headers?: Record<string, string>;
    requestBody?: string;
    responseBody?: string;
  };
  goal: string;
  mode?: 'analyze' | 'blueprint'; // Default: analyze
  generateSchema?: 'typescript' | 'pydantic' | 'both';
}

// Blueprint result interface
export interface BlueprintResult {
  id: string;
  filename: string;
  targetUrl: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: unknown;
  responseModelName: string;
  pydanticModels: string;
  extractionLogic: string;
  dynamicParams: string[];
  createdAt: number;
}

// Check if OpenAI API key is configured
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const USE_MOCK = !OPENAI_API_KEY || process.env.DOJO_MOCK_AI === 'true';

/**
 * Build the system prompt for the reverse engineering AI
 */
function buildSystemPrompt(): string {
  return `You are an expert Reverse Engineer and API analyst. Your job is to analyze HTTP request/response data captured from web applications.

When analyzing traffic, you should:
1. Identify if the endpoint contains data relevant to the user's stated goal
2. Extract field names that contain useful information (emails, names, IDs, etc.)
3. Identify dynamic parameters that need to be handled (auth tokens, session IDs, pagination cursors)
4. Determine if this is a "Golden Route" - a high-value endpoint that directly serves the user's goal
5. Generate working code snippets when applicable

Be precise, technical, and actionable. Focus on practical extraction patterns.

IMPORTANT: Respond with valid JSON matching this exact schema:
{
  "relevanceScore": <number 0-100>,
  "summary": "<brief technical summary>",
  "isGoldenRoute": <boolean>,
  "extractedFields": ["<field1>", "<field2>"],
  "dynamicParameters": [
    { "name": "<param>", "location": "<url|header|body|query>", "example": "<value>" }
  ],
  "codeSnippet": "<optional fetch/axios code>",
  "warnings": ["<optional warnings>"]
}`;
}

/**
 * Build the system prompt for Blueprint generation
 */
function buildBlueprintSystemPrompt(): string {
  return `You are a Principal Software Architect specializing in web scraping and API integration.

Your task is to analyze an HTTP request/response and generate a complete "Scraper Blueprint" that can be used to create a production-ready Python spider.

CRITICAL REQUIREMENTS:

1. **Filter Headers**: Keep ONLY authentication/session headers:
   - Cookie, Authorization, X-Csrf-Token, X-Li-Track, etc.
   - DISCARD standard browser headers: User-Agent, Accept, Accept-Language, etc.

2. **Generate Pydantic Models**: Write COMPLETE Python Pydantic classes to parse the response JSON.
   - Use proper Python types (str, int, List, Optional)
   - Include nested models for complex structures
   - Add field descriptions where helpful

3. **Identify Dynamic Parameters**: Find URL segments or query params that change per request (IDs, cursors, etc.)

4. **Create Extraction Logic**: Write JSONPath expressions or Python code to extract key data.

IMPORTANT: Respond with valid JSON matching this exact schema:
{
  "id": "<snake_case_identifier>",
  "filename": "<identifier>_spider.py",
  "targetUrl": "<url with {placeholders} for dynamic params>",
  "method": "GET" | "POST",
  "headers": { "<only essential auth headers>" },
  "body": <optional POST body as object>,
  "responseModelName": "<PascalCaseModelName>",
  "pydanticModels": "<complete Python code for all Pydantic models>",
  "extractionLogic": "<JSONPath or extraction code>",
  "dynamicParams": ["<param1>", "<param2>"]
}`;
}

/**
 * Build the user prompt for Blueprint mode
 */
function buildBlueprintUserPrompt(payload: AnalyzePayload): string {
  const { request, goal } = payload;
  
  let prompt = `## Goal
${goal}

## HTTP Request
- URL: ${request.url}
- Method: ${request.method}
- Status: ${request.status}
`;

  if (request.headers && Object.keys(request.headers).length > 0) {
    prompt += `\n## Request Headers\n\`\`\`json\n${JSON.stringify(request.headers, null, 2)}\n\`\`\`\n`;
  }

  if (request.requestBody) {
    prompt += `\n## Request Body\n\`\`\`json\n${request.requestBody.substring(0, 3000)}\n\`\`\`\n`;
  }

  if (request.responseBody) {
    prompt += `\n## Response Body (sample)\n\`\`\`json\n${request.responseBody.substring(0, 8000)}\n\`\`\`\n`;
  }

  prompt += `\nGenerate a complete ScraperBlueprint for this endpoint. Include full Pydantic models.`;

  return prompt;
}

/**
 * Generate Blueprint using OpenAI
 */
async function generateBlueprintWithOpenAI(payload: AnalyzePayload): Promise<BlueprintResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildBlueprintSystemPrompt() },
        { role: 'user', content: buildBlueprintUserPrompt(payload) },
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const result = JSON.parse(content) as BlueprintResult;
  result.createdAt = Date.now();
  
  return result;
}

/**
 * Mock Blueprint generation
 */
async function mockGenerateBlueprint(payload: AnalyzePayload): Promise<BlueprintResult> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const url = new URL(payload.request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const endpointName = pathParts[pathParts.length - 1] || 'api';
  const domain = url.hostname.replace('www.', '').split('.')[0];
  const id = `${domain}_${endpointName}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  // Find dynamic params (UUIDs, numbers in path)
  const dynamicParams: string[] = [];
  pathParts.forEach((part, i) => {
    if (/^[a-f0-9-]{20,}$/i.test(part) || /^\d+$/.test(part)) {
      dynamicParams.push(`param_${i}`);
    }
  });

  // Filter to essential headers
  const essentialHeaders: Record<string, string> = {};
  if (payload.request.headers) {
    const keepHeaders = ['cookie', 'authorization', 'x-csrf-token', 'x-li-track', 'x-restli-protocol-version'];
    Object.entries(payload.request.headers).forEach(([key, value]) => {
      if (keepHeaders.some(h => key.toLowerCase().includes(h))) {
        essentialHeaders[key] = value.substring(0, 50) + '...';
      }
    });
  }

  const modelName = `${domain.charAt(0).toUpperCase() + domain.slice(1)}${endpointName.charAt(0).toUpperCase() + endpointName.slice(1)}Response`;

  return {
    id,
    filename: `${id}_spider.py`,
    targetUrl: payload.request.url.replace(/[a-f0-9-]{20,}/gi, '{profile_id}').replace(/\/\d+/g, '/{item_id}'),
    method: payload.request.method as 'GET' | 'POST',
    headers: essentialHeaders,
    body: payload.request.requestBody ? JSON.parse(payload.request.requestBody) : undefined,
    responseModelName: modelName,
    pydanticModels: `from pydantic import BaseModel
from typing import Optional, List

class ${modelName}Item(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    # Add more fields based on response

class ${modelName}(BaseModel):
    data: List[${modelName}Item]
    total: Optional[int] = None
    cursor: Optional[str] = None`,
    extractionLogic: `# Extract items from response
items = response.data
for item in items:
    yield {
        "id": item.id,
        "name": item.name,
        "email": item.email,
    }`,
    dynamicParams,
    createdAt: Date.now(),
  };
}

/**
 * Build the user prompt with request context
 */
function buildUserPrompt(payload: AnalyzePayload): string {
  const { request, goal } = payload;
  
  let prompt = `## User's Goal
${goal}

## HTTP Request Details
- URL: ${request.url}
- Method: ${request.method}
- Status: ${request.status}
`;

  if (request.headers && Object.keys(request.headers).length > 0) {
    // Filter sensitive headers
    const safeHeaders = Object.entries(request.headers)
      .filter(([key]) => !key.toLowerCase().includes('cookie'))
      .filter(([key]) => !key.toLowerCase().includes('authorization'))
      .slice(0, 10);
    
    if (safeHeaders.length > 0) {
      prompt += `\n## Response Headers (sample)\n`;
      safeHeaders.forEach(([key, value]) => {
        prompt += `${key}: ${value.substring(0, 100)}\n`;
      });
    }
  }

  if (request.requestBody) {
    prompt += `\n## Request Body\n\`\`\`json\n${request.requestBody.substring(0, 2000)}\n\`\`\`\n`;
  }

  if (request.responseBody) {
    prompt += `\n## Response Body\n\`\`\`json\n${request.responseBody.substring(0, 5000)}\n\`\`\`\n`;
  }

  prompt += `\nAnalyze this request and determine its relevance to the user's goal. Identify extractable fields and dynamic parameters.`;

  return prompt;
}

/**
 * Call OpenAI API for analysis
 */
async function analyzeWithOpenAI(payload: AnalyzePayload): Promise<AnalysisResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(payload) },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const result = JSON.parse(content) as AnalysisResult;
  
  // Generate schema if requested
  if (payload.generateSchema && payload.request.responseBody) {
    result.schema = await generateSchema(
      payload.request.responseBody,
      payload.generateSchema
    );
  }

  return result;
}

/**
 * Generate TypeScript/Pydantic schema from JSON response
 */
async function generateSchema(
  responseBody: string,
  format: 'typescript' | 'pydantic' | 'both'
): Promise<{ typescript?: string; pydantic?: string }> {
  // Parse the response body to understand its structure
  let jsonData: unknown;
  try {
    jsonData = JSON.parse(responseBody);
  } catch {
    return {};
  }

  const schema: { typescript?: string; pydantic?: string } = {};

  if (format === 'typescript' || format === 'both') {
    schema.typescript = generateTypeScriptInterface(jsonData, 'ApiResponse');
  }

  if (format === 'pydantic' || format === 'both') {
    schema.pydantic = generatePydanticModel(jsonData, 'ApiResponse');
  }

  return schema;
}

/**
 * Generate TypeScript interface from JSON object
 */
function generateTypeScriptInterface(obj: unknown, name: string, indent = 0): string {
  const spaces = '  '.repeat(indent);
  
  if (obj === null) return 'null';
  if (typeof obj === 'string') return 'string';
  if (typeof obj === 'number') return 'number';
  if (typeof obj === 'boolean') return 'boolean';
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return 'unknown[]';
    const itemType = generateTypeScriptInterface(obj[0], `${name}Item`, indent);
    return `${itemType}[]`;
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return 'Record<string, unknown>';
    
    let result = `{\n`;
    for (const [key, value] of entries) {
      const safeKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : `"${key}"`;
      const valueType = generateTypeScriptInterface(value, `${name}${capitalize(key)}`, indent + 1);
      result += `${spaces}  ${safeKey}: ${valueType};\n`;
    }
    result += `${spaces}}`;
    return result;
  }
  
  return 'unknown';
}

/**
 * Generate Pydantic model from JSON object
 */
function generatePydanticModel(obj: unknown, name: string): string {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return `# Unable to generate model from non-object type\n`;
  }

  const entries = Object.entries(obj as Record<string, unknown>);
  let result = `from pydantic import BaseModel\nfrom typing import Optional, List, Any\n\n`;
  result += `class ${name}(BaseModel):\n`;
  
  for (const [key, value] of entries) {
    const pyType = getPythonType(value);
    result += `    ${key}: ${pyType}\n`;
  }
  
  return result;
}

function getPythonType(value: unknown): string {
  if (value === null) return 'Optional[Any]';
  if (typeof value === 'string') return 'str';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
  if (typeof value === 'boolean') return 'bool';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'List[Any]';
    return `List[${getPythonType(value[0])}]`;
  }
  if (typeof value === 'object') return 'dict';
  return 'Any';
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Mock analysis for development/testing
 */
async function mockAnalyze(payload: AnalyzePayload): Promise<AnalysisResult> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const url = payload.request.url.toLowerCase();
  const goal = payload.goal.toLowerCase();
  
  // Intelligent mock based on URL patterns
  const isProfileEndpoint = url.includes('profile') || url.includes('identity');
  const isSearchEndpoint = url.includes('search') || url.includes('blended');
  const isGraphQL = url.includes('graphql');
  const isMessaging = url.includes('message') || url.includes('inbox');
  
  const wantsEmail = goal.includes('email');
  const wantsPhone = goal.includes('phone');
  const wantsContacts = goal.includes('contact');
  
  let relevanceScore = 30;
  let extractedFields: string[] = [];
  let isGoldenRoute = false;
  let summary = 'Standard API endpoint with structured data.';
  
  if (isProfileEndpoint && (wantsEmail || wantsContacts)) {
    relevanceScore = 92;
    extractedFields = ['email', 'phoneNumbers', 'firstName', 'lastName', 'headline'];
    isGoldenRoute = true;
    summary = '🎯 HIGH VALUE: Profile endpoint contains contact information. Email found in data.contactInfo.emailAddress';
  } else if (isSearchEndpoint) {
    relevanceScore = 75;
    extractedFields = ['profileId', 'name', 'headline', 'location'];
    summary = 'Search results with profile identifiers. Use these IDs to fetch full profiles.';
  } else if (isGraphQL) {
    relevanceScore = 68;
    extractedFields = ['data', 'edges', 'node'];
    summary = 'GraphQL endpoint. Requires query analysis to determine available fields.';
  } else if (isMessaging) {
    relevanceScore = 25;
    extractedFields = [];
    summary = '⚠️ Messaging endpoint - typically heavily protected. May require session auth.';
  }
  
  const result: AnalysisResult = {
    relevanceScore,
    summary,
    isGoldenRoute,
    extractedFields,
    dynamicParameters: [
      { name: 'profileId', location: 'url', example: 'ACoAABxxxxxx' },
      { name: 'csrf_token', location: 'header', example: 'ajax:123456789' },
    ],
    codeSnippet: isGoldenRoute ? `// Extract email from profile response
const response = await fetch('${payload.request.url}', {
  headers: {
    'csrf-token': csrf_token,
    'x-li-lang': 'en_US',
  }
});
const data = await response.json();
const email = data.contactInfo?.emailAddress;` : undefined,
    warnings: payload.request.status >= 400 
      ? [`Endpoint returned ${payload.request.status} - may be rate limited or require auth`]
      : undefined,
  };

  // Generate schema if requested
  if (payload.generateSchema && payload.request.responseBody) {
    result.schema = await generateSchema(
      payload.request.responseBody,
      payload.generateSchema
    );
  }

  return result;
}

/**
 * POST /api/dojo/analyze
 * Analyze a captured request with AI
 */
export async function POST(request: NextRequest) {
  try {
    const payload: AnalyzePayload = await request.json();
    
    // Validate required fields
    if (!payload.request?.url || !payload.goal) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: request.url, goal' },
        { status: 400 }
      );
    }

    // Blueprint mode
    if (payload.mode === 'blueprint') {
      let blueprint: BlueprintResult;
      
      if (USE_MOCK) {
        console.log('[Dojo Blueprint] Using mock generation');
        blueprint = await mockGenerateBlueprint(payload);
      } else {
        console.log('[Dojo Blueprint] Calling OpenAI API');
        blueprint = await generateBlueprintWithOpenAI(payload);
      }

      return NextResponse.json({
        success: true,
        blueprint,
        mock: USE_MOCK,
      });
    }

    // Default: Analysis mode
    let result: AnalysisResult;
    
    if (USE_MOCK) {
      console.log('[Dojo Analyze] Using mock analysis (no OPENAI_API_KEY)');
      result = await mockAnalyze(payload);
    } else {
      console.log('[Dojo Analyze] Calling OpenAI API');
      result = await analyzeWithOpenAI(payload);
    }

    return NextResponse.json({
      success: true,
      analysis: result,
      mock: USE_MOCK,
    });
  } catch (error) {
    console.error('[Dojo Analyze] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Analysis failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/dojo/analyze
 * Check if AI analysis is available
 */
export async function GET() {
  return NextResponse.json({
    available: true,
    provider: USE_MOCK ? 'mock' : 'openai',
    features: ['analysis', 'schema-generation', 'code-snippets'],
  });
}
