import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CacheService } from './CacheService.js';

// Mock dependencies
jest.mock('../connections/index.js', () => ({
  getRedisConnection: jest.fn(() => mockRedisConnection)
}));

jest.mock('../redis/cacheService.js', () => ({
  CacheService: jest.fn(() => mockRedisCacheService)
}));

jest.mock('../utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock objects
const mockRedisConnection = {
  getConnection: jest.fn().mockReturnValue({})
};

const mockRedisCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  invalidate: jest.fn(),
  exists: jest.fn(),
  mget: jest.fn(),
  mset: jest.fn(),
  increment: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn()
};

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService = new CacheService({
      defaultTTL: 3600,
      keyPrefix: 'test:'
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('get', () => {
    it('should get value and track cache hit', async () => {
      const testValue = { data: 'test' };
      mockRedisCacheService.get.mockResolvedValue(testValue);

      const result = await cacheService.get('test-key');

      expect(result).toEqual(testValue);
      expect(mockRedisCacheService.get).toHaveBeenCalledWith('test:test-key');
      
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(1);
    });

    it('should track cache miss when value not found', async () => {
      mockRedisCacheService.get.mockResolvedValue(null);

      const result = await cacheService.get('missing-key');

      expect(result).toBeNull();
      expect(mockRedisCacheService.get).toHaveBeenCalledWith('test:missing-key');
      
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0);
    });

    it('should handle errors and track as miss', async () => {
      mockRedisCacheService.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('error-key');

      expect(result).toBeNull();
      
      const stats = cacheService.getStats();
      expect(stats.misses).toBe(1);
    });
  });

  describe('set', () => {
    it('should set value with default TTL', async () => {
      const testValue = { data: 'test' };
      mockRedisCacheService.set.mockResolvedValue(undefined);

      await cacheService.set('test-key', testValue);

      expect(mockRedisCacheService.set).toHaveBeenCalledWith(
        'test:test-key',
        testValue,
        { ttl: 3600 }
      );
    });

    it('should set value with custom TTL', async () => {
      const testValue = { data: 'test' };
      mockRedisCacheService.set.mockResolvedValue(undefined);

      await cacheService.set('test-key', testValue, { ttl: 1800 });

      expect(mockRedisCacheService.set).toHaveBeenCalledWith(
        'test:test-key',
        testValue,
        { ttl: 1800 }
      );
    });

    it('should handle set errors', async () => {
      mockRedisCacheService.set.mockRejectedValue(new Error('Redis error'));

      await expect(cacheService.set('test-key', 'value'))
        .rejects.toThrow('Redis error');
    });
  });

  describe('delete', () => {
    it('should delete key and return true on success', async () => {
      mockRedisCacheService.delete.mockResolvedValue(true);

      const result = await cacheService.delete('test-key');

      expect(result).toBe(true);
      expect(mockRedisCacheService.delete).toHaveBeenCalledWith('test:test-key');
    });

    it('should return false when key not found', async () => {
      mockRedisCacheService.delete.mockResolvedValue(false);

      const result = await cacheService.delete('missing-key');

      expect(result).toBe(false);
    });

    it('should handle delete errors', async () => {
      mockRedisCacheService.delete.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.delete('error-key');

      expect(result).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('should invalidate pattern and return count', async () => {
      mockRedisCacheService.invalidate.mockResolvedValue(5);

      const result = await cacheService.invalidate('test:*');

      expect(result).toBe(5);
      expect(mockRedisCacheService.invalidate).toHaveBeenCalledWith('test:test:*');
    });

    it('should handle invalidate errors', async () => {
      mockRedisCacheService.invalidate.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.invalidate('test:*');

      expect(result).toBe(0);
    });
  });

  describe('mget', () => {
    it('should get multiple values and track statistics', async () => {
      const values = [{ data: 'test1' }, null, { data: 'test3' }];
      mockRedisCacheService.mget.mockResolvedValue(values);

      const result = await cacheService.mget(['key1', 'key2', 'key3']);

      expect(result).toEqual(values);
      expect(mockRedisCacheService.mget).toHaveBeenCalledWith([
        'test:key1',
        'test:key2',
        'test:key3'
      ]);
      
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(2); // Two non-null values
      expect(stats.misses).toBe(1); // One null value
    });

    it('should handle mget errors', async () => {
      mockRedisCacheService.mget.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.mget(['key1', 'key2']);

      expect(result).toEqual([null, null]);
      
      const stats = cacheService.getStats();
      expect(stats.misses).toBe(2);
    });
  });

  describe('mset', () => {
    it('should set multiple values with TTL', async () => {
      const entries = [
        { key: 'key1', value: 'value1', ttl: 1800 },
        { key: 'key2', value: 'value2' }
      ];
      mockRedisCacheService.mset.mockResolvedValue(undefined);

      await cacheService.mset(entries);

      expect(mockRedisCacheService.mset).toHaveBeenCalledWith([
        { key: 'test:key1', value: 'value1', ttl: 1800 },
        { key: 'test:key2', value: 'value2', ttl: 3600 }
      ]);
    });
  });

  describe('specialized cache methods', () => {
    describe('cacheSearchResults', () => {
      it('should cache search results with proper key format', async () => {
        const results = { data: 'search results' };
        mockRedisCacheService.set.mockResolvedValue(undefined);

        await cacheService.cacheSearchResults('Hello World', 'US', results, 1800);

        expect(mockRedisCacheService.set).toHaveBeenCalledWith(
          'test:search:hello world:US',
          results,
          { ttl: 1800 }
        );
      });
    });

    describe('getCachedSearchResults', () => {
      it('should get cached search results', async () => {
        const results = { data: 'search results' };
        mockRedisCacheService.get.mockResolvedValue(results);

        const result = await cacheService.getCachedSearchResults('Hello World', 'US');

        expect(result).toEqual(results);
        expect(mockRedisCacheService.get).toHaveBeenCalledWith('test:search:hello world:US');
      });
    });

    describe('cacheVideoMetadata', () => {
      it('should cache video metadata', async () => {
        const metadata = { id: 'video1', title: 'Test Video' };
        mockRedisCacheService.set.mockResolvedValue(undefined);

        await cacheService.cacheVideoMetadata('video1', metadata);

        expect(mockRedisCacheService.set).toHaveBeenCalledWith(
          'test:video:video1:metadata',
          metadata,
          { ttl: 24 * 3600 }
        );
      });
    });

    describe('invalidateVideoCache', () => {
      it('should invalidate all video-related cache', async () => {
        mockRedisCacheService.invalidate.mockResolvedValue(5);
        mockRedisCacheService.delete.mockResolvedValue(true);

        await cacheService.invalidateVideoCache('video1');

        expect(mockRedisCacheService.invalidate).toHaveBeenCalledWith('test:video:video1:*');
        expect(mockRedisCacheService.invalidate).toHaveBeenCalledWith('test:search:*');
      });
    });
  });

  describe('statistics', () => {
    it('should calculate hit rate correctly', async () => {
      // Simulate some cache operations
      mockRedisCacheService.get
        .mockResolvedValueOnce('hit1')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('hit2')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('hit3');

      await cacheService.get('key1'); // hit
      await cacheService.get('key2'); // miss
      await cacheService.get('key3'); // hit
      await cacheService.get('key4'); // miss
      await cacheService.get('key5'); // hit

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.6); // 3/5
    });

    it('should reset statistics', () => {
      // Set some initial stats
      cacheService.getStats().hits = 10;
      cacheService.getStats().misses = 5;

      cacheService.resetStats();

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when cache is working', async () => {
      mockRedisCacheService.set.mockResolvedValue(undefined);
      mockRedisCacheService.get.mockResolvedValue('ok');
      mockRedisCacheService.delete.mockResolvedValue(true);

      const result = await cacheService.getHealthStatus();

      expect(result.connected).toBe(true);
      expect(result.stats).toBeDefined();
    });

    it('should return unhealthy status when cache fails', async () => {
      mockRedisCacheService.set.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.getHealthStatus();

      expect(result.connected).toBe(false);
      expect(result.stats).toBeDefined();
    });
  });
});