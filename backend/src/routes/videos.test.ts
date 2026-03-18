import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

// ────────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────────

const mockVideoService = {
  getVideoMetadata: jest.fn(),
  getSubtitles: jest.fn(),
  createVideo: jest.fn(),
  updateVideo: jest.fn(),
  deleteVideo: jest.fn(),
  addSubtitles: jest.fn(),
  getVideosByAccent: jest.fn(),
  getAccentCounts: jest.fn(),
  videoExists: jest.fn(),
  getSubtitleAtTime: jest.fn(),
  getAllVideos: jest.fn(),
  getHealthStatus: jest.fn()
};

jest.mock('../services/VideoService.js', () => ({
  VideoService: jest.fn(() => mockVideoService)
}));

jest.mock('../connections/index.js', () => ({
  getDatabaseConnection: jest.fn(() => ({ getPool: jest.fn() })),
  getRedisConnection: jest.fn(() => ({ getConnection: jest.fn() }))
}));

jest.mock('../utils/logger.js', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn()
  }))
}));

// Import AFTER mocks
import videosRouter from '../routes/videos.js';

// Build test app
const app = express();
app.use(express.json());

// Minimal validation stub for /:videoId (YouTube-style 11-char ID)
app.use('/api/videos', (req: Request, res: Response, next: NextFunction) => {
  const videoIdMatch = req.path.match(/^\/([\w-]{11})/);
  if (videoIdMatch) {
    next();
  } else if (req.path.startsWith('/')) {
    const segment = req.path.split('/')[1];
    if (segment && segment !== 'subtitles' && segment.length !== 11) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid video ID' } });
      return;
    }
    next();
  } else {
    next();
  }
}, videosRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: { message: err.message } });
});

// ────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────

