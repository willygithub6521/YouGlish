import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VideoService } from './VideoService.js';
import type { CreateVideoData, UpdateVideoData, VideoMetadata, Subtitle } from '../types/index.js';

// Mock dependencies
vi.mock('../connections/index.js', () => ({
  getDatabaseConnection: vi.fn(() => ({
    getPool: vi.fn(() => mockPool)
  })),
  getRedisConnection: vi.fn(() => mockRedisConnection)
}));

vi.mock('../elasticsearch/searchService.js', () => ({
  ElasticsearchSearchService: vi.fn(() => mockElasticsearchService)
}));

vi.mock('../redis/cacheService.js', () => ({
  CacheService: vi.fn(() => mockCacheService)
}));

vi.mock('../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

// Mock objects
const mockPool = {
  query: vi.fn()
};

const mockRedisConnection = {};

const mockElasticsearchService = {
  indexSubtitle: vi.fn(),
  deleteVideoSubtitles: vi.fn()
};

const mockCacheService = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  invalidate: vi.fn(),
  exists: vi.fn()
};

const mockVideoModel = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByAccent: vi.fn(),
  getCountByAccent: vi.fn(),
  exists: vi.fn(),
  findAll: vi.fn(),
  getTotalCount: vi.fn()
};

const mockSubtitleModel = {
  createBatch: vi.fn(),
  findByVideoId: vi.fn(),
  deleteByVideoId: vi.fn(),
  findWithContext: vi.fn(),
  findAtTime: vi.fn()
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
    vi.clearAllMocks();
    
    // Mock the models by replacing the constructor behavior
    vi.doMock('../database/models/Video.js', () => ({
      VideoModel: vi.fn(() => mockVideoModel)
    }));
    
    vi.doMock('../database/models/Subtitle.js', () => ({
      SubtitleModel: vi.fn(() => mockSubtitleModel)
    }));

    videoService = new VideoService({ cacheEnabled: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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