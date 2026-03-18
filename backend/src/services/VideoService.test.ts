import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { VideoService } from './VideoService.js';
import type { CreateVideoData, UpdateVideoData, VideoMetadata, Subtitle } from '../types/index.js';

// Mock dependencies
jest.mock('../connections/index.js', () => ({
  getDatabaseConnection: jest.fn(() => ({
    getPool: jest.fn(() => mockPool)
  })),
  getRedisConnection: jest.fn(() => mockRedisConnection)
}));

jest.mock('../elasticsearch/searchService.js', () => ({
  ElasticsearchSearchService: jest.fn(() => mockElasticsearchService)
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

jest.mock('../database/models/Video.js', () => ({
  VideoModel: jest.fn(() => mockVideoModel)
}));

jest.mock('../database/models/Subtitle.js', () => ({
  SubtitleModel: jest.fn(() => mockSubtitleModel)
}));

// Mock objects
const mockPool = {
  query: jest.fn()
};

const mockRedisConnection = {
  getConnection: jest.fn(() => ({}))
};

const mockElasticsearchService = {
  indexSubtitle: jest.fn(),
  deleteVideoSubtitles: jest.fn(),
  getSearchStats: jest.fn()
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  invalidate: jest.fn(),
  exists: jest.fn()
};

const mockVideoModel = {
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByAccent: jest.fn(),
  getCountByAccent: jest.fn(),
  exists: jest.fn(),
  findAll: jest.fn(),
  getTotalCount: jest.fn()
};

const mockSubtitleModel = {
  createBatch: jest.fn(),
  findByVideoId: jest.fn(),
  deleteByVideoId: jest.fn(),
  findWithContext: jest.fn(),
  findAtTime: jest.fn()
};

describe('VideoService', () => {
  let videoService: VideoService;

  const mockVideoData: VideoMetadata = {
    id: 'test-video-1',
    title: 'Test Video',
    channelName: 'Test Channel',
    duration: 300,
    accent: 'US',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockSubtitleData: Subtitle = {
    id: 1,
    videoId: 'test-video-1',
    startTime: 10.5,
    endTime: 15.2,
    text: 'Hello world',
    createdAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    videoService = new VideoService({ cacheEnabled: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getVideoMetadata', () => {
    it('should return cached video metadata when available', async () => {
      mockCacheService.get.mockResolvedValue(mockVideoData);

      const result = await videoService.getVideoMetadata('test-video-1');

      expect(result).toEqual(mockVideoData);
      expect(mockCacheService.get).toHaveBeenCalledWith('video:test-video-1:metadata');
      expect(mockVideoModel.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockVideoModel.findById.mockResolvedValue(mockVideoData);

      const result = await videoService.getVideoMetadata('test-video-1');

      expect(result).toEqual(mockVideoData);
      expect(mockVideoModel.findById).toHaveBeenCalledWith('test-video-1');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'video:test-video-1:metadata',
        mockVideoData,
        { ttl: 24 * 60 * 60 }
      );
    });

    it('should return null when video not found', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockVideoModel.findById.mockResolvedValue(null);

      const result = await videoService.getVideoMetadata('nonexistent');

      expect(result).toBeNull();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockVideoModel.findById.mockRejectedValue(new Error('Database error'));

      await expect(videoService.getVideoMetadata('test-video-1'))
        .rejects.toThrow('Failed to get video metadata: Database error');
    });
  });

  describe('createVideo', () => {
    const createData: CreateVideoData = {
      id: 'new-video',
      title: 'New Video',
      channelName: 'New Channel',
      duration: 200,
      accent: 'UK',
      thumbnailUrl: 'https://example.com/new-thumb.jpg'
    };

    it('should create video and invalidate cache', async () => {
      const createdVideo = { ...createData, createdAt: new Date(), updatedAt: new Date() };
      mockVideoModel.create.mockResolvedValue(createdVideo);

      const result = await videoService.createVideo(createData);

      expect(result).toEqual(createdVideo);
      expect(mockVideoModel.create).toHaveBeenCalledWith(createData);
      expect(mockCacheService.invalidate).toHaveBeenCalledWith('video:new-video:*');
    });

    it('should handle creation errors', async () => {
      mockVideoModel.create.mockRejectedValue(new Error('Creation failed'));

      await expect(videoService.createVideo(createData))
        .rejects.toThrow('Failed to create video: Creation failed');
    });
  });

  describe('addSubtitles', () => {
    const subtitleData = [
      {
        videoId: 'test-video-1',
        startTime: 0,
        endTime: 5,
        text: 'First subtitle'
      },
      {
        videoId: 'test-video-1',
        startTime: 5,
        endTime: 10,
        text: 'Second subtitle'
      }
    ];

    it('should add subtitles and index them for search', async () => {
      mockVideoModel.findById.mockResolvedValue(mockVideoData);
      mockSubtitleModel.createBatch.mockResolvedValue([
        { ...subtitleData[0], id: 1, createdAt: new Date() },
        { ...subtitleData[1], id: 2, createdAt: new Date() }
      ]);
      mockElasticsearchService.indexSubtitle.mockResolvedValue(true);

      const result = await videoService.addSubtitles('test-video-1', subtitleData);

      expect(result).toHaveLength(2);
      expect(mockSubtitleModel.createBatch).toHaveBeenCalledWith(subtitleData);
      expect(mockElasticsearchService.indexSubtitle).toHaveBeenCalledTimes(2);
      expect(mockCacheService.invalidate).toHaveBeenCalledWith('video:test-video-1:*');
    });

    it('should throw error when video not found', async () => {
      mockVideoModel.findById.mockResolvedValue(null);

      await expect(videoService.addSubtitles('nonexistent', subtitleData))
        .rejects.toThrow('Video nonexistent not found');
    });
  });

  describe('deleteVideo', () => {
    it('should delete video, subtitles, and search index', async () => {
      mockElasticsearchService.deleteVideoSubtitles.mockResolvedValue(true);
      mockSubtitleModel.deleteByVideoId.mockResolvedValue(5);
      mockVideoModel.delete.mockResolvedValue(true);

      const result = await videoService.deleteVideo('test-video-1');

      expect(result).toBe(true);
      expect(mockElasticsearchService.deleteVideoSubtitles).toHaveBeenCalledWith('test-video-1');
      expect(mockSubtitleModel.deleteByVideoId).toHaveBeenCalledWith('test-video-1');
      expect(mockVideoModel.delete).toHaveBeenCalledWith('test-video-1');
      expect(mockCacheService.invalidate).toHaveBeenCalledWith('video:test-video-1:*');
    });
  });

  describe('getAccentCounts', () => {
    const mockCounts = {
      ALL: 100,
      US: 40,
      UK: 30,
      AU: 15,
      CA: 10,
      OTHER: 5
    };

    it('should return cached accent counts when available', async () => {
      mockCacheService.get.mockResolvedValue(mockCounts);

      const result = await videoService.getAccentCounts();

      expect(result).toEqual(mockCounts);
      expect(mockCacheService.get).toHaveBeenCalledWith('video:accent:counts');
      expect(mockVideoModel.getCountByAccent).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache when not in cache', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockVideoModel.getCountByAccent.mockResolvedValue(mockCounts);

      const result = await videoService.getAccentCounts();

      expect(result).toEqual(mockCounts);
      expect(mockVideoModel.getCountByAccent).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'video:accent:counts',
        mockCounts,
        { ttl: 60 * 60 }
      );
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status for all components', async () => {
      mockVideoModel.getTotalCount.mockResolvedValue(100);
      mockCacheService.exists.mockResolvedValue(true);
      mockElasticsearchService.getSearchStats.mockResolvedValue({});

      const result = await videoService.getHealthStatus();

      expect(result).toEqual({
        database: true,
        cache: true,
        search: true
      });
    });

    it('should handle component failures', async () => {
      mockVideoModel.getTotalCount.mockRejectedValue(new Error('DB error'));
      mockCacheService.exists.mockRejectedValue(new Error('Cache error'));
      mockElasticsearchService.getSearchStats.mockRejectedValue(new Error('ES error'));

      const result = await videoService.getHealthStatus();

      expect(result).toEqual({
        database: false,
        cache: false,
        search: false
      });
    });
  });
});