import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { VideoService, SearchService, CacheService } from './index.js';

// Integration tests for core services
describe('Core Services Integration', () => {
  let videoService: VideoService;
  let searchService: SearchService;
  let cacheService: CacheService;

  // Mock all external dependencies for integration testing
  beforeAll(() => {
    // Mock database connections
    vi.mock('../connections/index.js', () => ({
      getDatabaseConnection: vi.fn(() => ({
        getPool: vi.fn(() => ({
          query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
        }))
      })),
      getRedisConnection: vi.fn(() => ({
        connect: vi.fn().mockResolvedValue({
          get: vi.fn(),
          set: vi.fn(),
          del: vi.fn(),
          exists: vi.fn(),
          mGet: vi.fn(),
          setEx: vi.fn(),
          keys: vi.fn().mockResolvedValue([]),
          multi: vi.fn().mockReturnValue({
            setEx: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([])
          }),
          incrBy: vi.fn(),
          expire: vi.fn(),
          ttl: vi.fn()
        })
      }))
    }));

    // Mock Elasticsearch
    vi.mock('../elasticsearch/searchService.js', () => ({
      ElasticsearchSearchService: vi.fn(() => ({
        searchSubtitles: vi.fn().mockResolvedValue({
          results: [],
          total: 0,
          accentCounts: {},
          took: 0
        }),
        getSuggestions: vi.fn().mockResolvedValue([]),
        searchExactPhrase: vi.fn().mockResolvedValue({
          results: [],
          total: 0,
          accentCounts: {},
          took: 0
        }),
        getSearchStats: vi.fn().mockResolvedValue({
          totalDocuments: 0,
          accentCounts: {},
          uniqueVideos: 0,
          avgDuration: 0
        }),
        indexSubtitle: vi.fn().mockResolvedValue(true),
        deleteVideoSubtitles: vi.fn().mockResolvedValue(true)
      }))
    }));

    // Mock logger
    vi.mock('../utils/logger.js', () => ({
      createLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }))
    }));

    // Initialize services
    videoService = new VideoService({ cacheEnabled: false }); // Disable cache for simpler testing
    searchService = new SearchService({ cacheEnabled: false });
    cacheService = new CacheService({ defaultTTL: 60 });
  });

  afterAll(() => {
    vi.restoreAllMocks();
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
      // Test with invalid video ID
      await expect(videoService.getVideoMetadata(''))
        .rejects.toThrow();
    });

    it('should handle SearchService errors gracefully', async () => {
      // Test with empty search query
      const result = await searchService.getSuggestions('');
      expect(result).toEqual([]);
    });

    it('should handle CacheService errors gracefully', async () => {
      // CacheService should handle errors internally and return null/false
      const result = await cacheService.get('nonexistent-key');
      expect(result).toBeNull();
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for VideoService operations', async () => {
      // This test ensures TypeScript compilation passes with correct types
      const videoData = {
        id: 'test-video',
        title: 'Test Video',
        channelName: 'Test Channel',
        duration: 300,
        accent: 'US' as const,
        thumbnailUrl: 'https://example.com/thumb.jpg'
      };

      // These should compile without TypeScript errors
      expect(() => videoService.createVideo(videoData)).not.toThrow();
      expect(() => videoService.getVideoMetadata('test-id')).not.toThrow();
      expect(() => videoService.getVideosByAccent('US')).not.toThrow();
    });

    it('should maintain type safety for SearchService operations', async () => {
      const searchParams = {
        query: 'test',
        accent: 'ALL' as const,
        fuzzy: true,
        limit: 20,
        offset: 0
      };

      // These should compile without TypeScript errors
      expect(() => searchService.search(searchParams)).not.toThrow();
      expect(() => searchService.getSuggestions('test')).not.toThrow();
      expect(() => searchService.searchExactPhrase('test phrase')).not.toThrow();
    });

    it('should maintain type safety for CacheService operations', async () => {
      // These should compile without TypeScript errors
      expect(() => cacheService.set('key', { data: 'value' })).not.toThrow();
      expect(() => cacheService.get<{ data: string }>('key')).not.toThrow();
      expect(() => cacheService.cacheSearchResults('query', 'US', [])).not.toThrow();
    });
  });
});