const mockVideo = {
  id: 'dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  channelName: 'Rick Astley',
  duration: 212,
  accent: 'UK',
  thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

const mockSubtitles = [
  { id: 1, videoId: 'dQw4w9WgXcQ', startTime: 0.5, endTime: 3.2, text: "We're no strangers to love", createdAt: new Date() },
  { id: 2, videoId: 'dQw4w9WgXcQ', startTime: 3.5, endTime: 6.1, text: 'You know the rules and so do I', createdAt: new Date() }
];

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('Video Routes (Task 6.1 & 6.3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── GET /api/videos/:videoId ───
  describe('GET /api/videos/:videoId', () => {
    it('should return video and subtitles when found', async () => {
      mockVideoService.getVideoMetadata.mockResolvedValue(mockVideo);
      mockVideoService.getSubtitles.mockResolvedValue(mockSubtitles);

      const res = await request(app)
        .get('/api/videos/dQw4w9WgXcQ')
        .expect(200);

      expect(res.body).toHaveProperty('video');
      expect(res.body).toHaveProperty('subtitles');
      expect(res.body.video.id).toBe('dQw4w9WgXcQ');
      expect(res.body.video.title).toBe('Never Gonna Give You Up');
      expect(res.body.subtitles).toHaveLength(2);
    });

    it('should return 404 when video not found', async () => {
      mockVideoService.getVideoMetadata.mockResolvedValue(null);
      mockVideoService.getSubtitles.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/videos/dQw4w9WgXcQ')
        .expect(404);

      expect(res.body.error.code).toBe('VIDEO_NOT_FOUND');
    });

    it('should handle service errors gracefully', async () => {
      mockVideoService.getVideoMetadata.mockRejectedValue(new Error('Database error'));
      mockVideoService.getSubtitles.mockRejectedValue(new Error('Database error'));

      const res = await request(app)
        .get('/api/videos/dQw4w9WgXcQ')
        .expect(500);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ─── GET /api/videos/:videoId/metadata ───
  describe('GET /api/videos/:videoId/metadata', () => {
    it('should return only metadata when found', async () => {
      mockVideoService.getVideoMetadata.mockResolvedValue(mockVideo);

      const res = await request(app)
        .get('/api/videos/dQw4w9WgXcQ/metadata')
        .expect(200);

      expect(res.body).toHaveProperty('video');
      expect(res.body).not.toHaveProperty('subtitles');
      expect(res.body.video.channelName).toBe('Rick Astley');
    });

    it('should return 404 when video not found', async () => {
      mockVideoService.getVideoMetadata.mockResolvedValue(null);

      await request(app)
        .get('/api/videos/dQw4w9WgXcQ/metadata')
        .expect(404);
    });
  });

  // ─── GET /api/videos/:videoId/subtitles ───
  describe('GET /api/videos/:videoId/subtitles', () => {
    it('should return subtitles for a video', async () => {
      mockVideoService.getSubtitles.mockResolvedValue(mockSubtitles);

      const res = await request(app)
        .get('/api/videos/dQw4w9WgXcQ/subtitles')
        .expect(200);

      expect(res.body).toHaveProperty('subtitles');
      expect(res.body).toHaveProperty('count', 2);
      expect(res.body.subtitles).toHaveLength(2);
    });

    it('should pass limit and offset to service', async () => {
      mockVideoService.getSubtitles.mockResolvedValue([]);

      await request(app)
        .get('/api/videos/dQw4w9WgXcQ/subtitles?limit=10&offset=5')
        .expect(200);

      expect(mockVideoService.getSubtitles).toHaveBeenCalledWith('dQw4w9WgXcQ', 10, 5);
    });

    it('should return empty subtitles for unknown video', async () => {
      mockVideoService.getSubtitles.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/videos/dQw4w9WgXcQ/subtitles')
        .expect(200);

      expect(res.body.subtitles).toHaveLength(0);
      expect(res.body.count).toBe(0);
    });
  });

  // ─── GET /api/videos/:videoId/subtitles/at ───
  describe('GET /api/videos/:videoId/subtitles/at', () => {
    it('should return 400 when time is missing', async () => {
      const res = await request(app)
        .get('/api/videos/dQw4w9WgXcQ/subtitles/at')
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return subtitle at given timestamp', async () => {
      mockVideoService.getSubtitleAtTime.mockResolvedValue(mockSubtitles[0]);

      const res = await request(app)
        .get('/api/videos/dQw4w9WgXcQ/subtitles/at?time=1.5')
        .expect(200);

      expect(res.body).toHaveProperty('subtitle');
      expect(res.body.subtitle.text).toBe("We're no strangers to love");
    });

    it('should return null subtitle when no match at time', async () => {
      mockVideoService.getSubtitleAtTime.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/videos/dQw4w9WgXcQ/subtitles/at?time=999')
        .expect(200);

      expect(res.body.subtitle).toBeNull();
    });
  });

  // ─── GET /api/videos ───
  describe('GET /api/videos', () => {
    it('should return list of all videos', async () => {
      mockVideoService.getAllVideos.mockResolvedValue({ videos: [mockVideo], total: 1 });

      const res = await request(app)
        .get('/api/videos')
        .expect(200);

      expect(res.body).toHaveProperty('videos');
      expect(res.body).toHaveProperty('count', 1);
      expect(res.body).toHaveProperty('total', 1);
      expect(res.body.videos[0].id).toBe('dQw4w9WgXcQ');
    });

    it('should filter by accent when accent param provided', async () => {
      mockVideoService.getVideosByAccent.mockResolvedValue([mockVideo]);

      const res = await request(app)
        .get('/api/videos?accent=UK')
        .expect(200);

      expect(mockVideoService.getVideosByAccent).toHaveBeenCalledWith('UK', 20, 0);
      expect(res.body.videos).toHaveLength(1);
    });

    it('should pass pagination params to service', async () => {
      mockVideoService.getAllVideos.mockResolvedValue({ videos: [], total: 0 });

      await request(app)
        .get('/api/videos?limit=5&offset=10')
        .expect(200);

      expect(mockVideoService.getAllVideos).toHaveBeenCalledWith(5, 10);
    });
  });
});
