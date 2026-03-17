import { RedisConnection, getRedisConfig } from './config';
import { CacheService } from './cacheService';
import { CacheKeys, TTL_POLICIES } from './cacheKeys';
import { SearchCache } from './searchCache';
import { VideoCache } from './videoCache';
import { RedisClient } from './client';

// Mock Redis client for testing
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    quit: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    exists: jest.fn(),
    mGet: jest.fn(),
    multi: jest.fn(() => ({
      setEx: jest.fn(),
      exec: jest.fn(),
    })),
    incrBy: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    info: jest.fn(),
    flushDb: jest.fn(),
    isOpen: true,
    on: jest.fn(),
  })),
}));

describe('Redis Configuration', () => {
  describe('getRedisConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should return default configuration', () => {
      const config = getRedisConfig();
      expect(config).toEqual({
        url: undefined,
        host: 'localhost',
        port: 6379,
        password: undefined,
        db: 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });
    });

    it('should use environment variables', () => {
      process.env.REDIS_URL = 'redis://test:6380';
      process.env.REDIS_HOST = 'testhost';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'testpass';
      process.env.REDIS_DB = '1';

      const config = getRedisConfig();
      expect(config).toEqual({
        url: 'redis://test:6380',
        host: 'testhost',
        port: 6380,
        password: 'testpass',
        db: 1,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
      });
    });
  });

  describe('RedisConnection', () => {
    let connection: RedisConnection;

    beforeEach(() => {
      connection = new RedisConnection({
        host: 'localhost',
        port: 6379,
      });
    });

    it('should create connection with config', () => {
      expect(connection).toBeInstanceOf(RedisConnection);
    });

    it('should connect and return client', async () => {
      const client = await connection.connect();
      expect(client).toBeDefined();
      expect(connection.isConnected()).toBe(true);
    });

    it('should disconnect properly', async () => {
      await connection.connect();
      await connection.disconnect();
      expect(connection.getClient()).toBeNull();
    });
  });
});

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockConnection: RedisConnection;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      get: jest.fn(),
      setEx: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      exists: jest.fn(),
      mGet: jest.fn(),
      multi: jest.fn(() => ({
        setEx: jest.fn(),
        exec: jest.fn(),
      })),
      incrBy: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    };

    mockConnection = {
      connect: jest.fn().mockResolvedValue(mockClient),
    } as any;

    cacheService = new CacheService(mockConnection);
  });

  describe('get', () => {
    it('should retrieve and parse cached data', async () => {
      const testData = { test: 'data' };
      mockClient.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get('test_key');
      expect(result).toEqual(testData);
      expect(mockClient.get).toHaveBeenCalledWith('test_key');
    });

    it('should return null for non-existent key', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await cacheService.get('non_existent');
      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('error_key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should serialize and cache data with TTL', async () => {
      const testData = { test: 'data' };
      mockClient.setEx.mockResolvedValue('OK');

      await cacheService.set('test_key', testData, { ttl: 300 });

      expect(mockClient.setEx).toHaveBeenCalledWith(
        'test_key',
        300,
        JSON.stringify(testData)
      );
    });

    it('should use default TTL when not specified', async () => {
      const testData = { test: 'data' };
      mockClient.setEx.mockResolvedValue('OK');

      await cacheService.set('test_key', testData);

      expect(mockClient.setEx).toHaveBeenCalledWith(
        'test_key',
        3600, // default TTL
        JSON.stringify(testData)
      );
    });
  });

  describe('delete', () => {
    it('should delete key and return true if successful', async () => {
      mockClient.del.mockResolvedValue(1);

      const result = await cacheService.delete('test_key');
      expect(result).toBe(true);
      expect(mockClient.del).toHaveBeenCalledWith('test_key');
    });

    it('should return false if key does not exist', async () => {
      mockClient.del.mockResolvedValue(0);

      const result = await cacheService.delete('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('should delete keys matching pattern', async () => {
      mockClient.keys.mockResolvedValue(['key1', 'key2', 'key3']);
      mockClient.del.mockResolvedValue(3);

      const result = await cacheService.invalidate('test:*');
      expect(result).toBe(3);
      expect(mockClient.keys).toHaveBeenCalledWith('test:*');
      expect(mockClient.del).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
    });

    it('should return 0 if no keys match pattern', async () => {
      mockClient.keys.mockResolvedValue([]);

      const result = await cacheService.invalidate('nonexistent:*');
      expect(result).toBe(0);
    });
  });
});

