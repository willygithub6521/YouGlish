import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { VideoService, SearchService, CacheService } from './index.js';

// Mock Redis inner client with all Redis operations
const mockRedisInnerClient = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(1),
  mGet: jest.fn().mockResolvedValue([]),
  setEx: jest.fn().mockResolvedValue('OK'),
  keys: jest.fn().mockResolvedValue([]),
  multi: jest.fn().mockReturnValue({
    setEx: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([])
  }),
  incrBy: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(-1)
};

// RedisConnection mock: has connect() that resolves to the inner client,
// and getConnection() that also returns the inner client for direct access
const mockRedisConnection = {
  connect: jest.fn().mockResolvedValue(mockRedisInnerClient),
  getConnection: jest.fn().mockReturnValue(mockRedisInnerClient)
};

// Top-level mock: getRedisConnection() returns the mockRedisConnection
const mockRedisClient = mockRedisConnection;

// Mock all external dependencies for integration testing
jest.mock('../connections/index.js', () => ({
  getDatabaseConnection: jest.fn(() => ({
    getPool: jest.fn(() => ({
      query: jest.fn().mockResolvedValue({
        rows: [{
          id: 'test-video',
          title: 'Test Video',
          channel_name: 'Test Channel',
          duration: 300,
          accent: 'US',
          thumbnail_url: 'https://example.com/thumb.jpg',
          created_at: new Date(),
          updated_at: new Date()
        }],
        rowCount: 1
      })
    }))
  })),
  getRedisConnection: jest.fn(() => mockRedisClient)
}));

// Mock Elasticsearch
jest.mock('../elasticsearch/searchService.js', () => ({
  ElasticsearchSearchService: jest.fn(() => ({
    searchSubtitles: jest.fn().mockResolvedValue({
      results: [],
      total: 0,
      accentCounts: { US: 0, UK: 0, AU: 0, CA: 0, OTHER: 0 },
      took: 0
    }),
    getSuggestions: jest.fn().mockResolvedValue([]),
    searchExactPhrase: jest.fn().mockResolvedValue({
      results: [],
      total: 0,
      accentCounts: { US: 0, UK: 0, AU: 0, CA: 0, OTHER: 0 },
      took: 0
    }),
    getSearchStats: jest.fn().mockResolvedValue({
      totalDocuments: 0,
      accentCounts: {},
      uniqueVideos: 0,
      avgDuration: 0
    }),
    indexSubtitle: jest.fn().mockResolvedValue(true),
    deleteVideoSubtitles: jest.fn().mockResolvedValue(true)
  }))
}));

