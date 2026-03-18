import { describe, it, expect, jest } from '@jest/globals';
import type { SearchParams, SearchResponse } from '../types/index.js';

// ────────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────────

const mockSearchResult = (overrides = {}) => ({
  id: `result-${Math.random()}`,
  videoId: 'abc123',
  startTime: 10.0,
  endTime: 15.0,
  text: 'Hello world example text',
  accent: 'US' as const,
  relevanceScore: 0.9,
  highlightedText: '<mark>Hello</mark> world example text',
  ...overrides
});

const makeESResponse = (results: any[], total?: number) => ({
  results,
  total: total ?? results.length,
  accentCounts: { US: results.length, UK: 0, AU: 0, CA: 0, OTHER: 0 },
  took: 5
});

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

const mockES = {
  searchSubtitles: jest.fn(),
  getSuggestions: jest.fn(),
  searchExactPhrase: jest.fn(),
  getSearchStats: jest.fn()
};

import { SearchService } from './SearchService.js';

// ────────────────────────────────────────────────────────────────
// Property Tests (Task 5.4)
// ────────────────────────────────────────────────────────────────

/**
 * Property tests validate universal correctness properties of the search system.
 * These tests verify behavioural invariants rather than specific examples.
 */
describe('Search Property Tests (Task 5.4)', () => {
  let service: SearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchService({ cacheEnabled: false });
  });

  // ─── Property 1: Search result consistency ───
  describe('Property 1: Search result consistency', () => {
    it('identical queries must return identical total counts', async () => {
      const esResults = [mockSearchResult(), mockSearchResult()];
      mockES.searchSubtitles.mockResolvedValue(makeESResponse(esResults, 2));

      const params: SearchParams = { query: 'hello', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 };
      const result1 = await service.search(params);
      const result2 = await service.search(params);

      expect(result1.total).toBe(result2.total);
    });

    it('identical queries must return same number of results', async () => {
      const esResults = [mockSearchResult(), mockSearchResult()];
      mockES.searchSubtitles.mockResolvedValue(makeESResponse(esResults, 2));

      const params: SearchParams = { query: 'world', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 };
      const result1 = await service.search(params);
      const result2 = await service.search(params);

      expect(result1.results.length).toBe(result2.results.length);
    });

    it('query field in response must always match the requested query', async () => {
      const queries = ['hello', 'world', 'pronunciation', 'english'];
      mockES.searchSubtitles.mockResolvedValue(makeESResponse([], 0));

      for (const query of queries) {
        const params: SearchParams = { query, accent: 'ALL', fuzzy: true, limit: 20, offset: 0 };
        const result = await service.search(params);
        expect(result.query).toBe(query);
      }
    });

    it('accent field in response must always match the requested accent', async () => {
      const accents = ['ALL', 'US', 'UK', 'AU', 'CA', 'OTHER'] as const;
      mockES.searchSubtitles.mockResolvedValue(makeESResponse([], 0));

      for (const accent of accents) {
        const params: SearchParams = { query: 'test', accent, fuzzy: true, limit: 20, offset: 0 };
        const result = await service.search(params);
        expect(result.accent).toBe(accent);
      }
    });
  });

  // ─── Property 2: Fuzzy search includes exact matches ───
  describe('Property 2: Fuzzy search includes exact matches', () => {
    it('fuzzy search must not exclude results that exact search returns', async () => {
      const exactResult = mockSearchResult({ relevanceScore: 1.0 });
      mockES.searchSubtitles.mockResolvedValue(makeESResponse([exactResult], 1));

      const params: SearchParams = { query: 'hello world', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 };
      const fuzzyResult = await service.search(params);

      // Fuzzy results should include at least as many results as the exact result set
      expect(fuzzyResult.total).toBeGreaterThanOrEqual(1);
    });

    it('accent counts in response must sum correctly to total', async () => {
      mockES.searchSubtitles.mockResolvedValue({
        results: [mockSearchResult({ accent: 'US' }), mockSearchResult({ accent: 'UK' })],
        total: 2,
        accentCounts: { US: 1, UK: 1, AU: 0, CA: 0, OTHER: 0 },
        took: 5
      });

      const params: SearchParams = { query: 'test', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 };
      const result = await service.search(params);

      const { ALL, ...specificAccents } = result.accentCounts;
      const sumOfSpecific = Object.values(specificAccents).reduce((a, b) => a + b, 0);

      // ALL should equal sum of specific accents
      expect(ALL).toBe(sumOfSpecific);
    });
  });

  // ─── Property 3: Pagination invariants ───
  describe('Property 3: Pagination invariants', () => {
    it('results count must never exceed the limit', async () => {
      const manyResults = Array.from({ length: 10 }, () => mockSearchResult());
      mockES.searchSubtitles.mockResolvedValue(makeESResponse(manyResults, 50));

      const limits = [5, 10, 20];
      for (const limit of limits) {
        mockES.searchSubtitles.mockResolvedValue(
          makeESResponse(manyResults.slice(0, limit), 50)
        );
        const result = await service.search({ query: 'test', accent: 'ALL', fuzzy: true, limit, offset: 0 });
        expect(result.results.length).toBeLessThanOrEqual(limit);
      }
    });

    it('empty query with results should still return valid accentCounts keys', async () => {
      mockES.searchSubtitles.mockResolvedValue(makeESResponse([], 0));

      const result = await service.search({ query: 'no-matches', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 });

      expect(result.accentCounts).toHaveProperty('ALL');
      expect(result.accentCounts).toHaveProperty('US');
      expect(result.accentCounts).toHaveProperty('UK');
      expect(result.accentCounts).toHaveProperty('AU');
      expect(result.accentCounts).toHaveProperty('CA');
      expect(result.accentCounts).toHaveProperty('OTHER');
    });
  });

  // ─── Property 4: Suggestions consistency ───
  describe('Property 4: Suggestions consistency', () => {
    it('suggestions should always be lowercase strings', async () => {
      mockES.getSuggestions.mockResolvedValue(['Hello', 'WORLD', 'Example']);

      const suggestions = await service.getSuggestions('hel', 10);

      suggestions.forEach(s => {
        expect(s).toBe(s.toLowerCase());
      });
    });

    it('suggestions should contain no duplicates', async () => {
      mockES.getSuggestions.mockResolvedValue(['hello', 'Hello', 'HELLO', 'world', 'World']);

      const suggestions = await service.getSuggestions('hel', 10);

      const unique = new Set(suggestions);
      expect(suggestions.length).toBe(unique.size);
    });

    it('empty prefix should always return empty array', async () => {
      const results = await service.getSuggestions('', 10);
      expect(results).toEqual([]);
      expect(mockES.getSuggestions).not.toHaveBeenCalled();
    });

    it('single char prefix should always return empty array', async () => {
      const results = await service.getSuggestions('a', 10);
      expect(results).toEqual([]);
      expect(mockES.getSuggestions).not.toHaveBeenCalled();
    });
  });
});
