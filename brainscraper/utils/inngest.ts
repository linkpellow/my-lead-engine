/**
 * Inngest Client and Event Definitions
 * 
 * Stub implementation for background job processing
 * In production, this would connect to Inngest cloud service
 */

/**
 * Inngest client stub
 * In production, this would be: import { Inngest } from 'inngest';
 */
export const inngest = {
  send: async (event: { name: string; data: any; ts?: number }) => {
    // Stub implementation - in production this would send to Inngest
    console.log('[inngest] Event sent:', event.name, {
      data: event.data,
      scheduled: event.ts ? new Date(event.ts).toISOString() : 'immediate',
    });
    
    // For now, we'll just log the event
    // In production, this would be:
    // return await inngestClient.send(event);
    
    return { ids: [`stub-${Date.now()}`] };
  },
};

/**
 * Event names for enrichment jobs
 */
export const enrichmentEvents = {
  enrichLeads: 'jobs/enrichment.enrich',
};

/**
 * Event names for scraping jobs
 */
export const scrapingEvents = {
  scrapeLinkedIn: 'jobs/scraping.linkedin',
  scrapeProfile: 'jobs/scraping.profile',
};