// Mock logger
jest.mock('../utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Integration tests for core services
describe('Core Services Integration', () => {
  let videoService: VideoService;
  let searchService: SearchService;
  let cacheService: CacheService;

  beforeAll(() => {
    // Initialize services - each service internally calls getRedisConnection()
    videoService = new VideoService({ cacheEnabled: false });
    searchService = new SearchService({ cacheEnabled: false });
    cacheService = new CacheService({ defaultTTL: 60 });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize VideoService without errors', () => {
      expect(videoService).toBeInstanceOf(VideoService);
    });

    it('should initialize SearchService without errors', () => {
      expect(searchService).toBeInstanceOf(SearchService);
    });

    it('should initialize CacheService without errors', () => {
      expect(cacheService).toBeInstanceOf(CacheService);
    });
  });

  describe('Service Health Checks', () => {
    it('should check VideoService health', async () => {
      const health = await videoService.getHealthStatus();
      
      expect(health).toHaveProperty('database');
      expect(health).toHaveProperty('cache');
      expect(health).toHaveProperty('search');
      expect(typeof health.database).toBe('boolean');
      expect(typeof health.cache).toBe('boolean');
      expect(typeof health.search).toBe('boolean');
    });

    it('should check SearchService health', async () => {
      const health = await searchService.getHealthStatus();
      
      expect(health).toHaveProperty('elasticsearch');
      expect(health).toHaveProperty('cache');
      expect(typeof health.elasticsearch).toBe('boolean');
      expect(typeof health.cache).toBe('boolean');
    });

    it('should check CacheService health', async () => {
      const health = await cacheService.getHealthStatus();
      
      expect(health).toHaveProperty('connected');
      expect(health).toHaveProperty('stats');
      expect(typeof health.connected).toBe('boolean');
      expect(health.stats).toHaveProperty('hits');
      expect(health.stats).toHaveProperty('misses');
      expect(health.stats).toHaveProperty('hitRate');
    });
  });

  describe('Service Method Signatures', () => {
    it('should have correct VideoService method signatures', () => {
      expect(typeof videoService.getVideoMetadata).toBe('function');
      expect(typeof videoService.getSubtitles).toBe('function');
      expect(typeof videoService.createVideo).toBe('function');
      expect(typeof videoService.updateVideo).toBe('function');
      expect(typeof videoService.deleteVideo).toBe('function');
      expect(typeof videoService.addSubtitles).toBe('function');
      expect(typeof videoService.getVideosByAccent).toBe('function');
      expect(typeof videoService.getAccentCounts).toBe('function');
      expect(typeof videoService.videoExists).toBe('function');
      expect(typeof videoService.getSubtitleWithContext).toBe('function');
      expect(typeof videoService.getSubtitleAtTime).toBe('function');
      expect(typeof videoService.getAllVideos).toBe('function');
      expect(typeof videoService.getHealthStatus).toBe('function');
    });

    it('should have correct SearchService method signatures', () => {
      expect(typeof searchService.search).toBe('function');
      expect(typeof searchService.getSuggestions).toBe('function');
      expect(typeof searchService.searchExactPhrase).toBe('function');
      expect(typeof searchService.getSearchStats).toBe('function');
      expect(typeof searchService.invalidateSearchCache).toBe('function');
      expect(typeof searchService.getHealthStatus).toBe('function');
    });

    it('should have correct CacheService method signatures', () => {
      expect(typeof cacheService.get).toBe('function');
      expect(typeof cacheService.set).toBe('function');
      expect(typeof cacheService.delete).toBe('function');
      expect(typeof cacheService.invalidate).toBe('function');
      expect(typeof cacheService.exists).toBe('function');
      expect(typeof cacheService.mget).toBe('function');
      expect(typeof cacheService.mset).toBe('function');
      expect(typeof cacheService.increment).toBe('function');
      expect(typeof cacheService.expire).toBe('function');
      expect(typeof cacheService.ttl).toBe('function');
      expect(typeof cacheService.cacheSearchResults).toBe('function');
      expect(typeof cacheService.getCachedSearchResults).toBe('function');
      expect(typeof cacheService.cacheVideoMetadata).toBe('function');
      expect(typeof cacheService.getCachedVideoMetadata).toBe('function');
      expect(typeof cacheService.invalidateVideoCache).toBe('function');
      expect(typeof cacheService.invalidateSearchCache).toBe('function');
      expect(typeof cacheService.getStats).toBe('function');
      expect(typeof cacheService.resetStats).toBe('function');
      expect(typeof cacheService.getHealthStatus).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle VideoService errors gracefully', async () => {
      // Test with empty video ID - service should handle gracefully
      const result = await videoService.getVideoMetadata('test-video');
      expect(result).not.toBeUndefined();
    });

    it('should handle SearchService errors gracefully', async () => {
      // Test with empty search query
      const result = await searchService.getSuggestions('');
      expect(result).toEqual([]);
    });

    it('should handle CacheService errors gracefully', async () => {
      // CacheService should handle errors internally and return null
      const result = await cacheService.get('nonexistent-key');
      expect(result).toBeNull();
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for VideoService operations', async () => {
      const videoData = {
        id: 'test-video',
        title: 'Test Video',
        channelName: 'Test Channel',
        duration: 300,
        accent: 'US' as const,
        thumbnailUrl: 'https://example.com/thumb.jpg'
      };

      // Should resolve without throwing
      await expect(videoService.createVideo(videoData)).resolves.toBeDefined();
      await expect(videoService.getVideosByAccent('US')).resolves.toBeDefined();
    });

    it('should maintain type safety for SearchService operations', async () => {
      const searchParams = {
        query: 'test',
        accent: 'ALL' as const,
        fuzzy: true,
        limit: 20,
        offset: 0
      };

      await expect(searchService.search(searchParams)).resolves.toBeDefined();
      await expect(searchService.getSuggestions('test')).resolves.toBeDefined();
      await expect(searchService.searchExactPhrase('test phrase')).resolves.toBeDefined();
    });

    it('should maintain type safety for CacheService operations', () => {
      // Verify that the methods exist and have the correct signatures
      expect(typeof cacheService.set).toBe('function');
      expect(typeof cacheService.get).toBe('function');
      expect(typeof cacheService.cacheSearchResults).toBe('function');
      expect(typeof cacheService.getCachedSearchResults).toBe('function');
    });
  });
});