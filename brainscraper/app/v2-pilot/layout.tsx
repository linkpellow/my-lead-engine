/**
 * v2-pilot layout: force dynamic and avoid static caching so deploys and version
 * badge updates are visible without stale HTML/ RSC payload.
 */
export const dynamic = 'force-dynamic';

export default function V2PilotLayout({ children }: { children: React.ReactNode }) {
  return children;
}
