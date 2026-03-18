import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ────────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────────

const mockCacheOps = {
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

jest.mock('./cacheService.js', () => ({
  CacheService: jest.fn(() => mockCacheOps)
}));

jest.mock('../utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
  }))
}));

import { CacheManager, CacheKeys, CACHE_TTL } from './CacheManager.js';
import type { SearchParams } from '../types/index.js';

const makeRedisConnection = () => ({} as any);

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('CacheManager (Task 7)', () => {
  let manager: CacheManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheOps.get.mockResolvedValue(null);
    mockCacheOps.set.mockResolvedValue(undefined);
    mockCacheOps.invalidate.mockResolvedValue(0);
    mockCacheOps.ttl.mockResolvedValue(-1);
    mockCacheOps.exists.mockResolvedValue(false);
    mockCacheOps.mset.mockResolvedValue(undefined);

    manager = new CacheManager(makeRedisConnection());
  });

  // ──────────────────────────────────────────────────────────
  // CacheKeys builder
  // ──────────────────────────────────────────────────────────
  describe('CacheKeys', () => {
    it('search key includes query, accent, fuzzy, limit, offset', () => {
      const params: SearchParams = { query: 'Hello', accent: 'US', fuzzy: false, limit: 10, offset: 20 };
      const key = CacheKeys.searchResults(params);
      expect(key).toContain('hello');  // lowercased
      expect(key).toContain('US');
      expect(key).toContain('0');      // fuzzy=false → 0
      expect(key).toContain('10');
      expect(key).toContain('20');
    });

    it('identical params produce the same search key', () => {
      const params: SearchParams = { query: 'test', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 };
      expect(CacheKeys.searchResults(params)).toBe(CacheKeys.searchResults(params));
    });

    it('video metadata key includes videoId', () => {
      const key = CacheKeys.videoMetadata('dQw4w9WgXcQ');
      expect(key).toContain('dQw4w9WgXcQ');
      expect(key).toContain('metadata');
    });

    it('suggestions key includes lowercased prefix', () => {
      const key = CacheKeys.suggestions('HEL', 10);
      expect(key).toContain('hel');
    });
  });

  // ──────────────────────────────────────────────────────────
  // 7.1 Search result caching
  // ──────────────────────────────────────────────────────────
  describe('Task 7.1 – Search result caching', () => {
    const params: SearchParams = { query: 'hello', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 };

    it('getSearchResults returns null on miss', async () => {
      const result = await manager.getSearchResults(params);
      expect(result).toBeNull();
    });

    it('getSearchResults records a miss', async () => {
      await manager.getSearchResults(params);
      const stats = manager.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
    });

    it('getSearchResults records a hit when cache returns data', async () => {
      const cachedData = { results: [], total: 5, query: 'hello', accent: 'ALL', accentCounts: {} as any };
      mockCacheOps.get.mockResolvedValue(cachedData);

      await manager.getSearchResults(params);
      const stats = manager.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('setSearchResults writes with correct TTL', async () => {
      const data = { results: [], total: 0, query: 'hello', accent: 'ALL', accentCounts: {} as any };
      await manager.setSearchResults(params, data);

      expect(mockCacheOps.set).toHaveBeenCalledWith(
        expect.any(String),
        data,
        expect.objectContaining({ ttl: CACHE_TTL.SEARCH_RESULTS })
      );
    });

    it('getSuggestions returns null on miss', async () => {
      const result = await manager.getSuggestions('hel', 10);
      expect(result).toBeNull();
    });

    it('setSuggestions stores with SUGGESTIONS TTL', async () => {
      await manager.setSuggestions('hel', 10, ['hello', 'help']);
      expect(mockCacheOps.set).toHaveBeenCalledWith(
        expect.any(String),
        ['hello', 'help'],
        expect.objectContaining({ ttl: CACHE_TTL.SUGGESTIONS })
      );
    });

    it('invalidateSearchCache calls invalidate for all search patterns', async () => {
      await manager.invalidateSearchCache();
      expect(mockCacheOps.invalidate).toHaveBeenCalledTimes(4);
    });

    it('invalidateSearchCache with query targets specific pattern', async () => {
      await manager.invalidateSearchCache('hello');
      // Should call invalidate with query-specific patterns
      expect(mockCacheOps.invalidate).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  // 7.2 Video metadata caching
  // ──────────────────────────────────────────────────────────
  describe('Task 7.2 – Video metadata caching', () => {
    it('getVideoMetadata returns null on miss', async () => {
      const result = await manager.getVideoMetadata('abc123');
      expect(result).toBeNull();
    });

    it('setVideoMetadata stores with VIDEO_METADATA TTL', async () => {
      const metadata = { id: 'abc123', title: 'Test' };
      await manager.setVideoMetadata('abc123', metadata);

      expect(mockCacheOps.set).toHaveBeenCalledWith(
        expect.stringContaining('abc123'),
        metadata,
        expect.objectContaining({ ttl: CACHE_TTL.VIDEO_METADATA })
      );
    });

    it('getVideoSubtitles records hit and miss correctly', async () => {
      await manager.getVideoSubtitles('abc123');
      expect(manager.getStats().misses).toBe(1);

      const subs = [{ id: 1, text: 'hello' }];
      mockCacheOps.get.mockResolvedValue(subs);
      await manager.getVideoSubtitles('abc123');
      expect(manager.getStats().hits).toBe(1);
    });

    it('invalidateVideoCache invalidates all keys for a video', async () => {
      await manager.invalidateVideoCache('abc123');
      expect(mockCacheOps.invalidate).toHaveBeenCalledWith('video:abc123:*');
    });

    it('warmVideoCache stores metadata and subtitles via mset', async () => {
      const entries = [
        {
          videoId: 'vid1',
          metadata: { id: 'vid1', title: 'Video 1' },
          subtitles: [{ id: 1, text: 'test' }]
        },
        {
          videoId: 'vid2',
          metadata: { id: 'vid2', title: 'Video 2' }
          // no subtitles
        }
      ];

      await manager.warmVideoCache(entries);

      // vid1 → 2 entries (metadata + subtitles), vid2 → 1 entry (metadata only)
      expect(mockCacheOps.mset).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: CacheKeys.videoMetadata('vid1') }),
          expect.objectContaining({ key: CacheKeys.videoSubtitles('vid1') }),
          expect.objectContaining({ key: CacheKeys.videoMetadata('vid2') }),
        ])
      );

      const callArg: any[] = (mockCacheOps.mset.mock.calls[0] as any[])[0];
      expect(callArg).toHaveLength(3);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Popular searches
  // ──────────────────────────────────────────────────────────
  describe('Popular searches', () => {
    it('recordSearchQuery stores incremented count', async () => {
      mockCacheOps.get.mockResolvedValue({ hello: 5 });
      await manager.recordSearchQuery('hello');

      expect(mockCacheOps.set).toHaveBeenCalledWith(
        CacheKeys.popularSearches(),
        expect.objectContaining({ hello: 6 }),
        expect.any(Object)
      );
    });

    it('getPopularSearches returns empty array when no data', async () => {
      mockCacheOps.get.mockResolvedValue(null);
      const result = await manager.getPopularSearches(5);
      expect(result).toEqual([]);
    });

    it('getPopularSearches returns sorted list by count', async () => {
      mockCacheOps.get.mockResolvedValue({ world: 3, hello: 10, test: 7 });
      const result = await manager.getPopularSearches(3);
      expect(result[0].query).toBe('hello');
      expect(result[0].count).toBe(10);
      expect(result[1].query).toBe('test');
    });

    it('getPopularSearches respects topN limit', async () => {
      mockCacheOps.get.mockResolvedValue({ a: 1, b: 2, c: 3, d: 4, e: 5 });
      const result = await manager.getPopularSearches(3);
      expect(result).toHaveLength(3);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Statistics
  // ──────────────────────────────────────────────────────────
  describe('Statistics', () => {
    it('initial stats are all zeros', () => {
      const stats = manager.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('hitRate is correctly calculated', async () => {
      mockCacheOps.get
        .mockResolvedValueOnce({ results: [] })   // hit
        .mockResolvedValueOnce(null)              // miss
        .mockResolvedValueOnce({ results: [] });  // hit

      const params: SearchParams = { query: 'test', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 };
      await manager.getSearchResults(params);
      await manager.getSearchResults(params);
      await manager.getSearchResults(params);

      const stats = manager.getStats();
      // 2 hits, 1 miss → 66.67%
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('tracks by domain', async () => {
      mockCacheOps.get.mockResolvedValueOnce({ results: [] });
      const params: SearchParams = { query: 'hi', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 };
      await manager.getSearchResults(params);

      const stats = manager.getStats();
      expect(stats.byDomain['search']).toBeDefined();
      expect(stats.byDomain['search'].hits).toBe(1);
    });

    it('resetStats clears all counters', async () => {
      const params: SearchParams = { query: 'hi', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 };
      await manager.getSearchResults(params);
      manager.resetStats();
      const stats = manager.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