describe('CacheKeys', () => {
  describe('searchResults', () => {
    it('should generate correct search cache key', () => {
      const params = {
        query: 'Hello World',
        accent: 'US' as const,
        offset: 0,
        limit: 20,
      };

      const key = CacheKeys.searchResults(params);
      expect(key).toBe('search:hello_world:US:0:20');
    });

    it('should normalize query with multiple spaces', () => {
      const params = {
        query: 'hello   world   test',
        accent: 'UK' as const,
        offset: 10,
        limit: 50,
      };

      const key = CacheKeys.searchResults(params);
      expect(key).toBe('search:hello_world_test:UK:10:50');
    });
  });

  describe('videoMetadata', () => {
    it('should generate correct video metadata key', () => {
      const key = CacheKeys.videoMetadata('abc123');
      expect(key).toBe('video:abc123:metadata');
    });
  });

  describe('videoSubtitles', () => {
    it('should generate correct video subtitles key', () => {
      const key = CacheKeys.videoSubtitles('def456');
      expect(key).toBe('video:def456:subtitles');
    });
  });

  describe('suggestions', () => {
    it('should generate correct suggestions key', () => {
      const key = CacheKeys.suggestions('Hello');
      expect(key).toBe('suggestions:hello');
    });
  });

  describe('patterns', () => {
    it('should generate correct search pattern', () => {
      const pattern = CacheKeys.patterns.searchByQuery('test query');
      expect(pattern).toBe('search:test_query:*');
    });

    it('should generate correct video pattern', () => {
      const pattern = CacheKeys.patterns.videoAll('abc123');
      expect(pattern).toBe('video:abc123:*');
    });
  });
});

describe('SearchCache', () => {
  let searchCache: SearchCache;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      invalidate: jest.fn(),
      exists: jest.fn(),
      mget: jest.fn(),
      mset: jest.fn(),
      increment: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    } as any;

    searchCache = new SearchCache(mockCacheService);
  });

  describe('cacheSearchResults', () => {
    it('should cache search results with correct key and TTL', async () => {
      const params = {
        query: 'test',
        accent: 'US' as const,
        offset: 0,
        limit: 20,
      };
      const response = {
        results: [],
        total: 0,
        query: 'test',
        accent: 'US' as const,
        accentCounts: {} as any,
      };

      await searchCache.cacheSearchResults(params, response);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'search:test:US:0:20',
        response,
        { ttl: TTL_POLICIES.SEARCH_RESULTS }
      );
    });
  });

  describe('getSearchResults', () => {
    it('should retrieve cached search results', async () => {
      const params = {
        query: 'test',
        accent: 'US' as const,
        offset: 0,
        limit: 20,
      };
      const expectedResponse = {
        results: [],
        total: 0,
        query: 'test',
        accent: 'US' as const,
        accentCounts: {} as any,
      };

      mockCacheService.get.mockResolvedValue(expectedResponse);

      const result = await searchCache.getSearchResults(params);
      expect(result).toEqual(expectedResponse);
      expect(mockCacheService.get).toHaveBeenCalledWith('search:test:US:0:20');
    });
  });

  describe('invalidateSearchByQuery', () => {
    it('should invalidate all search results for a query', async () => {
      mockCacheService.invalidate.mockResolvedValue(5);

      const result = await searchCache.invalidateSearchByQuery('test query');
      expect(result).toBe(5);
      expect(mockCacheService.invalidate).toHaveBeenCalledWith('search:test_query:*');
    });
  });
});

describe('VideoCache', () => {
  let videoCache: VideoCache;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      invalidate: jest.fn(),
      exists: jest.fn(),
      mget: jest.fn(),
      mset: jest.fn(),
      increment: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    } as any;

    videoCache = new VideoCache(mockCacheService);
  });

  describe('cacheVideoMetadata', () => {
    it('should cache video metadata with correct key and TTL', async () => {
      const metadata = {
        id: 'abc123',
        title: 'Test Video',
        channelName: 'Test Channel',
        duration: 120,
        accent: 'US' as const,
        thumbnailUrl: 'http://example.com/thumb.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await videoCache.cacheVideoMetadata('abc123', metadata);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'video:abc123:metadata',
        metadata,
        { ttl: TTL_POLICIES.VIDEO_METADATA }
      );
    });
  });

  describe('getVideoData', () => {
    it('should retrieve both metadata and subtitles', async () => {
      const metadata = { id: 'abc123' } as any;
      const subtitles = [{ id: 1, text: 'Hello' }] as any;

      mockCacheService.get
        .mockResolvedValueOnce(metadata)
        .mockResolvedValueOnce(subtitles);

      const result = await videoCache.getVideoData('abc123');
      expect(result).toEqual({ metadata, subtitles });
    });
  });

  describe('invalidateVideo', () => {
    it('should invalidate all video cache entries', async () => {
      mockCacheService.invalidate.mockResolvedValue(2);

      const result = await videoCache.invalidateVideo('abc123');
      expect(result).toBe(2);
      expect(mockCacheService.invalidate).toHaveBeenCalledWith('video:abc123:*');
    });
  });
});

describe('RedisClient', () => {
  let redisClient: RedisClient;

  beforeEach(() => {
    // Reset singleton for testing
    (RedisClient as any).instance = null;
    redisClient = RedisClient.getInstance();
  });

  it('should return singleton instance', () => {
    const instance1 = RedisClient.getInstance();
    const instance2 = RedisClient.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should provide access to cache services', () => {
    expect(redisClient.getCacheService()).toBeInstanceOf(CacheService);
    expect(redisClient.getSearchCache()).toBeInstanceOf(SearchCache);
    expect(redisClient.getVideoCache()).toBeInstanceOf(VideoCache);
  });

  describe('healthCheck', () => {
    it('should return disconnected status when not connected', async () => {
      const health = await redisClient.healthCheck();
      expect(health.connected).toBe(false);
      expect(health.error).toBeDefined();
    });
  });
});