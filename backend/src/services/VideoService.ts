import { Pool } from 'pg';
import { VideoModel, VideoMetadata, CreateVideoData, UpdateVideoData } from '../database/models/Video.js';
import { SubtitleModel, Subtitle, CreateSubtitleData } from '../database/models/Subtitle.js';
import { ElasticsearchSearchService } from '../elasticsearch/searchService.js';
import { CacheService } from '../redis/cacheService.js';
import { getDatabaseConnection, getRedisConnection } from '../connections/index.js';
import { createLogger } from '../utils/logger.js';
import type { Accent } from '../types/index.js';

const logger = createLogger();

export interface VideoServiceOptions {
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

/**
 * VideoService - Manages video metadata and subtitles
 * 
 * This service provides high-level operations for:
 * - Video metadata management
 * - Subtitle operations
 * - Integration with search indexing
 * - Caching layer for performance
 */
export class VideoService {
  private videoModel: VideoModel;
  private subtitleModel: SubtitleModel;
  private searchService: ElasticsearchSearchService;
  private cacheService: CacheService;
  private options: VideoServiceOptions;

  constructor(options: VideoServiceOptions = {}) {
    this.options = {
      cacheEnabled: true,
      cacheTTL: 24 * 60 * 60, // 24 hours
      ...options
    };

    // Initialize models and services
    const dbConnection = getDatabaseConnection();
    const pool = dbConnection.getPool();
    
    this.videoModel = new VideoModel(pool);
    this.subtitleModel = new SubtitleModel(pool);
    this.searchService = new ElasticsearchSearchService();
    
    const redisConnection = getRedisConnection();
    this.cacheService = new CacheService(redisConnection);
  }

  /**
   * Get video metadata by ID with caching
   */
  async getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
    const cacheKey = `video:${videoId}:metadata`;

    try {
      // Try cache first if enabled
      if (this.options.cacheEnabled) {
        const cached = await this.cacheService.get<VideoMetadata>(cacheKey);
        if (cached) {
          logger.debug(`Video metadata cache hit for ${videoId}`);
          return cached;
        }
      }

      // Fetch from database
      const video = await this.videoModel.findById(videoId);
      
      if (video && this.options.cacheEnabled) {
        // Cache the result
        await this.cacheService.set(cacheKey, video, { ttl: this.options.cacheTTL });
        logger.debug(`Video metadata cached for ${videoId}`);
      }

      return video;
    } catch (error) {
      logger.error(`Error getting video metadata for ${videoId}:`, error);
      throw new Error(`Failed to get video metadata: ${error.message}`);
    }
  }

  /**
   * Get subtitles for a video with caching
   */
  async getSubtitles(videoId: string, limit = 100, offset = 0): Promise<Subtitle[]> {
    const cacheKey = `video:${videoId}:subtitles:${limit}:${offset}`;

    try {
      // Try cache first if enabled
      if (this.options.cacheEnabled) {
        const cached = await this.cacheService.get<Subtitle[]>(cacheKey);
        if (cached) {
          logger.debug(`Subtitles cache hit for ${videoId}`);
          return cached;
        }
      }

      // Fetch from database
      const subtitles = await this.subtitleModel.findByVideoId(videoId, limit, offset);
      
      if (this.options.cacheEnabled) {
        // Cache the result
        await this.cacheService.set(cacheKey, subtitles, { ttl: this.options.cacheTTL });
        logger.debug(`Subtitles cached for ${videoId}`);
      }

      return subtitles;
    } catch (error) {
      logger.error(`Error getting subtitles for ${videoId}:`, error);
      throw new Error(`Failed to get subtitles: ${error.message}`);
    }
  }

  /**
   * Create a new video with metadata
   */
  async createVideo(videoData: CreateVideoData): Promise<VideoMetadata> {
    try {
      const video = await this.videoModel.create(videoData);
      
      // Invalidate related cache entries
      if (this.options.cacheEnabled) {
        await this.invalidateVideoCache(video.id);
      }

      logger.info(`Created video ${video.id}: ${video.title}`);
      return video;
    } catch (error) {
      logger.error(`Error creating video ${videoData.id}:`, error);
      throw new Error(`Failed to create video: ${error.message}`);
    }
  }

  /**
   * Update video metadata
   */
  async updateVideo(videoId: string, updateData: UpdateVideoData): Promise<VideoMetadata | null> {
    try {
      const video = await this.videoModel.update(videoId, updateData);
      
      // Invalidate cache
      if (this.options.cacheEnabled && video) {
        await this.invalidateVideoCache(videoId);
      }

      if (video) {
        logger.info(`Updated video ${videoId}`);
      }

      return video;
    } catch (error) {
      logger.error(`Error updating video ${videoId}:`, error);
      throw new Error(`Failed to update video: ${error.message}`);
    }
  }

  /**
   * Delete a video and all its subtitles
   */
  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      // Delete from search index first
      await this.searchService.deleteVideoSubtitles(videoId);
      
      // Delete subtitles from database
      await this.subtitleModel.deleteByVideoId(videoId);
      
      // Delete video metadata
      const deleted = await this.videoModel.delete(videoId);
      
      // Invalidate cache
      if (this.options.cacheEnabled) {
        await this.invalidateVideoCache(videoId);
      }

      if (deleted) {
        logger.info(`Deleted video ${videoId} and all its subtitles`);
      }

