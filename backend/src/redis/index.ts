/**
 * Redis module exports
 * 
 * This module provides a complete Redis caching solution for the YouTube pronunciation search platform.
 * It includes:
 * - Redis connection management with automatic reconnection
 * - Cache service with TTL policies and LRU eviction
 * - Specialized cache services for search and video data
 * - Cache key naming conventions following the design document
 * - Health monitoring and statistics
 */

// Core Redis functionality
export { RedisConnection, RedisConfig, getRedisConfig } from './config';
export { CacheService, CacheOptions } from './cacheService';
export { RedisClient, redisClient } from './client';

// Cache key management
export { 
  CacheKeys, 
  TTL_POLICIES, 
  CACHE_CONFIG,
  SearchCacheKey,
  VideoMetadataCacheKey,
  VideoSubtitlesCacheKey,
  SuggestionsCacheKey,
  Accent
} from './cacheKeys';

// Specialized cache services
export { 
  SearchCache, 
  SearchResult, 
  SearchResponse 
} from './searchCache';

export { 
  VideoCache, 
  VideoMetadata, 
  Subtitle 
} from './videoCache';

// Type definitions for external use
export interface CacheStats {
  searchResultsCount: number;
  suggestionsCount: number;
  cachedVideosCount: number;
  totalMemoryUsage: number;
  hitRate: number;
}

export interface CacheHealthStatus {
  connected: boolean;
  latency?: number;
  error?: string;
  memoryUsage?: string;
  keyCount?: number;
}

/**
 * Initialize Redis client and services
 * Call this during application startup
 */
export async function initializeRedis(): Promise<void> {
  await redisClient.initialize();
}

/**
 * Close Redis connection
 * Call this during application shutdown
 */
export async function closeRedis(): Promise<void> {
  await redisClient.close();
}

/**
 * Get comprehensive cache health status
 */
export async function getCacheHealthStatus(): Promise<CacheHealthStatus> {
  const healthCheck = await redisClient.healthCheck();
  
  if (!healthCheck.connected) {
    return {
      connected: false,
      error: healthCheck.error,
    };
  }

  try {
    const info = await redisClient.getInfo();
    return {
      connected: true,
      latency: healthCheck.latency,
      memoryUsage: info?.memory || 'Unknown',
      keyCount: 0, // Would need to implement key counting
    };
  } catch (error) {
    return {
      connected: true,
      latency: healthCheck.latency,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get cache statistics across all services
 */
export async function getCacheStats(): Promise<CacheStats> {
  try {
    const [searchStats, videoStats] = await Promise.all([
      redisClient.getSearchCache().getSearchCacheStats(),
      redisClient.getVideoCache().getVideoCacheStats(),
    ]);

    return {
      searchResultsCount: searchStats.searchResultsCount,
      suggestionsCount: searchStats.suggestionsCount,
      cachedVideosCount: videoStats.cachedVideosCount,
      totalMemoryUsage: 0, // Would need Redis memory info
      hitRate: 0, // Would need to track hits/misses
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      searchResultsCount: 0,
      suggestionsCount: 0,
      cachedVideosCount: 0,
      totalMemoryUsage: 0,
      hitRate: 0,
    };
  }
}

/**
 * Warm up cache with popular content
 * Call this during application startup or as a background job
 */
export async function warmUpCache(options: {
  popularQueries?: Array<{ query: string; accent: Accent }>;
  popularVideos?: string[];
}): Promise<void> {
  const { popularQueries = [], popularVideos = [] } = options;

  try {
    await Promise.all([
      redisClient.getSearchCache().warmUpPopularSearches(popularQueries),
      redisClient.getVideoCache().warmUpPopularVideos(popularVideos),
    ]);
    
    console.log('Cache warm-up completed successfully');
  } catch (error) {
    console.error('Error during cache warm-up:', error);
  }
}