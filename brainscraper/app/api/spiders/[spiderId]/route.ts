import { NextRequest, NextResponse } from 'next/server';

/**
 * Spider Fleet API - Individual Spider Operations
 * 
 * GET /api/spiders/[spiderId] - Get spider details
 * DELETE /api/spiders/[spiderId] - Archive spider
 */

const SCRAPEGOAT_URL = process.env.SCRAPEGOAT_API_URL || process.env.SCRAPEGOAT_URL || '';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spiderId: string }> }
) {
  try {
    const { spiderId } = await params;

    if (!SCRAPEGOAT_URL) {
      return NextResponse.json(
        { error: 'Scrapegoat not configured' },
        { status: 503 }
      );
    }

    const response = await fetch(`${SCRAPEGOAT_URL}/spiders/${spiderId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: `Spider '${spiderId}' not found` },
          { status: 404 }
        );
      }
      throw new Error(`Scrapegoat responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Spider API] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch spider' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ spiderId: string }> }
) {
  try {
    const { spiderId } = await params;

    if (!SCRAPEGOAT_URL) {
      return NextResponse.json(
        { error: 'Scrapegoat not configured' },
        { status: 503 }
      );
    }

    const response = await fetch(`${SCRAPEGOAT_URL}/spiders/${spiderId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: `Spider '${spiderId}' not found` },
          { status: 404 }
        );
      }
      throw new Error(`Scrapegoat responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Spider API] DELETE Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to archive spider' },
      { status: 500 }
    );
  }
}
