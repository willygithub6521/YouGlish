/**
 * Cache key naming conventions and TTL policies
 * Based on the design document specifications
 */

export type Accent = 'ALL' | 'US' | 'UK' | 'AU' | 'CA' | 'OTHER';

export interface SearchCacheKey {
  query: string;
  accent: Accent;
  offset: number;
  limit: number;
}

export interface VideoMetadataCacheKey {
  videoId: string;
}

export interface VideoSubtitlesCacheKey {
  videoId: string;
}

export interface SuggestionsCacheKey {
  prefix: string;
}

/**
 * TTL policies in seconds
 */
export const TTL_POLICIES = {
  SEARCH_RESULTS: 60 * 60, // 1 hour
  VIDEO_METADATA: 24 * 60 * 60, // 24 hours
  VIDEO_SUBTITLES: 24 * 60 * 60, // 24 hours
  SUGGESTIONS: 60 * 60, // 1 hour
  STATISTICS: 30 * 60, // 30 minutes
  TEMPORARY: 5 * 60, // 5 minutes
} as const;

/**
 * Cache key generators following the design patterns:
 * search:{query}:{accent}:{offset}:{limit}  -> SearchResult[]
 * video:{videoId}:metadata                  -> VideoMetadata
 * video:{videoId}:subtitles                 -> Subtitle[]
 * suggestions:{prefix}                      -> string[]
 */
export class CacheKeys {
  /**
   * Generate search results cache key
   * Pattern: search:{query}:{accent}:{offset}:{limit}
   */
  static searchResults(params: SearchCacheKey): string {
    const { query, accent, offset, limit } = params;
    // Normalize query for consistent caching
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, '_');
    return `search:${normalizedQuery}:${accent}:${offset}:${limit}`;
  }

  /**
   * Generate video metadata cache key
   * Pattern: video:{videoId}:metadata
   */
  static videoMetadata(videoId: string): string {
    return `video:${videoId}:metadata`;
  }

  /**
   * Generate video subtitles cache key
   * Pattern: video:{videoId}:subtitles
   */
  static videoSubtitles(videoId: string): string {
    return `video:${videoId}:subtitles`;
  }

  /**
   * Generate suggestions cache key
   * Pattern: suggestions:{prefix}
   */
  static suggestions(prefix: string): string {
    const normalizedPrefix = prefix.toLowerCase().trim();
    return `suggestions:${normalizedPrefix}`;
  }

  /**
   * Generate accent count cache key
   * Pattern: accent_counts:{query}
   */
  static accentCounts(query: string): string {
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, '_');
    return `accent_counts:${normalizedQuery}`;
  }

  /**
   * Generate statistics cache key
   * Pattern: stats:{type}:{period}
   */
  static statistics(type: string, period: string = 'daily'): string {
    return `stats:${type}:${period}`;
  }

  /**
   * Generate user session cache key
   * Pattern: session:{sessionId}
   */
  static userSession(sessionId: string): string {
    return `session:${sessionId}`;
  }

  /**
   * Generate rate limiting cache key
   * Pattern: rate_limit:{ip}:{endpoint}
   */
  static rateLimit(ip: string, endpoint: string): string {
    return `rate_limit:${ip}:${endpoint}`;
  }

  /**
   * Generate cache key patterns for invalidation
   */
  static patterns = {
    /**
     * All search results for a specific query (any accent/pagination)
     */
    searchByQuery: (query: string): string => {
      const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, '_');
      return `search:${normalizedQuery}:*`;
    },

    /**
     * All video-related cache entries
     */
    videoAll: (videoId: string): string => {
      return `video:${videoId}:*`;
    },

    /**
     * All search results
     */
    allSearchResults: (): string => {
      return 'search:*';
    },

    /**
     * All suggestions
     */
    allSuggestions: (): string => {
      return 'suggestions:*';
    },

    /**
     * All statistics
     */
    allStatistics: (): string => {
      return 'stats:*';
    },

    /**
     * All rate limiting entries
     */
    allRateLimits: (): string => {
      return 'rate_limit:*';
    },
  };
}

/**
 * Cache configuration for different data types
 */
export const CACHE_CONFIG = {
  searchResults: {
    ttl: TTL_POLICIES.SEARCH_RESULTS,
    keyGenerator: CacheKeys.searchResults,
  },
  videoMetadata: {
    ttl: TTL_POLICIES.VIDEO_METADATA,
    keyGenerator: CacheKeys.videoMetadata,
  },
  videoSubtitles: {
    ttl: TTL_POLICIES.VIDEO_SUBTITLES,
    keyGenerator: CacheKeys.videoSubtitles,
  },
  suggestions: {
    ttl: TTL_POLICIES.SUGGESTIONS,
    keyGenerator: CacheKeys.suggestions,
  },
  accentCounts: {
    ttl: TTL_POLICIES.SEARCH_RESULTS,
    keyGenerator: CacheKeys.accentCounts,
  },
  statistics: {
    ttl: TTL_POLICIES.STATISTICS,
    keyGenerator: CacheKeys.statistics,
  },
} as const;