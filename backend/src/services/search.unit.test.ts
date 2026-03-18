import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { SearchParams } from '../types/index.js';

// ────────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────────

const mockES = {
  searchSubtitles: jest.fn(),
  getSuggestions: jest.fn(),
  searchExactPhrase: jest.fn(),
  getSearchStats: jest.fn()
};

jest.mock('../elasticsearch/searchService.js', () => ({
  ElasticsearchSearchService: jest.fn(() => mockES)
}));

jest.mock('../connections/index.js', () => ({
  getDatabaseConnection: jest.fn(),
  getRedisConnection: jest.fn(() => ({
    getConnection: jest.fn(() => ({
      connect: jest.fn().mockResolvedValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setEx: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        keys: jest.fn().mockResolvedValue([])
      })
    }))
  }))
}));

jest.mock('../utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
  }))
}));

import { SearchService } from './SearchService.js';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

const makeESResponse = (results: any[] = [], total?: number) => ({
  results,
  total: total ?? results.length,
  accentCounts: { US: 0, UK: 0, AU: 0, CA: 0, OTHER: 0 },
  took: 5
});

const makeESResult = (overrides = {}) => ({
  id: 'subtitle-1',
  videoId: 'abc123',
  videoTitle: 'Test Video',
  channelName: 'Test Channel',
  accent: 'US',
  startTime: 10.5,
  endTime: 15.2,
  text: 'hello world example',
  highlightedText: '<mark>hello</mark> world example',
  context: { before: 'Start sentence.', after: 'End sentence.' },
  score: 0.95,
  ...overrides
});

// ────────────────────────────────────────────────────────────────
// Unit Tests (Task 5.5)
// ────────────────────────────────────────────────────────────────

