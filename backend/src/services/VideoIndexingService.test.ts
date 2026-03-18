import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// ────────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────────

const mockVideoService = {
  videoExists: jest.fn(),
  createVideo: jest.fn(),
  addSubtitles: jest.fn(),
  getSubtitles: jest.fn(),
  getVideoMetadata: jest.fn()
};

const mockYouTubeApi = {
  getVideoMetadata: jest.fn()
};

const mockTranscriptService = {
  fetchTranscript: jest.fn(),
  parseSubtitles: jest.fn(),
  detectAccent: jest.fn()
};

const mockSearchService = {
  deleteVideoSubtitles: jest.fn(),
  indexSubtitle: jest.fn()
};

jest.mock('./VideoService.js', () => ({
  VideoService: jest.fn(() => mockVideoService)
}));
jest.mock('./YouTubeApiService.js', () => ({
  YouTubeApiService: jest.fn(() => mockYouTubeApi)
}));
jest.mock('./YouTubeTranscriptService.js', () => ({
  YouTubeTranscriptService: jest.fn(() => mockTranscriptService)
}));
jest.mock('../elasticsearch/searchService.js', () => ({
  ElasticsearchSearchService: jest.fn(() => mockSearchService)
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

import { VideoIndexingService } from './VideoIndexingService.js';

// ────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────

const mockYTMetadata = {
  id: 'dQw4w9WgXcQ',
  snippet: {
    title: 'Never Gonna Give You Up',
    channelTitle: 'Rick Astley',
    thumbnails: {
      default: { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg' },
      medium: { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg' },
      high: { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg' }
    }
  },
  contentDetails: { duration: 'PT3M32S' }  // 212 seconds
};

const mockParsedSubtitles = [
  { videoId: 'dQw4w9WgXcQ', startTime: 0, endTime: 3.2, text: "We're no strangers to love" },
  { videoId: 'dQw4w9WgXcQ', startTime: 3.5, endTime: 6.1, text: 'You know the rules and so do I' }
];

const mockCreatedSubtitles = mockParsedSubtitles.map((s, i) => ({ ...s, id: i + 1, createdAt: new Date() }));

const mockStoredVideo = {
  id: 'dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  channelName: 'Rick Astley',
  duration: 212,
  accent: 'UK' as const,
  thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  createdAt: new Date(),
  updatedAt: new Date()
};

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('VideoIndexingService (Task 6.2)', () => {
  let service: VideoIndexingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VideoIndexingService();

    // Default happy-path mocks
    mockVideoService.videoExists.mockResolvedValue(false);
    mockVideoService.createVideo.mockResolvedValue(mockStoredVideo);
    mockVideoService.addSubtitles.mockResolvedValue(mockCreatedSubtitles);
    mockVideoService.getSubtitles.mockResolvedValue(mockCreatedSubtitles);
    mockVideoService.getVideoMetadata.mockResolvedValue(mockStoredVideo);
    mockYouTubeApi.getVideoMetadata.mockResolvedValue(mockYTMetadata);
    mockTranscriptService.fetchTranscript.mockResolvedValue([]);
    mockTranscriptService.parseSubtitles.mockReturnValue(mockParsedSubtitles);
    mockTranscriptService.detectAccent.mockReturnValue('UK');
    mockSearchService.deleteVideoSubtitles.mockResolvedValue(undefined);
    mockSearchService.indexSubtitle.mockResolvedValue(undefined);
  });

  // ─── indexVideo ───
  describe('indexVideo()', () => {
    it('should skip already indexed video when forceReindex is false', async () => {
      mockVideoService.videoExists.mockResolvedValue(true);

      const result = await service.indexVideo('dQw4w9WgXcQ');

      expect(result.skipped).toBe(true);
      expect(result.success).toBe(true);
      expect(result.subtitlesIndexed).toBe(0);
      expect(mockYouTubeApi.getVideoMetadata).not.toHaveBeenCalled();
    });

    it('should re-index when forceReindex=true even if video exists', async () => {
      mockVideoService.videoExists.mockResolvedValue(true);

      await service.indexVideo('dQw4w9WgXcQ', { forceReindex: true });

      expect(mockYouTubeApi.getVideoMetadata).toHaveBeenCalledWith('dQw4w9WgXcQ');
    });

    it('should return failure when video not found on YouTube', async () => {
      mockYouTubeApi.getVideoMetadata.mockResolvedValue(null);

      const result = await service.indexVideo('badVideoId');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found on YouTube');
    });

    it('should run the full pipeline and index subtitles', async () => {
      const result = await service.indexVideo('dQw4w9WgXcQ');

      expect(mockYouTubeApi.getVideoMetadata).toHaveBeenCalledWith('dQw4w9WgXcQ');
      expect(mockTranscriptService.fetchTranscript).toHaveBeenCalled();
      expect(mockTranscriptService.parseSubtitles).toHaveBeenCalled();
      expect(mockVideoService.createVideo).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up' })
      );
      expect(mockVideoService.addSubtitles).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.subtitlesIndexed).toBe(2);
    });

    it('should continue with empty subtitles when transcript fetch fails', async () => {
      mockTranscriptService.fetchTranscript.mockRejectedValue(new Error('No transcript'));
      mockTranscriptService.parseSubtitles.mockReturnValue([]);

      const result = await service.indexVideo('dQw4w9WgXcQ', { lang: 'en' });

      expect(result.success).toBe(true);
      expect(result.subtitlesIndexed).toBe(0);
      expect(mockVideoService.addSubtitles).not.toHaveBeenCalled();
    });

    it('should use accent override when provided', async () => {
      await service.indexVideo('dQw4w9WgXcQ', { accentOverride: 'AU' });

      expect(mockVideoService.createVideo).toHaveBeenCalledWith(
        expect.objectContaining({ accent: 'AU' })
      );
    });

    it('should return error result on unexpected failure', async () => {
      mockVideoService.createVideo.mockRejectedValue(new Error('DB error'));

      const result = await service.indexVideo('dQw4w9WgXcQ');

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB error');
    });
  });

  // ─── batchIndexVideos ───
  describe('batchIndexVideos()', () => {
    it('should process all videos and return total counts', async () => {
      const ids = ['vid1', 'vid2', 'vid3'];
      const result = await service.batchIndexVideos(ids);

      expect(result.total).toBe(3);
      expect(result.results).toHaveLength(3);
    });

    it('should count succeeded, failed, and skipped separately', async () => {
      mockVideoService.videoExists
        .mockResolvedValueOnce(false)     // vid1: proceed
        .mockResolvedValueOnce(false)     // vid2: proceed
        .mockResolvedValueOnce(true);     // vid3: skip

      mockYouTubeApi.getVideoMetadata
        .mockResolvedValueOnce(mockYTMetadata)  // vid1: OK
        .mockResolvedValueOnce(null);            // vid2: not found on YouTube

      const result = await service.batchIndexVideos(['vid1', 'vid2', 'vid3']);

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should respect concurrency option', async () => {
      const ids = Array.from({ length: 6 }, (_, i) => `vid${i}`);

      await service.batchIndexVideos(ids, { concurrency: 2 });

      // Each video should have been processed
      expect(mockVideoService.videoExists).toHaveBeenCalledTimes(6);
    });
  });

  // ─── reindexVideoSubtitles ───
  describe('reindexVideoSubtitles()', () => {
    it('should delete and re-index all subtitles for a video', async () => {
      const result = await service.reindexVideoSubtitles('dQw4w9WgXcQ');

      expect(mockSearchService.deleteVideoSubtitles).toHaveBeenCalledWith('dQw4w9WgXcQ');
      expect(mockSearchService.indexSubtitle).toHaveBeenCalledTimes(mockCreatedSubtitles.length);
      expect(result.reindexed).toBe(mockCreatedSubtitles.length);
    });

    it('should throw if video not found in database', async () => {
      mockVideoService.getVideoMetadata.mockResolvedValue(null);

      await expect(service.reindexVideoSubtitles('unknownId')).rejects.toThrow();
    });
  });

  // ─── parseISO8601Duration ───
  describe('parseISO8601Duration()', () => {
    it('should parse PT3M32S to 212', () => {
      expect(service.parseISO8601Duration('PT3M32S')).toBe(212);
    });

    it('should parse PT1H5M30S to 3930', () => {
      expect(service.parseISO8601Duration('PT1H5M30S')).toBe(3930);
    });

    it('should parse PT45S to 45', () => {
      expect(service.parseISO8601Duration('PT45S')).toBe(45);
    });

    it('should return 0 for unknown format', () => {
      expect(service.parseISO8601Duration('INVALID')).toBe(0);
    });

    it('should parse PT0S to 0', () => {
      expect(service.parseISO8601Duration('PT0S')).toBe(0);
    });
  });
});
