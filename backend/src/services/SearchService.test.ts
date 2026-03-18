import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SearchService } from './SearchService.js';
import type { SearchParams, SearchResponse } from '../types/index.js';

// Mock dependencies
jest.mock('../elasticsearch/searchService.js', () => ({
  ElasticsearchSearchService: jest.fn(() => mockElasticsearchService)
}));

jest.mock('../connections/index.js', () => ({
  getRedisConnection: jest.fn(() => mockRedisConnection)
}));

jest.mock('../redis/cacheService.js', () => ({
  CacheService: jest.fn(() => mockCacheService)
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

const mockElasticsearchService = {
  searchSubtitles: jest.fn(),
  getSuggestions: jest.fn(),
  searchExactPhrase: jest.fn(),
  getSearchStats: jest.fn()
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  invalidate: jest.fn(),
  exists: jest.fn()
};

describe('SearchService', () => {
  let searchService: SearchService;

  const mockSearchResults = [
    {
      id: '1',
      videoId: 'video-1',
      startTime: 10.5,
      endTime: 15.2,
      text: 'Hello world example',
      accent: 'US',
      relevanceScore: 0.95,
      highlightedText: 'Hello <mark>world</mark> example'
    },
    {
      id: '2',
      videoId: 'video-2',
      startTime: 25.1,
      endTime: 30.8,
      text: 'Another world test',
      accent: 'UK',
      relevanceScore: 0.87,
      highlightedText: 'Another <mark>world</mark> test'
    }
  ];

  const mockESResponse = {
    results: mockSearchResults,
    total: 2,
    accentCounts: {
      US: 1,
      UK: 1,
      AU: 0,
      CA: 0,
      OTHER: 0
    },
    took: 15
  };

  beforeEach(() => {
    jest.clearAllMocks();
    searchService = new SearchService({ cacheEnabled: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('search', () => {
    const searchParams: SearchParams = {
      query: 'world',
      accent: 'ALL',
      fuzzy: true,
      limit: 20,
      offset: 0
    };

    it('should return cached search results when available', async () => {
      const cachedResponse: SearchResponse = {
        results: mockSearchResults.map(r => ({
          ...r,
          context: { before: 'Hello', after: 'example' }
        })),
        total: 2,
        query: 'world',
        accent: 'ALL',
        accentCounts: {
          ALL: 2,
          US: 1,
          UK: 1,
          AU: 0,
          CA: 0,
          OTHER: 0
        }
      };

      mockCacheService.get.mockResolvedValue(cachedResponse);

      const result = await searchService.search(searchParams);

      expect(result).toEqual(cachedResponse);
      expect(mockCacheService.get).toHaveBeenCalledWith('search:world:ALL:true:20:0');
      expect(mockElasticsearchService.searchSubtitles).not.toHaveBeenCalled();
    });

    it('should fetch from Elasticsearch and cache when not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockElasticsearchService.searchSubtitles.mockResolvedValue(mockESResponse);

      const result = await searchService.search(searchParams);

      expect(result.total).toBe(2);
      expect(result.query).toBe('world');
      expect(result.accent).toBe('ALL');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].context).toBeDefined();
      
      expect(mockElasticsearchService.searchSubtitles).toHaveBeenCalledWith({
        query: 'world',
        accent: undefined, // 'ALL' becomes undefined
        fuzzy: true,
        limit: 20,
        offset: 0
      });
      
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'search:world:ALL:true:20:0',
        expect.any(Object),
        { ttl: 3600 }
      );
    });

    it('should handle specific accent filtering', async () => {
      const usSearchParams = { ...searchParams, accent: 'US' as const };
      mockCacheService.get.mockResolvedValue(null);
      mockElasticsearchService.searchSubtitles.mockResolvedValue(mockESResponse);

      await searchService.search(usSearchParams);

      expect(mockElasticsearchService.searchSubtitles).toHaveBeenCalledWith({
        query: 'world',
        accent: 'US',
        fuzzy: true,
        limit: 20,
        offset: 0
      });
    });

    it('should handle search errors', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockElasticsearchService.searchSubtitles.mockRejectedValue(new Error('ES error'));

      await expect(searchService.search(searchParams))
        .rejects.toThrow('Search failed: ES error');
    });
  });

  describe('getSuggestions', () => {
    it('should return cached suggestions when available', async () => {
      const cachedSuggestions = ['world', 'wonderful', 'work'];
      mockCacheService.get.mockResolvedValue(cachedSuggestions);

      const result = await searchService.getSuggestions('wo', 5);

      expect(result).toEqual(cachedSuggestions);
      expect(mockCacheService.get).toHaveBeenCalledWith('suggestions:wo:5');
      expect(mockElasticsearchService.getSuggestions).not.toHaveBeenCalled();
    });

    it('should fetch from Elasticsearch and cache when not in cache', async () => {
      const esSuggestions = ['World', 'WONDERFUL', 'work', 'world']; // Mixed case with duplicates
      const expectedSuggestions = ['work', 'world', 'wonderful']; // Cleaned and sorted
      
      mockCacheService.get.mockResolvedValue(null);
      mockElasticsearchService.getSuggestions.mockResolvedValue(esSuggestions);

      const result = await searchService.getSuggestions('wo', 5);

      expect(result).toEqual(expectedSuggestions);
      expect(mockElasticsearchService.getSuggestions).toHaveBeenCalledWith('wo', 5);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'suggestions:wo:5',
        expectedSuggestions,
        { ttl: 24 * 60 * 60 }
      );
    });

    it('should return empty array for short prefixes', async () => {
      const result = await searchService.getSuggestions('w', 5);
      expect(result).toEqual([]);
      expect(mockElasticsearchService.getSuggestions).not.toHaveBeenCalled();
    });

    it('should handle suggestion errors gracefully', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockElasticsearchService.getSuggestions.mockRejectedValue(new Error('ES error'));

      const result = await searchService.getSuggestions('wo', 5);
      expect(result).toEqual([]);
    });
  });

  describe('searchExactPhrase', () => {
    it('should return cached exact phrase results when available', async () => {
      const cachedResponse: SearchResponse = {
        results: [mockSearchResults[0]],
        total: 1,
        query: 'hello world',
        accent: 'US',
        accentCounts: {
          ALL: 1,
          US: 1,
          UK: 0,
          AU: 0,
          CA: 0,
          OTHER: 0
        }
      };

      mockCacheService.get.mockResolvedValue(cachedResponse);

      const result = await searchService.searchExactPhrase('hello world', 'US', 10);

      expect(result).toEqual(cachedResponse);
      expect(mockCacheService.get).toHaveBeenCalledWith('exact:hello world:US:10');
      expect(mockElasticsearchService.searchExactPhrase).not.toHaveBeenCalled();
    });

    it('should fetch from Elasticsearch and cache when not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockElasticsearchService.searchExactPhrase.mockResolvedValue(mockESResponse);

      const result = await searchService.searchExactPhrase('hello world', 'US', 10);

      expect(result.total).toBe(2);
      expect(result.query).toBe('hello world');
      expect(result.accent).toBe('US');
      
      expect(mockElasticsearchService.searchExactPhrase).toHaveBeenCalledWith(
        'hello world',
        'US',
        10
      );
      
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'exact:hello world:US:10',
        expect.any(Object),
        { ttl: 3600 }
      );
    });
  });

  describe('getSearchStats', () => {
    const mockStats = {
      totalDocuments: 1000,
      accentCounts: {
        US: 400,
        UK: 300,
        AU: 150,
        CA: 100,
        OTHER: 50
      },
      uniqueVideos: 100,
      avgDuration: 180.5
    };

    it('should return cached stats when available', async () => {
      mockCacheService.get.mockResolvedValue(mockStats);

      const result = await searchService.getSearchStats();

      expect(result).toEqual(mockStats);
      expect(mockCacheService.get).toHaveBeenCalledWith('search:stats');
      expect(mockElasticsearchService.getSearchStats).not.toHaveBeenCalled();
    });

    it('should fetch from Elasticsearch and cache when not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockElasticsearchService.getSearchStats.mockResolvedValue(mockStats);

      const result = await searchService.getSearchStats();

      expect(result).toEqual({
        ...mockStats,
        accentCounts: {
          ALL: 1000, // Calculated total
          US: 400,
          UK: 300,
          AU: 150,
          CA: 100,
          OTHER: 50
        }
      });
      
      expect(mockElasticsearchService.getSearchStats).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'search:stats',
        expect.any(Object),
        { ttl: 60 * 60 }
      );
    });
  });

  describe('invalidateSearchCache', () => {
    it('should invalidate all search-related cache patterns', async () => {
      await searchService.invalidateSearchCache();

      expect(mockCacheService.invalidate).toHaveBeenCalledTimes(4);
      expect(mockCacheService.invalidate).toHaveBeenCalledWith('search:*');
      expect(mockCacheService.invalidate).toHaveBeenCalledWith('suggestions:*');
      expect(mockCacheService.invalidate).toHaveBeenCalledWith('exact:*');
      expect(mockCacheService.invalidate).toHaveBeenCalledWith('search:stats');
    });

    it('should invalidate specific pattern when provided', async () => {
      await searchService.invalidateSearchCache('search:world:*');

      expect(mockCacheService.invalidate).toHaveBeenCalledWith('search:world:*');
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status for all components', async () => {
      mockElasticsearchService.getSearchStats.mockResolvedValue({});
      mockCacheService.exists.mockResolvedValue(true);

      const result = await searchService.getHealthStatus();

      expect(result).toEqual({
        elasticsearch: true,
        cache: true
      });
    });

    it('should handle component failures', async () => {
      mockElasticsearchService.getSearchStats.mockRejectedValue(new Error('ES error'));
      mockCacheService.exists.mockRejectedValue(new Error('Cache error'));

      const result = await searchService.getHealthStatus();

      expect(result).toEqual({
        elasticsearch: false,
        cache: false
      });
    });
  });
});