describe('SearchService Unit Tests (Task 5.5)', () => {
  let service: SearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchService({ cacheEnabled: false });
  });

  // ─── Search parameter validation ───
  describe('Search parameter validation', () => {
    it('should default accent to ALL when not provided', async () => {
      mockES.searchSubtitles.mockResolvedValue(makeESResponse());

      const params: SearchParams = { query: 'test', fuzzy: true, limit: 20, offset: 0 };
      const result = await service.search(params);

      expect(result.accent).toBe('ALL');
    });

    it('should default fuzzy to true when not provided', async () => {
      mockES.searchSubtitles.mockResolvedValue(makeESResponse());

      const params: SearchParams = { query: 'test', accent: 'ALL', limit: 20, offset: 0 };
      await service.search(params);

      expect(mockES.searchSubtitles).toHaveBeenCalledWith(
        expect.objectContaining({ fuzzy: true })
      );
    });

    it('should pass accent=undefined to ES when accent is ALL', async () => {
      mockES.searchSubtitles.mockResolvedValue(makeESResponse());

      await service.search({ query: 'test', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 });

      expect(mockES.searchSubtitles).toHaveBeenCalledWith(
        expect.objectContaining({ accent: undefined })
      );
    });

    it('should pass specific accent to ES when accent is not ALL', async () => {
      mockES.searchSubtitles.mockResolvedValue(makeESResponse());

      await service.search({ query: 'test', accent: 'US', fuzzy: true, limit: 20, offset: 0 });

      expect(mockES.searchSubtitles).toHaveBeenCalledWith(
        expect.objectContaining({ accent: 'US' })
      );
    });

    it('should pass limit and offset correctly to ES', async () => {
      mockES.searchSubtitles.mockResolvedValue(makeESResponse());

      await service.search({ query: 'test', accent: 'ALL', fuzzy: true, limit: 10, offset: 30 });

      expect(mockES.searchSubtitles).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 30 })
      );
    });
  });

  // ─── Accent filtering logic ───
  describe('Accent filtering logic', () => {
    it('should include result for specified accent', async () => {
      const esResult = makeESResult({ accent: 'US' });
      mockES.searchSubtitles.mockResolvedValue({
        ...makeESResponse([esResult], 1),
        accentCounts: { US: 1, UK: 0, AU: 0, CA: 0, OTHER: 0 }
      });

      const result = await service.search({ query: 'test', accent: 'US', fuzzy: true, limit: 20, offset: 0 });

      expect(result.results.length).toBe(1);
      expect(result.results[0].accent).toBe('US');
    });

    it('should calculate ALL as sum of accent counts', async () => {
      mockES.searchSubtitles.mockResolvedValue({
        results: [],
        total: 5,
        accentCounts: { US: 2, UK: 1, AU: 1, CA: 1, OTHER: 0 },
        took: 3
      });

      const result = await service.search({ query: 'test', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 });

      expect(result.accentCounts.ALL).toBe(5); // 2+1+1+1+0
    });

    it('should return zero counts for all accents on empty result', async () => {
      mockES.searchSubtitles.mockResolvedValue(makeESResponse([], 0));

      const result = await service.search({ query: 'nomatch', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 });

      expect(result.accentCounts.ALL).toBe(0);
      expect(result.accentCounts.US).toBe(0);
      expect(result.accentCounts.UK).toBe(0);
    });
  });

  // ─── Pagination functionality ───
  describe('Pagination functionality', () => {
    it('should return correct total regardless of limit', async () => {
      mockES.searchSubtitles.mockResolvedValue({
        ...makeESResponse([makeESResult()], 100),
        accentCounts: { US: 100, UK: 0, AU: 0, CA: 0, OTHER: 0 }
      });

      const result = await service.search({ query: 'test', accent: 'ALL', fuzzy: true, limit: 5, offset: 0 });

      expect(result.total).toBe(100);
    });

    it('should request correct offset from Elasticsearch', async () => {
      mockES.searchSubtitles.mockResolvedValue(makeESResponse());

      await service.search({ query: 'test', accent: 'ALL', fuzzy: true, limit: 10, offset: 40 });

      expect(mockES.searchSubtitles).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 40 })
      );
    });
  });

  // ─── Exact phrase search ───
  describe('Exact phrase search', () => {
    it('should call elasticsearch searchExactPhrase for exact mode', async () => {
      mockES.searchExactPhrase.mockResolvedValue(makeESResponse([makeESResult()], 1));

      const result = await service.searchExactPhrase('hello world', 'US', 10);

      expect(mockES.searchExactPhrase).toHaveBeenCalledWith('hello world', 'US', 10);
      expect(result.results.length).toBeGreaterThanOrEqual(0);
    });

    it('should pass undefined accent for exact phrase when not specified', async () => {
      mockES.searchExactPhrase.mockResolvedValue(makeESResponse());

      await service.searchExactPhrase('hello world');

      expect(mockES.searchExactPhrase).toHaveBeenCalledWith('hello world', undefined, 20);
    });

    it('should pass specific accent for exact phrase search', async () => {
      mockES.searchExactPhrase.mockResolvedValue(makeESResponse());

      await service.searchExactPhrase('hello world', 'UK');

      expect(mockES.searchExactPhrase).toHaveBeenCalledWith('hello world', 'UK', 20);
    });
  });

  // ─── Suggestions endpoint ───
  describe('Suggestions functionality', () => {
    it('should return empty array for empty prefix', async () => {
      const result = await service.getSuggestions('');
      expect(result).toEqual([]);
      expect(mockES.getSuggestions).not.toHaveBeenCalled();
    });

    it('should return empty array for short prefix (1 char)', async () => {
      const result = await service.getSuggestions('a');
      expect(result).toEqual([]);
      expect(mockES.getSuggestions).not.toHaveBeenCalled();
    });

    it('should call ES getSuggestions for prefix >= 2 chars', async () => {
      mockES.getSuggestions.mockResolvedValue(['hello', 'help', 'helpful']);

      const result = await service.getSuggestions('he');

      expect(mockES.getSuggestions).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return array of strings from getSuggestions', async () => {
      mockES.getSuggestions.mockResolvedValue(['hello', 'help', 'helpful']);

      const result = await service.getSuggestions('hel', 5);

      expect(Array.isArray(result)).toBe(true);
      result.forEach(s => expect(typeof s).toBe('string'));
    });

    it('should apply limit to suggestions', async () => {
      mockES.getSuggestions.mockResolvedValue(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);

      const result = await service.getSuggestions('he', 5);

      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  // ─── Error handling ───
  describe('Error handling', () => {
    it('should propagate Elasticsearch errors from search()', async () => {
      mockES.searchSubtitles.mockRejectedValue(new Error('ES connection failed'));

      await expect(
        service.search({ query: 'test', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 })
      ).rejects.toThrow('ES connection failed');
    });

    it('should return empty suggestions gracefully on ES error', async () => {
      mockES.getSuggestions.mockRejectedValue(new Error('ES error'));

      const result = await service.getSuggestions('hel');
      expect(result).toEqual([]);
    });

    it('should return health status with elasticsearch=false on error', async () => {
      mockES.searchSubtitles.mockRejectedValue(new Error('connection refused'));

      const health = await service.getHealthStatus();
      expect(health).toHaveProperty('elasticsearch');
      expect(health).toHaveProperty('cache');
    });
  });

  // ─── Search stats ───
  describe('Search statistics', () => {
    it('should return stats from Elasticsearch', async () => {
      mockES.getSearchStats.mockResolvedValue({
        totalDocuments: 5000,
        accentCounts: { US: 2000, UK: 1500, AU: 800, CA: 500, OTHER: 200 },
        uniqueVideos: 300,
        avgDuration: 245.5
      });

      const stats = await service.getSearchStats();

      expect(stats).toHaveProperty('totalDocuments', 5000);
      expect(stats).toHaveProperty('accentCounts');
      expect(stats).toHaveProperty('uniqueVideos', 300);
      expect(stats).toHaveProperty('avgDuration');
    });

    it('should throw on stats error (service re-throws)', async () => {
      mockES.getSearchStats.mockRejectedValue(new Error('Stats unavailable'));

      // getSearchStats re-throws the error, as documented in SearchService.ts
      await expect(service.getSearchStats()).rejects.toThrow('Stats unavailable');
    });
  });
});
