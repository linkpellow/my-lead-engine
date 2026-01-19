/**
 * Inngest Client and Event Definitions
 *
 * No-op implementation: events are logged only; no Inngest worker runs.
 * Callers must not rely on background execution. For production, integrate
 * the Inngest SDK and deploy Inngest workers.
 */
export const inngest = {
  /** implemented: false — no event is enqueued; no worker will run. */
  send: async (event: { name: string; data: unknown; ts?: number }) => {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.log('[inngest] Event logged (no worker):', event.name, {
        scheduled: event.ts ? new Date(event.ts).toISOString() : 'immediate',
      });
    }
    return { ids: [`noop-${Date.now()}`], implemented: false };
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
