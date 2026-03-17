import { RedisConnection, getRedisConfig } from './config';
import { CacheService } from './cacheService';
import { SearchCache } from './searchCache';
import { VideoCache } from './videoCache';

/**
 * Redis client factory and service container
 */
export class RedisClient {
  private static instance: RedisClient | null = null;
  private connection: RedisConnection;
  private cacheService: CacheService;
  private searchCache: SearchCache;
  private videoCache: VideoCache;
  private isInitialized: boolean = false;

  private constructor() {
    const config = getRedisConfig();
    this.connection = new RedisConnection(config);
    this.cacheService = new CacheService(this.connection);
    this.searchCache = new SearchCache(this.cacheService);
    this.videoCache = new VideoCache(this.cacheService);
  }

  /**
   * Get singleton instance of RedisClient
   */
  static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.connection.connect();
      this.isInitialized = true;
      console.log('Redis client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      throw error;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.isInitialized) {
      await this.connection.disconnect();
      this.isInitialized = false;
      console.log('Redis client closed');
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connection.isConnected();
  }

  /**
   * Get cache service instance
   */
  getCacheService(): CacheService {
    return this.cacheService;
  }

  /**
   * Get search cache service instance
   */
  getSearchCache(): SearchCache {
    return this.searchCache;
  }

  /**
   * Get video cache service instance
   */
  getVideoCache(): VideoCache {
    return this.videoCache;
  }

  /**
   * Get raw Redis connection
   */
  getConnection(): RedisConnection {
    return this.connection;
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<{
    connected: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      if (!this.isConnected()) {
        return {
          connected: false,
          error: 'Redis client not connected',
        };
      }

      const start = Date.now();
      await this.cacheService.set('health_check', { timestamp: start }, { ttl: 10 });
      const result = await this.cacheService.get('health_check');
      const latency = Date.now() - start;

      if (result) {
        await this.cacheService.delete('health_check');
        return {
          connected: true,
          latency,
        };
      } else {
        return {
          connected: false,
          error: 'Health check failed - could not retrieve test data',
        };
      }
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get Redis info and statistics
   */
  async getInfo(): Promise<{
    memory: string;
    clients: string;
    keyspace: string;
    server: string;
  } | null> {
    try {
      const client = await this.connection.connect();
      const info = await client.info();
      
      // Parse Redis INFO response
      const sections = info.split('\r\n\r\n');
      const result: any = {};
      
      for (const section of sections) {
        const lines = section.split('\r\n');
        const sectionName = lines[0].replace('# ', '').toLowerCase();
        
        if (['memory', 'clients', 'keyspace', 'server'].includes(sectionName)) {
          result[sectionName] = section;
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error getting Redis info:', error);
      return null;
    }
  }

  /**
   * Clear all cache data (use with caution!)
   */
  async clearAllCache(): Promise<void> {
    try {
      const client = await this.connection.connect();
      await client.flushDb();
      console.log('All cache data cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const redisClient = RedisClient.getInstance();