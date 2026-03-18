import { CacheService } from './cacheService';
import { CacheKeys, TTL_POLICIES, Accent } from './cacheKeys';

export interface VideoMetadata {
  id: string;
  title: string;
  channelName: string;
  duration: number;
  accent: Accent;
  thumbnailUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subtitle {
  id: number;
  videoId: string;
  startTime: number;
  endTime: number;
  text: string;
  createdAt: Date;
}

/**
 * Specialized cache service for video-related operations
 */
export class VideoCache {
  constructor(private cacheService: CacheService) {}

  /**
   * Cache video metadata
   */
  async cacheVideoMetadata(videoId: string, metadata: VideoMetadata): Promise<void> {
    const key = CacheKeys.videoMetadata(videoId);
    await this.cacheService.set(key, metadata, {
      ttl: TTL_POLICIES.VIDEO_METADATA,
    });
  }

  /**
   * Get cached video metadata
   */
  async getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
    const key = CacheKeys.videoMetadata(videoId);
    return await this.cacheService.get<VideoMetadata>(key);
  }

  /**
   * Cache video subtitles
   */
  async cacheVideoSubtitles(videoId: string, subtitles: Subtitle[]): Promise<void> {
    const key = CacheKeys.videoSubtitles(videoId);
    await this.cacheService.set(key, subtitles, {
      ttl: TTL_POLICIES.VIDEO_SUBTITLES,
    });
  }

  /**
   * Get cached video subtitles
   */
  async getVideoSubtitles(videoId: string): Promise<Subtitle[] | null> {
    const key = CacheKeys.videoSubtitles(videoId);
    return await this.cacheService.get<Subtitle[]>(key);
  }

  /**
   * Cache both metadata and subtitles for a video
   */
  async cacheVideoData(
    videoId: string,
    metadata: VideoMetadata,
    subtitles: Subtitle[]
  ): Promise<void> {
    await Promise.all([
      this.cacheVideoMetadata(videoId, metadata),
      this.cacheVideoSubtitles(videoId, subtitles),
    ]);
  }

  /**
   * Get both metadata and subtitles for a video
   */
  async getVideoData(videoId: string): Promise<{
    metadata: VideoMetadata | null;
    subtitles: Subtitle[] | null;
  }> {
    const [metadata, subtitles] = await Promise.all([
      this.getVideoMetadata(videoId),
      this.getVideoSubtitles(videoId),
    ]);

    return { metadata, subtitles };
  }

  /**
   * Cache multiple videos at once (batch operation)
   */
  async cacheMultipleVideos(
    videos: Array<{
      videoId: string;
      metadata: VideoMetadata;
      subtitles: Subtitle[];
    }>
  ): Promise<void> {
    const cacheEntries = videos.flatMap(({ videoId, metadata, subtitles }) => [
      {
        key: CacheKeys.videoMetadata(videoId),
        value: metadata,
        ttl: TTL_POLICIES.VIDEO_METADATA,
      },
      {
        key: CacheKeys.videoSubtitles(videoId),
        value: subtitles,
        ttl: TTL_POLICIES.VIDEO_SUBTITLES,
      },
    ] as { key: string; value: any; ttl?: number }[]);

    await this.cacheService.mset(cacheEntries);
  }

  /**
   * Get multiple video metadata at once
   */
  async getMultipleVideoMetadata(videoIds: string[]): Promise<(VideoMetadata | null)[]> {
    const keys = videoIds.map(id => CacheKeys.videoMetadata(id));
    return await this.cacheService.mget<VideoMetadata>(keys);
  }

  /**
   * Get multiple video subtitles at once
   */
  async getMultipleVideoSubtitles(videoIds: string[]): Promise<(Subtitle[] | null)[]> {
    const keys = videoIds.map(id => CacheKeys.videoSubtitles(id));
    return await this.cacheService.mget<Subtitle[]>(keys);
  }

  /**
   * Invalidate all cache entries for a specific video
   */
  async invalidateVideo(videoId: string): Promise<number> {
    const pattern = CacheKeys.patterns.videoAll(videoId);
    return await this.cacheService.invalidate(pattern);
  }

  /**
   * Invalidate multiple videos
   */
  async invalidateMultipleVideos(videoIds: string[]): Promise<number> {
    let totalInvalidated = 0;
    
    for (const videoId of videoIds) {
      const invalidated = await this.invalidateVideo(videoId);
      totalInvalidated += invalidated;
    }
    
    return totalInvalidated;
  }

  /**
   * Check if video data exists in cache
   */
  async hasVideoData(videoId: string): Promise<{
    hasMetadata: boolean;
    hasSubtitles: boolean;
  }> {
    const [hasMetadata, hasSubtitles] = await Promise.all([
      this.cacheService.exists(CacheKeys.videoMetadata(videoId)),
      this.cacheService.exists(CacheKeys.videoSubtitles(videoId)),
    ]);

    return { hasMetadata, hasSubtitles };
  }

  /**
   * Get cache TTL for video data
   */
  async getVideoDataTTL(videoId: string): Promise<{
    metadataTTL: number;
    subtitlesTTL: number;
  }> {
    const [metadataTTL, subtitlesTTL] = await Promise.all([
      this.cacheService.ttl(CacheKeys.videoMetadata(videoId)),
      this.cacheService.ttl(CacheKeys.videoSubtitles(videoId)),
    ]);

    return { metadataTTL, subtitlesTTL };
  }

  /**
   * Refresh cache TTL for video data
   */
  async refreshVideoDataTTL(videoId: string): Promise<void> {
    await Promise.all([
      this.cacheService.expire(
        CacheKeys.videoMetadata(videoId),
        TTL_POLICIES.VIDEO_METADATA
      ),
      this.cacheService.expire(
        CacheKeys.videoSubtitles(videoId),
        TTL_POLICIES.VIDEO_SUBTITLES
      ),
    ]);
  }

  /**
   * Warm up cache with popular videos
   */
  async warmUpPopularVideos(videoIds: string[]): Promise<void> {
    console.log(`Warming up cache for ${videoIds.length} popular videos`);
    
    // This would typically fetch video data from database and cache it
    // Implementation would depend on having access to video service
    for (const videoId of videoIds) {
      console.log(`Warming cache for video: ${videoId}`);
      // Would call video service and cache results
    }
  }

  /**
   * Get cache statistics for video operations
   */
  async getVideoCacheStats(): Promise<{
    cachedVideosCount: number;
    totalMetadataSize: number;
    totalSubtitlesSize: number;
  }> {
    try {
      // This is a simplified implementation
      // In production, you might want to use Redis SCAN for better performance
      return {
        cachedVideosCount: 0, // Would need to implement key counting
        totalMetadataSize: 0,
        totalSubtitlesSize: 0,
      };
    } catch (error) {
      console.error('Error getting video cache stats:', error);
      return {
        cachedVideosCount: 0,
        totalMetadataSize: 0,
        totalSubtitlesSize: 0,
      };
    }
  }
}