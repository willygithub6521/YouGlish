import { RedisClientType } from 'redis';
import { RedisConnection } from './config';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class CacheService {
  private redis: RedisConnection;
  private defaultTTL: number = 3600; // 1 hour default

  constructor(redis: RedisConnection) {
    this.redis = redis;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await this.redis.connect();
      const value = await client.get(key);
      
      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const client = await this.redis.connect();
      const serializedValue = JSON.stringify(value);
      const ttl = options?.ttl || this.defaultTTL;

      await client.setEx(key, ttl, serializedValue);
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const client = await this.redis.connect();
      const result = await client.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async invalidate(pattern: string): Promise<number> {
    try {
      const client = await this.redis.connect();
      const keys = await client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await client.del(keys);
      return result;
    } catch (error) {
      console.error(`Cache invalidate error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = await this.redis.connect();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const client = await this.redis.connect();
      const values = await client.mGet(keys);
      
      return values.map(value => {
        if (value === null) {
          return null;
        }
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error(`Cache mget error for keys ${keys.join(', ')}:`, error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple key-value pairs
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    try {
      const client = await this.redis.connect();
      
      // Use pipeline for better performance
      const pipeline = client.multi();
      
      for (const entry of entries) {
        const serializedValue = JSON.stringify(entry.value);
        const ttl = entry.ttl || this.defaultTTL;
        pipeline.setEx(entry.key, ttl, serializedValue);
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error('Cache mset error:', error);
      throw error;
    }
  }

  /**
   * Increment a numeric value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const client = await this.redis.connect();
      return await client.incrBy(key, amount);
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const client = await this.redis.connect();
      const result = await client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      const client = await this.redis.connect();
      return await client.ttl(key);
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  }
}