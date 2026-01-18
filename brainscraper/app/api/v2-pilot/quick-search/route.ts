import { NextRequest, NextResponse } from 'next/server';

/**
 * V2 PILOT - QUICK SEARCH API
 * 
 * Simplified interface to LinkedIn Sales Navigator RapidAPI
 * Generates real leads and pushes them directly to Chimera swarm
 * 
 * This endpoint bridges the existing LinkedIn API with V2 Pilot,
 * allowing quick testing with real data instead of manual input
 */

interface QuickSearchParams {
  location?: string;
  jobTitle?: string;
  companyName?: string;
  limit?: number;
}

export async function POST(request: NextRequest) {
  try {
    const params = await request.json() as QuickSearchParams;
    
    // Validate at least one search parameter
    if (!params.location && !params.jobTitle && !params.companyName) {
      return NextResponse.json(
        {
          error: 'Invalid parameters',
          message: 'At least one search parameter required (location, jobTitle, or companyName)'
        },
        { status: 400 }
      );
    }

    // Build LinkedIn Sales Navigator API request
    const linkedInParams: Record<string, unknown> = {
      endpoint: 'premium_search_person',
      page: 1,
      limit: params.limit || 25, // Default to 25 leads
    };

    // Map V2 Pilot parameters to LinkedIn API parameters
    if (params.location) {
      linkedInParams.location = params.location;
    }

    if (params.jobTitle) {
      linkedInParams.jobTitle = params.jobTitle;
    }

    if (params.companyName) {
      linkedInParams.companyName = params.companyName;
    }

    console.log('[V2_PILOT_QUICK_SEARCH] Calling LinkedIn API with params:', linkedInParams);

    // Import the LinkedIn handler directly instead of using fetch
    // This avoids SSL issues with internal API calls
    const { POST: linkedInHandler } = await import('@/app/api/linkedin-sales-navigator/route');
    
    // Create a mock request with the LinkedIn params
    const mockRequest = {
      json: async () => linkedInParams,
      nextUrl: request.nextUrl,
    } as NextRequest;

    const linkedInResponse = await linkedInHandler(mockRequest);
    const linkedInResult = await linkedInResponse.json();

    // Check for error response
    if (linkedInResponse.status !== 200) {
      console.error('[V2_PILOT_QUICK_SEARCH] LinkedIn API error:', linkedInResult);
      return NextResponse.json(
        {
          error: 'LinkedIn API error',
          message: linkedInResult.message || linkedInResult.error || 'Failed to fetch leads',
          details: linkedInResult,
        },
        { status: linkedInResponse.status }
      );
    }

    // Extract leads from response
    const leads = linkedInResult.results || linkedInResult.data || [];
    
    if (leads.length === 0) {
      return NextResponse.json(
        {
          success: true,
          leads: [],
          count: 0,
          message: 'No leads found matching search criteria',
        }
      );
    }

    // Format leads for V2 Pilot
    const formattedLeads = leads.map((lead: any) => ({
      name: lead.fullName || lead.name || 'Unknown',
      location: lead.geoRegion || lead.location || 'Unknown',
      linkedinUrl: lead.profileUrl || lead.linkedinUrl || lead.url || '',
      title: lead.currentPosition?.title || lead.title || lead.headline || '',
      company: lead.currentPosition?.companyName || lead.companyName || lead.company || '',
      profilePictureUrl: lead.profilePictureUrl || lead.picture || '',
      headline: lead.headline || '',
    }));

    console.log(`[V2_PILOT_QUICK_SEARCH] ✅ Found ${formattedLeads.length} leads`);

    return NextResponse.json({
      success: true,
      leads: formattedLeads,
      count: formattedLeads.length,
      searchParams: params,
      totalResults: linkedInResult.totalResults || linkedInResult.total || formattedLeads.length,
    });

  } catch (error) {
    console.error('[V2_PILOT_QUICK_SEARCH] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
