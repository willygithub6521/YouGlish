import { Request, Response, NextFunction } from 'express';

/**
 * HTTP Cache-Control headers middleware (Task 12.2)
 *
 * Adds appropriate caching headers to API responses to allow CDN and
 * browser caches to store responses and reduce server load.
 *
 * Cache strategy:
 *  - Search results:      Cache-Control: public, max-age=300, s-maxage=600
 *                         (5 min browser / 10 min CDN — results are relatively stable)
 *  - Suggestions:         Cache-Control: public, max-age=600, s-maxage=1800
 *                         (10 min browser / 30 min CDN — suggestions change rarely)
 *  - Stats:               Cache-Control: public, max-age=3600, s-maxage=7200
 *                         (1 hour / 2 hour — index stats are very stable)
 *  - Video endpoints:     Cache-Control: public, max-age=1800, s-maxage=3600
 *                         (30 min / 1 hour)
 *  - Default (other GET): Cache-Control: no-store
 */
export function cacheHeaders(
  maxAge: number,
  sMaxAge?: number,
  staleWhileRevalidate?: number
) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const parts = [
      'public',
      `max-age=${maxAge}`,
    ];
    if (sMaxAge !== undefined) parts.push(`s-maxage=${sMaxAge}`);
    if (staleWhileRevalidate !== undefined) {
      parts.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }
    res.setHeader('Cache-Control', parts.join(', '));
    // Vary on Accept-Encoding so compressed and uncompressed responses are
    // stored separately in CDN caches
    res.setHeader('Vary', 'Accept-Encoding');
    next();
  };
}

/** Pre-configured cache presets */
export const cache = {
  /** For GET /api/search results */
  searchResults: cacheHeaders(300, 600, 60),
  /** For GET /api/search/suggestions */
  suggestions: cacheHeaders(600, 1800, 120),
  /** For GET /api/search/stats */
  stats: cacheHeaders(3600, 7200),
  /** For GET /api/videos/* */
  video: cacheHeaders(1800, 3600, 300),
  /** No caching (mutations, health checks) */
  noStore: (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  },
};
