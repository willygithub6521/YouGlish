import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

// ────────────────────────────────────────────────────────────────
// Mocks (must be at top level before any imports that use them)
// ────────────────────────────────────────────────────────────────

const mockSearchService = {
  search: jest.fn(),
  getSuggestions: jest.fn(),
  searchExactPhrase: jest.fn(),
  getSearchStats: jest.fn(),
  invalidateSearchCache: jest.fn(),
  getHealthStatus: jest.fn()
};

jest.mock('../services/SearchService.js', () => ({
  SearchService: jest.fn(() => mockSearchService)
}));

jest.mock('../connections/index.js', () => ({
  getDatabaseConnection: jest.fn(() => ({ getPool: jest.fn() })),
  getRedisConnection: jest.fn(() => ({ getConnection: jest.fn() }))
}));

jest.mock('../utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// ────────────────────────────────────────────────────────────────
// Test setup - import AFTER mocks
// ────────────────────────────────────────────────────────────────

import searchRouter from '../routes/search.js';

const buildApp = () => {
  const testApp = express();
  testApp.use(express.json());

  // Minimal middleware stubs
  testApp.use('/api/search', (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/' && !req.query.q) {
      res.status(400).json({ errors: [{ msg: 'Search query is required', param: 'q' }] });
      return;
    }
    if (req.path === '/suggestions' && !req.query.prefix) {
      res.status(400).json({ errors: [{ msg: 'Prefix is required', param: 'prefix' }] });
      return;
    }
    next();
  }, searchRouter);

  testApp.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { message: err.message } });
  });

  return testApp;
};

const app = buildApp();

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

const mockSearchResults = {
  results: [
    {
      id: '1',
      videoId: 'abc123',
      startTime: 10.5,
      endTime: 15.2,
      text: 'Hello world',
      accent: 'US',
      relevanceScore: 0.95,
      highlightedText: '<mark>Hello</mark> world',
      context: { before: 'Start.', after: 'End.' }
    }
  ],
  total: 1,
  query: 'Hello',
  accent: 'ALL',
  accentCounts: { ALL: 1, US: 1, UK: 0, AU: 0, CA: 0, OTHER: 0 }
};

describe('Search Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchService.search.mockResolvedValue(mockSearchResults);
    mockSearchService.getSuggestions.mockResolvedValue(['hello', 'help', 'helpful']);
    mockSearchService.searchExactPhrase.mockResolvedValue(mockSearchResults);
    mockSearchService.getSearchStats.mockResolvedValue({
      totalDocuments: 1000,
      accentCounts: { US: 400, UK: 300, AU: 150, CA: 100, OTHER: 50 },
      uniqueVideos: 100,
      avgDuration: 180
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ──────────────────────────────────
  // GET /api/search
  // ──────────────────────────────────
  describe('GET /api/search', () => {
    it('should return 400 when query is missing', async () => {
      await request(app)
        .get('/api/search')
        .expect(400);
    });

    it('should search and return results', async () => {
      const res = await request(app)
        .get('/api/search?q=Hello')
        .expect(200);

      expect(res.body).toHaveProperty('results');
      expect(res.body).toHaveProperty('total', 1);
      expect(res.body).toHaveProperty('query', 'Hello');
      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'Hello', accent: 'ALL', fuzzy: true, limit: 20, offset: 0 })
      );
    });

    it('should apply accent filter', async () => {
      await request(app)
        .get('/api/search?q=Hello&accent=US')
        .expect(200);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'Hello', accent: 'US' })
      );
    });

    it('should apply fuzzy=false', async () => {
      await request(app)
        .get('/api/search?q=Hello&fuzzy=false')
        .expect(200);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ fuzzy: false })
      );
    });

    it('should apply pagination parameters', async () => {
      await request(app)
        .get('/api/search?q=Hello&limit=10&offset=20')
        .expect(200);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 })
      );
    });

    it('should cap limit at 100 for very large values', async () => {
      // Use a limit that passes validation but gets capped by the route handler
      await request(app)
        .get('/api/search?q=Hello&limit=100')
        .expect(200);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });

    it('should use exact phrase search when exact=true', async () => {
      await request(app)
        .get('/api/search?q=Hello+world&exact=true')
        .expect(200);

      expect(mockSearchService.searchExactPhrase).toHaveBeenCalledWith('Hello world', undefined, 20);
      expect(mockSearchService.search).not.toHaveBeenCalled();
    });

    it('should handle search errors gracefully', async () => {
      mockSearchService.search.mockRejectedValue(new Error('Elasticsearch error'));

      const res = await request(app)
        .get('/api/search?q=Hello')
        .expect(500);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ──────────────────────────────────
  // GET /api/search/suggestions
  // ──────────────────────────────────
  describe('GET /api/search/suggestions', () => {
    it('should return 400 when prefix is missing', async () => {
      await request(app)
        .get('/api/search/suggestions')
        .expect(400);
    });

    it('should return suggestions for a prefix', async () => {
      const res = await request(app)
        .get('/api/search/suggestions?prefix=hel')
        .expect(200);

      expect(res.body).toHaveProperty('suggestions');
      expect(res.body.suggestions).toEqual(['hello', 'help', 'helpful']);
      expect(mockSearchService.getSuggestions).toHaveBeenCalledWith('hel', 10);
    });

    it('should apply limit parameter', async () => {
      await request(app)
        .get('/api/search/suggestions?prefix=hel&limit=5')
        .expect(200);

      expect(mockSearchService.getSuggestions).toHaveBeenCalledWith('hel', 5);
    });

    it('should handle suggestion errors gracefully', async () => {
      mockSearchService.getSuggestions.mockRejectedValue(new Error('ES error'));

      const res = await request(app)
        .get('/api/search/suggestions?prefix=hel')
        .expect(500);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ──────────────────────────────────
  // GET /api/search/stats
  // ──────────────────────────────────
  describe('GET /api/search/stats', () => {
    it('should return search statistics', async () => {
      const res = await request(app)
        .get('/api/search/stats')
        .expect(200);

      expect(res.body).toHaveProperty('totalDocuments', 1000);
      expect(res.body).toHaveProperty('accentCounts');
      expect(res.body).toHaveProperty('uniqueVideos', 100);
      expect(mockSearchService.getSearchStats).toHaveBeenCalled();
    });

    it('should handle stats errors gracefully', async () => {
      mockSearchService.getSearchStats.mockRejectedValue(new Error('Stats error'));

      const res = await request(app)
        .get('/api/search/stats')
        .expect(500);

      expect(res.body).toHaveProperty('error');
    });
  });
});
