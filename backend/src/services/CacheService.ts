import { CacheService as RedisCacheService, CacheOptions } from '../redis/cacheService.js';
import { getRedisConnection } from '../connections/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

export interface CacheServiceOptions {
  defaultTTL?: number;
  keyPrefix?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * CacheService - Manages Redis caching operations
 * 
 * This service provides high-level caching operations with:
 * - Unified caching interface
 * - Cache statistics tracking
 * - Key management and namespacing
 * - Batch operations for performance
 */
export class CacheService {
  private redisCacheService: RedisCacheService;
  private options: CacheServiceOptions;
  private stats: CacheStats;

  constructor(options: CacheServiceOptions = {}) {
    this.options = {
      defaultTTL: 3600, // 1 hour
      keyPrefix: 'yps:', // YouTube Pronunciation Search
      ...options
    };

    const redisClient = getRedisConnection();
    this.redisCacheService = new RedisCacheService(redisClient.getConnection());
    
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0
    };
  }

  /**
   * Get a value from cache with statistics tracking
   */
  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.addPrefix(key);
    
    try {
      const value = await this.redisCacheService.get<T>(prefixedKey);
      
      if (value !== null) {
        this.stats.hits++;
        logger.debug(`Cache hit for key: ${key}`);
      } else {
        this.stats.misses++;
        logger.debug(`Cache miss for key: ${key}`);
      }
      
      this.updateHitRate();
      return value;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const prefixedKey = this.addPrefix(key);
    const cacheOptions = {
      ttl: this.options.defaultTTL,
      ...options
    };

    try {
      await this.redisCacheService.set(prefixedKey, value, cacheOptions);
      logger.debug(`Cache set for key: ${key} (TTL: ${cacheOptions.ttl}s)`);
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<boolean> {
    const prefixedKey = this.addPrefix(key);
    
    try {
      const result = await this.redisCacheService.delete(prefixedKey);
      logger.debug(`Cache delete for key: ${key} - ${result ? 'success' : 'not found'}`);
      return result;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async invalidate(pattern: string): Promise<number> {
    const prefixedPattern = this.addPrefix(pattern);
    
    try {
      const count = await this.redisCacheService.invalidate(prefixedPattern);
      logger.info(`Cache invalidated ${count} keys for pattern: ${pattern}`);
      return count;
    } catch (error) {
      logger.error(`Cache invalidate error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const prefixedKey = this.addPrefix(key);
    
    try {
      return await this.redisCacheService.exists(prefixedKey);
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const prefixedKeys = keys.map(key => this.addPrefix(key));
    
    try {
      const values = await this.redisCacheService.mget<T>(prefixedKeys);
      
      // Update statistics
      values.forEach(value => {
        if (value !== null) {
          this.stats.hits++;
        } else {
          this.stats.misses++;
        }
      });
      
      this.updateHitRate();
      logger.debug(`Cache mget for ${keys.length} keys - ${values.filter(v => v !== null).length} hits`);
      
      return values;
    } catch (error) {
      logger.error(`Cache mget error for keys ${keys.join(', ')}:`, error);
      this.stats.misses += keys.length;
      this.updateHitRate();
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    const prefixedEntries = entries.map(entry => ({
      ...entry,
      key: this.addPrefix(entry.key),
      ttl: entry.ttl || this.options.defaultTTL
    }));

    try {
      await this.redisCacheService.mset(prefixedEntries);
      logger.debug(`Cache mset for ${entries.length} keys`);
    } catch (error) {
      logger.error('Cache mset error:', error);
      throw error;
    }
  }

  /**
   * Increment a numeric value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    const prefixedKey = this.addPrefix(key);
    
    try {
      const result = await this.redisCacheService.increment(prefixedKey, amount);
      logger.debug(`Cache increment for key: ${key} by ${amount} = ${result}`);
      return result;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const prefixedKey = this.addPrefix(key);
    
    try {
      const result = await this.redisCacheService.expire(prefixedKey, ttl);
      logger.debug(`Cache expire for key: ${key} - TTL: ${ttl}s`);
      return result;
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    const prefixedKey = this.addPrefix(key);
    
    try {
      return await this.redisCacheService.ttl(prefixedKey);
    } catch (error) {
      logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Cache search results with optimized key structure
   */
  async cacheSearchResults<T>(query: string, accent: string, results: T, ttl?: number): Promise<void> {
    const key = `search:${query.toLowerCase()}:${accent}`;
    await this.set(key, results, { ttl: ttl || 3600 }); // 1 hour default
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults<T>(query: string, accent: string): Promise<T | null> {
    const key = `search:${query.toLowerCase()}:${accent}`;
    return await this.get<T>(key);
  }

  /**
   * Cache video metadata
   */
  async cacheVideoMetadata<T>(videoId: string, metadata: T, ttl?: number): Promise<void> {
    const key = `video:${videoId}:metadata`;
    await this.set(key, metadata, { ttl: ttl || 24 * 3600 }); // 24 hours default
  }

  /**
   * Get cached video metadata
   */
  async getCachedVideoMetadata<T>(videoId: string): Promise<T | null> {
    const key = `video:${videoId}:metadata`;
    return await this.get<T>(key);
  }

  /**
   * Cache video subtitles
   */
  async cacheVideoSubtitles<T>(videoId: string, subtitles: T, ttl?: number): Promise<void> {
    const key = `video:${videoId}:subtitles`;
    await this.set(key, subtitles, { ttl: ttl || 24 * 3600 }); // 24 hours default
  }

  /**
   * Get cached video subtitles
   */
  async getCachedVideoSubtitles<T>(videoId: string): Promise<T | null> {
    const key = `video:${videoId}:subtitles`;
    return await this.get<T>(key);
  }

  /**
   * Cache search suggestions
   */
  async cacheSuggestions(prefix: string, suggestions: string[], ttl?: number): Promise<void> {
    const key = `suggestions:${prefix.toLowerCase()}`;
    await this.set(key, suggestions, { ttl: ttl || 24 * 3600 }); // 24 hours default
  }

  /**
   * Get cached suggestions
   */
  async getCachedSuggestions(prefix: string): Promise<string[] | null> {
    const key = `suggestions:${prefix.toLowerCase()}`;
    return await this.get<string[]>(key);
  }

  /**
   * Invalidate all video-related cache
   */
  async invalidateVideoCache(videoId: string): Promise<void> {
    await Promise.all([
      this.invalidate(`video:${videoId}:*`),
      this.invalidate('search:*'), // Invalidate search results as they might contain this video
      this.delete('stats:*') // Invalidate statistics
    ]);
  }

  /**
   * Invalidate all search-related cache
   */
  async invalidateSearchCache(): Promise<void> {
    await Promise.all([
      this.invalidate('search:*'),
      this.invalidate('suggestions:*'),
      this.delete('stats:search')
    ]);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0
    };
  }

  /**
   * Get cache health status
   */
  async getHealthStatus(): Promise<{
    connected: boolean;
    stats: CacheStats;
    keyCount?: number;
  }> {
    try {
      // Test basic operations
      const testKey = 'health:check';
      await this.set(testKey, 'ok', { ttl: 10 });
      const testValue = await this.get(testKey);
      await this.delete(testKey);

      const connected = testValue === 'ok';

      return {
        connected,
        stats: this.getStats(),
        keyCount: connected ? await this.getKeyCount() : undefined
      };
    } catch (error) {
      logger.error('Cache health check failed:', error);
      return {
        connected: false,
        stats: this.getStats()
      };
    }
  }

  /**
   * Get approximate key count (for monitoring)
   */
  private async getKeyCount(): Promise<number> {
    try {
      // This is an approximation using the pattern matching
      const pattern = this.addPrefix('*');
      const keys = await this.redisCacheService.invalidate(pattern.replace('*', 'temp:count:*'));
      return keys;
    } catch (error) {
      logger.warn('Failed to get key count:', error);
      return -1;
    }
  }

  /**
   * Add prefix to cache key
   */
  private addPrefix(key: string): string {
    return `${this.options.keyPrefix}${key}`;
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}