      return deleted;
    } catch (error) {
      logger.error(`Error deleting video ${videoId}:`, error);
      throw new Error(`Failed to delete video: ${error.message}`);
    }
  }

  /**
   * Add subtitles to a video and index them for search
   */
  async addSubtitles(videoId: string, subtitles: CreateSubtitleData[]): Promise<Subtitle[]> {
    try {
      // Verify video exists
      const video = await this.getVideoMetadata(videoId);
      if (!video) {
        throw new Error(`Video ${videoId} not found`);
      }

      // Create subtitles in database
      const createdSubtitles = await this.subtitleModel.createBatch(subtitles);
      
      // Index subtitles for search
      for (const subtitle of createdSubtitles) {
        const searchDoc = {
          subtitle_id: subtitle.id.toString(),
          video_id: subtitle.videoId,
          text: subtitle.text,
          start_time: subtitle.startTime,
          end_time: subtitle.endTime,
          accent: video.accent
        };
        
        await this.searchService.indexSubtitle(searchDoc);
      }

      // Invalidate cache
      if (this.options.cacheEnabled) {
        await this.invalidateVideoCache(videoId);
      }

      logger.info(`Added ${createdSubtitles.length} subtitles for video ${videoId}`);
      return createdSubtitles;
    } catch (error) {
      logger.error(`Error adding subtitles for video ${videoId}:`, error);
      throw new Error(`Failed to add subtitles: ${error.message}`);
    }
  }

  /**
   * Get videos by accent with pagination
   */
  async getVideosByAccent(accent: Accent, limit = 20, offset = 0): Promise<VideoMetadata[]> {
    try {
      return await this.videoModel.findByAccent(accent, limit, offset);
    } catch (error) {
      logger.error(`Error getting videos by accent ${accent}:`, error);
      throw new Error(`Failed to get videos by accent: ${error.message}`);
    }
  }

  /**
   * Get video count statistics by accent
   */
  async getAccentCounts(): Promise<Record<Accent, number>> {
    const cacheKey = 'video:accent:counts';

    try {
      // Try cache first if enabled
      if (this.options.cacheEnabled) {
        const cached = await this.cacheService.get<Record<Accent, number>>(cacheKey);
        if (cached) {
          logger.debug('Accent counts cache hit');
          return cached;
        }
      }

      // Fetch from database
      const counts = await this.videoModel.getCountByAccent();
      
      if (this.options.cacheEnabled) {
        // Cache for shorter time since this changes frequently
        await this.cacheService.set(cacheKey, counts, { ttl: 60 * 60 }); // 1 hour
        logger.debug('Accent counts cached');
      }

      return counts;
    } catch (error) {
      logger.error('Error getting accent counts:', error);
      throw new Error(`Failed to get accent counts: ${error.message}`);
    }
  }

  /**
   * Check if a video exists
   */
  async videoExists(videoId: string): Promise<boolean> {
    try {
      return await this.videoModel.exists(videoId);
    } catch (error) {
      logger.error(`Error checking if video ${videoId} exists:`, error);
      return false;
    }
  }

  /**
   * Get subtitle with context (previous and next subtitles)
   */
  async getSubtitleWithContext(subtitleId: number): Promise<{
    current: Subtitle | null;
    previous: Subtitle | null;
    next: Subtitle | null;
  }> {
    try {
      return await this.subtitleModel.findWithContext(subtitleId);
    } catch (error) {
      logger.error(`Error getting subtitle context for ${subtitleId}:`, error);
      throw new Error(`Failed to get subtitle context: ${error.message}`);
    }
  }

  /**
   * Get subtitle at specific time
   */
  async getSubtitleAtTime(videoId: string, time: number): Promise<Subtitle | null> {
    try {
      return await this.subtitleModel.findAtTime(videoId, time);
    } catch (error) {
      logger.error(`Error getting subtitle at time ${time} for video ${videoId}:`, error);
      throw new Error(`Failed to get subtitle at time: ${error.message}`);
    }
  }

  /**
   * Get all videos with pagination
   */
  async getAllVideos(limit = 20, offset = 0): Promise<{
    videos: VideoMetadata[];
    total: number;
  }> {
    try {
      const [videos, total] = await Promise.all([
        this.videoModel.findAll(limit, offset),
        this.videoModel.getTotalCount()
      ]);

      return { videos, total };
    } catch (error) {
      logger.error('Error getting all videos:', error);
      throw new Error(`Failed to get videos: ${error.message}`);
    }
  }

  /**
   * Invalidate all cache entries for a video
   */
  private async invalidateVideoCache(videoId: string): Promise<void> {
    try {
      await Promise.all([
        this.cacheService.invalidate(`video:${videoId}:*`),
        this.cacheService.delete('video:accent:counts')
      ]);
      logger.debug(`Cache invalidated for video ${videoId}`);
    } catch (error) {
      logger.warn(`Failed to invalidate cache for video ${videoId}:`, error);
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    database: boolean;
    cache: boolean;
    search: boolean;
  }> {
    try {
      const [dbHealth, cacheHealth, searchHealth] = await Promise.all([
        this.videoModel.getTotalCount().then(() => true).catch(() => false),
        this.cacheService.exists('health:check').then(() => true).catch(() => false),
        this.searchService.getSearchStats().then(() => true).catch(() => false)
      ]);

      return {
        database: dbHealth,
        cache: cacheHealth,
        search: searchHealth
      };
    } catch (error) {
      logger.error('Error checking service health:', error);
      return {
        database: false,
        cache: false,
        search: false
      };
    }
  }
}