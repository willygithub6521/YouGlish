import { CacheService } from './cacheService.js';
import { RedisConnection } from './config.js';
import { createLogger } from '../utils/logger.js';
import type { SearchParams, SearchResponse, Accent } from '../types/index.js';

const logger = createLogger();

// ──────────────────────────────────────────────────────────────────
// TTL constants (seconds)
// ──────────────────────────────────────────────────────────────────
export const CACHE_TTL = {
  SEARCH_RESULTS: 60 * 60,        // 1 hour
  SUGGESTIONS: 24 * 60 * 60,      // 24 hours
  VIDEO_METADATA: 24 * 60 * 60,   // 24 hours
  VIDEO_SUBTITLES: 24 * 60 * 60,  // 24 hours
  ACCENT_COUNTS: 60 * 60,         // 1 hour
  SEARCH_STATS: 60 * 60,          // 1 hour
  POPULAR_SEARCHES: 30 * 60,      // 30 minutes
} as const;

// ──────────────────────────────────────────────────────────────────
// Domain-aware cache key builder
// ──────────────────────────────────────────────────────────────────
export const CacheKeys = {
  searchResults: (params: SearchParams): string => {
    const { query, accent = 'ALL', fuzzy = true, limit = 20, offset = 0 } = params;
    return `search:${query.toLowerCase().trim()}:${accent}:${fuzzy ? 1 : 0}:${limit}:${offset}`;
  },

  exactPhrase: (phrase: string, accent: string | undefined, limit: number): string =>
    `exact:${phrase.toLowerCase().trim()}:${accent || 'ALL'}:${limit}`,

  suggestions: (prefix: string, limit: number): string =>
    `suggestions:${prefix.toLowerCase().trim()}:${limit}`,

  videoMetadata: (videoId: string): string => `video:${videoId}:metadata`,

  videoSubtitles: (videoId: string, limit?: number, offset?: number): string =>
    `video:${videoId}:subtitles:${limit ?? 100}:${offset ?? 0}`,

  accentCounts: (): string => 'video:accent:counts',

  searchStats: (): string => 'search:stats',

  popularSearches: (): string => 'search:popular',
};

// ──────────────────────────────────────────────────────────────────
// Cache statistics tracker
// ──────────────────────────────────────────────────────────────────
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  byDomain: Record<string, { hits: number; misses: number }>;
}

class InMemoryStatsTracker {
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    byDomain: {} as Record<string, { hits: number; misses: number }>,
  };

  recordHit(domain: string): void {
    this.stats.hits++;
    this.initDomain(domain);
    this.stats.byDomain[domain].hits++;
  }

  recordMiss(domain: string): void {
    this.stats.misses++;
    this.initDomain(domain);
    this.stats.byDomain[domain].misses++;
  }

  recordEviction(): void {
    this.stats.evictions++;
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total === 0 ? 0 : Math.round((this.stats.hits / total) * 10000) / 100,
      evictions: this.stats.evictions,
      byDomain: { ...this.stats.byDomain },
    };
  }

  reset(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0, byDomain: {} };
  }

  private initDomain(domain: string): void {
    if (!this.stats.byDomain[domain]) {
      this.stats.byDomain[domain] = { hits: 0, misses: 0 };
    }
  }
}

// ──────────────────────────────────────────────────────────────────
// CacheManager – unified caching layer
// ──────────────────────────────────────────────────────────────────

/**
 * CacheManager provides a unified, domain-aware caching layer.
 *
 * Responsibilities:
 * - Task 7.1: search result caching with consistent TTL and key strategy
 * - Task 7.2: video metadata caching, cache warming, statistics
 */
export class CacheManager {
  private cache: CacheService;
  private stats: InMemoryStatsTracker;

  constructor(redisConnection: RedisConnection) {
    this.cache = new CacheService(redisConnection);
    this.stats = new InMemoryStatsTracker();
  }

  // ──────────────────────────────────────────────────────────
  // 7.1 Search result caching
  // ──────────────────────────────────────────────────────────

  /**
   * Get cached search results
   */
  async getSearchResults(params: SearchParams): Promise<SearchResponse | null> {
    const key = CacheKeys.searchResults(params);
    const result = await this.cache.get<SearchResponse>(key);
    result ? this.stats.recordHit('search') : this.stats.recordMiss('search');
    if (result) logger.debug(`Cache HIT: search "${params.query}"`);
    return result;
  }

  /**
   * Cache search results
   */
  async setSearchResults(params: SearchParams, value: SearchResponse): Promise<void> {
    const key = CacheKeys.searchResults(params);
    await this.cache.set(key, value, { ttl: CACHE_TTL.SEARCH_RESULTS });
    logger.debug(`Cache SET: search "${params.query}" (TTL ${CACHE_TTL.SEARCH_RESULTS}s)`);
  }

  /**
   * Get cached suggestions
   */
  async getSuggestions(prefix: string, limit: number): Promise<string[] | null> {
    const key = CacheKeys.suggestions(prefix, limit);
    const result = await this.cache.get<string[]>(key);
    result ? this.stats.recordHit('suggestions') : this.stats.recordMiss('suggestions');
    return result;
  }

