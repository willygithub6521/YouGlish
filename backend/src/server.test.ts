import request from 'supertest';
import { jest } from '@jest/globals';

// ────────────────────────────────────────────────────────────────
// Mock all external service dependencies before importing app
// ────────────────────────────────────────────────────────────────

const mockSearchServiceInstance = {
  search: jest.fn().mockResolvedValue({
    results: [],
    total: 0,
    query: 'hello',
    accent: 'ALL',
    accentCounts: { ALL: 0, US: 0, UK: 0, AU: 0, CA: 0, OTHER: 0 }
  }),
  getSuggestions: jest.fn().mockResolvedValue([]),
  searchExactPhrase: jest.fn().mockResolvedValue({
    results: [],
    total: 0,
    query: 'hello',
    accent: 'ALL',
    accentCounts: { ALL: 0, US: 0, UK: 0, AU: 0, CA: 0, OTHER: 0 }
  }),
  getSearchStats: jest.fn().mockResolvedValue({
    totalDocuments: 0,
    accentCounts: {},
    uniqueVideos: 0,
    avgDuration: 0
  }),
  invalidateSearchCache: jest.fn().mockResolvedValue(undefined),
  getHealthStatus: jest.fn().mockResolvedValue({ elasticsearch: true, cache: true })
};

jest.mock('./services/SearchService.js', () => ({
  SearchService: jest.fn(() => mockSearchServiceInstance)
}));

jest.mock('./connections/index.js', () => ({
  getDatabaseConnection: jest.fn(() => ({
    getPool: jest.fn(() => ({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 })
    }))
  })),
  getRedisConnection: jest.fn(() => ({
    getConnection: jest.fn(() => ({
      connect: jest.fn().mockResolvedValue({}),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      setEx: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([])
    }))
  }))
}));

jest.mock('./services/VideoService.js', () => ({
  VideoService: jest.fn(() => ({
    getVideoMetadata: jest.fn().mockResolvedValue({
      id: 'dQw4w9WgXcQ',
      title: 'Test Video',
      channelName: 'Test Channel',
      duration: 212,
      accent: 'US',
      thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      createdAt: new Date(),
      updatedAt: new Date()
    }),
    getSubtitles: jest.fn().mockResolvedValue([]),
    getAllVideos: jest.fn().mockResolvedValue({ videos: [], total: 0 }),
    getVideosByAccent: jest.fn().mockResolvedValue([]),
    getSubtitleAtTime: jest.fn().mockResolvedValue(null),
    getHealthStatus: jest.fn().mockResolvedValue({ database: true, cache: true, search: true })
  }))
}));

jest.mock('./elasticsearch/index.js', () => ({
  checkElasticsearchHealth: jest.fn().mockResolvedValue(true),
  initializeElasticsearch: jest.fn().mockResolvedValue(true)
}));

jest.mock('./utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Import AFTER mocks
import app from './index.js';

describe('Express Server', () => {
  describe('Health Check', () => {
    it('should return 200 for /health endpoint', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return detailed health info for /api/health/detailed', async () => {
      const response = await request(app)
        .get('/api/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('cpu');
    });
  });

  describe('API Routes', () => {
    it('should return API info for /api endpoint', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('endpoints');
    });

    it('should handle search endpoint with validation', async () => {
      // Test missing query parameter
      await request(app)
        .get('/api/search')
        .expect(400);

      // Test valid search query
      const response = await request(app)
        .get('/api/search?q=hello')
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('query', 'hello');
    });

    it('should handle video endpoint with validation', async () => {
      // Test invalid video ID
      await request(app)
        .get('/api/videos/invalid-id')
        .expect(400);

      // Test valid video ID format
      const response = await request(app)
        .get('/api/videos/dQw4w9WgXcQ')
        .expect(200);

      expect(response.body).toHaveProperty('video');
      expect(response.body).toHaveProperty('subtitles');
    });

    it('should handle suggestions endpoint with validation', async () => {
      // Test missing prefix parameter
      await request(app)
        .get('/api/search/suggestions')
        .expect(400);

      // Test valid suggestions query
      const response = await request(app)
        .get('/api/search/suggestions?prefix=hel')
        .expect(200);

      expect(response.body).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should validate search parameters', async () => {
      // Test invalid accent parameter
      const response = await request(app)
        .get('/api/search?q=hello&accent=INVALID')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should validate limit and offset parameters', async () => {
      // Test invalid limit
      await request(app)
        .get('/api/search?q=hello&limit=0')
        .expect(400);

      // Test invalid offset
      await request(app)
        .get('/api/search?q=hello&offset=-1')
        .expect(400);

      // Test valid parameters
      await request(app)
        .get('/api/search?q=hello&limit=10&offset=0')
        .expect(200);
    });
  });

  describe('Security Middleware', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for helmet security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api')
        .set('Origin', 'http://localhost:5173')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Request Validation and Sanitization', () => {
    it('should sanitize malicious input', async () => {
      const maliciousQuery = 'hello<script>alert("xss")</script>';
      const response = await request(app)
        .get(`/api/search?q=${encodeURIComponent(maliciousQuery)}`)
        .expect(200);

      // The query should be sanitized (script tags removed)
      expect(response.body.query).not.toContain('<script>');
    });

    it('should enforce query length limits', async () => {
      const longQuery = 'a'.repeat(201); // Exceeds 200 character limit
      await request(app)
        .get(`/api/search?q=${longQuery}`)
        .expect(400);
    });
  });
});