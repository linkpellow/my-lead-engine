/**
 * Semantic Translator - Raw HTML/Traffic -> Semantic Blueprint (JSON-LD).
 *
 * POST /api/dojo/translate
 * Body: { html?, traffic?, goal? }
 *
 * SLM/LLM produces a Semantic Blueprint (intents + visual anchors) instead of CSS selectors.
 * Output: JSON-LD with @type, intents[], visualAnchors[].
 */

import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const USE_MOCK = !OPENAI_API_KEY || process.env.DOJO_MOCK_AI === 'true';

interface SemanticIntent {
  id: string;
  description: string;
  '@type'?: string;
}

interface VisualAnchor {
  id: string;
  intentId: string;
  description: string;
  regionHint?: string;
}

interface SemanticBlueprint {
  '@context'?: string;
  '@type'?: string;
  intents: SemanticIntent[];
  visualAnchors: VisualAnchor[];
  domain?: string;
}

async function translateWithOpenAI(body: { html?: string; traffic?: string; goal?: string }): Promise<SemanticBlueprint> {
  const prompt = `You are a Semantic Mapper. Given raw HTML or traffic, output a JSON-LD Semantic Blueprint.

Input HTML (excerpt): ${(body.html || '').slice(0, 12000)}
Input goal: ${body.goal || 'Extract contact and profile data'}

Output a JSON object with:
- "intents": [ { "id": "find_primary_action", "description": "Find the primary action button" }, ... ]
- "visualAnchors": [ { "id": "va1", "intentId": "find_primary_action", "description": "Primary CTA, often green or blue" }, ... ]

Describe intent and visual anchors in natural language, NOT CSS selectors. Example: "the primary mobile phone number", "header containing the word Contact".
Respond with ONLY valid JSON, no markdown.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI: ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  const cleaned = raw.replace(/^```\w*\n?|\n?```$/g, '').trim();
  return JSON.parse(cleaned) as SemanticBlueprint;
}

function mockTranslate(_body: { html?: string; traffic?: string; goal?: string }): SemanticBlueprint {
  return {
    '@context': 'https://schema.org',
    '@type': 'SemanticBlueprint',
    intents: [
      { id: 'find_phone', description: 'Find the primary mobile phone number' },
      { id: 'find_age', description: 'Find the age or date of birth' },
      { id: 'find_income', description: 'Find the income or salary' },
    ],
    visualAnchors: [
      { id: 'va1', intentId: 'find_phone', description: 'Phone numbers on people-search sites are usually under a header containing the word Contact' },
      { id: 'va2', intentId: 'find_age', description: 'Age or DOB often near a "Personal Details" or "Background" section' },
      { id: 'va3', intentId: 'find_income', description: 'Income or household data in a "Wealth" or "Financial" block' },
    ],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const out = USE_MOCK
      ? mockTranslate(body)
      : await translateWithOpenAI(body);
    return NextResponse.json({ success: true, semanticBlueprint: out, mock: USE_MOCK });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Translate failed' }, { status: 500 });
  }
}