  /**
   * Cache suggestions
   */
  async setSuggestions(prefix: string, limit: number, value: string[]): Promise<void> {
    const key = CacheKeys.suggestions(prefix, limit);
    await this.cache.set(key, value, { ttl: CACHE_TTL.SUGGESTIONS });
  }

  /**
   * Invalidate all search-related caches
   */
  async invalidateSearchCache(queryPattern?: string): Promise<void> {
    const patterns = queryPattern
      ? [`search:${queryPattern}*`, `suggestions:*`, `exact:${queryPattern}*`]
      : ['search:*', 'suggestions:*', 'exact:*', CacheKeys.searchStats()];

    let total = 0;
    for (const pattern of patterns) {
      total += await this.cache.invalidate(pattern);
    }
    this.stats.recordEviction();
    logger.info(`Invalidated ${total} search cache entries`);
  }

  // ──────────────────────────────────────────────────────────
  // 7.2 Video metadata caching
  // ──────────────────────────────────────────────────────────

  /**
   * Get cached video metadata
   */
  async getVideoMetadata<T>(videoId: string): Promise<T | null> {
    const key = CacheKeys.videoMetadata(videoId);
    const result = await this.cache.get<T>(key);
    result ? this.stats.recordHit('video') : this.stats.recordMiss('video');
    return result;
  }

  /**
   * Cache video metadata
   */
  async setVideoMetadata<T>(videoId: string, value: T): Promise<void> {
    const key = CacheKeys.videoMetadata(videoId);
    await this.cache.set(key, value, { ttl: CACHE_TTL.VIDEO_METADATA });
    logger.debug(`Cache SET: video metadata ${videoId}`);
  }

  /**
   * Get cached video subtitles
   */
  async getVideoSubtitles<T>(videoId: string, limit?: number, offset?: number): Promise<T | null> {
    const key = CacheKeys.videoSubtitles(videoId, limit, offset);
    const result = await this.cache.get<T>(key);
    result ? this.stats.recordHit('subtitles') : this.stats.recordMiss('subtitles');
    return result;
  }

  /**
   * Cache video subtitles
   */
  async setVideoSubtitles<T>(videoId: string, value: T, limit?: number, offset?: number): Promise<void> {
    const key = CacheKeys.videoSubtitles(videoId, limit, offset);
    await this.cache.set(key, value, { ttl: CACHE_TTL.VIDEO_SUBTITLES });
  }

  /**
   * Invalidate all cache entries for a specific video
   */
  async invalidateVideoCache(videoId: string): Promise<void> {
    const count = await this.cache.invalidate(`video:${videoId}:*`);
    this.stats.recordEviction();
    logger.info(`Invalidated ${count} cache entries for video ${videoId}`);
  }

  /**
   * Cache warm: pre-populate cache for popular video IDs
   *
   * Each entry should be { videoId, metadata, subtitles } – callers
   * decide what they pass. This method stores whatever is provided.
   */
  async warmVideoCache(entries: Array<{
    videoId: string;
    metadata: any;
    subtitles?: any[];
  }>): Promise<void> {
    logger.info(`Cache warming: ${entries.length} videos`);

    const cacheEntries = entries.flatMap(({ videoId, metadata, subtitles }) => {
      const items = [
        { key: CacheKeys.videoMetadata(videoId), value: metadata, ttl: CACHE_TTL.VIDEO_METADATA },
      ];
      if (subtitles) {
        items.push({
          key: CacheKeys.videoSubtitles(videoId),
          value: subtitles,
          ttl: CACHE_TTL.VIDEO_SUBTITLES,
        });
      }
      return items;
    });

    await this.cache.mset(cacheEntries);
    logger.info(`Cache warmed: ${cacheEntries.length} entries written`);
  }

  /**
   * Track a popular search query (increments a sorted counter)
   */
  async recordSearchQuery(query: string): Promise<void> {
    const key = CacheKeys.popularSearches();
    try {
      // We lazily store popular searches as a JSON map in a single key
      const existing = await this.cache.get<Record<string, number>>(key) ?? {};
      const q = query.toLowerCase().trim();
      existing[q] = (existing[q] ?? 0) + 1;
      await this.cache.set(key, existing, { ttl: CACHE_TTL.POPULAR_SEARCHES });
    } catch (err) {
      logger.warn('Failed to record popular search:', err);
    }
  }

  /**
   * Get the top N most searched queries
   */
  async getPopularSearches(topN = 10): Promise<Array<{ query: string; count: number }>> {
    try {
      const data = await this.cache.get<Record<string, number>>(CacheKeys.popularSearches());
      if (!data) return [];
      return Object.entries(data)
        .sort(([, a], [, b]) => b - a)
        .slice(0, topN)
        .map(([query, count]) => ({ query, count }));
    } catch {
      return [];
    }
  }

  // ──────────────────────────────────────────────────────────
  // Statistics & Monitoring
  // ──────────────────────────────────────────────────────────

  /**
   * Return current in-memory hit/miss statistics
   */
  getStats(): CacheStats {
    return this.stats.getStats();
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.stats.reset();
    logger.info('Cache stats reset');
  }

  /**
   * Get the TTL remaining for a given raw cache key
   */
  async getTTL(key: string): Promise<number> {
    return this.cache.ttl(key);
  }

  /**
   * Check if a key is cached
   */
  async exists(key: string): Promise<boolean> {
    return this.cache.exists(key);
  }
}
