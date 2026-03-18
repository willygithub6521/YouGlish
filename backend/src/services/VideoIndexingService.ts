import { VideoService } from './VideoService.js';
import { YouTubeApiService } from './YouTubeApiService.js';
import { YouTubeTranscriptService } from './YouTubeTranscriptService.js';
import { ElasticsearchSearchService } from '../elasticsearch/searchService.js';
import { createLogger } from '../utils/logger.js';
import type { Accent } from '../types/index.js';

const logger = createLogger();

export interface IndexVideoOptions {
  /** Force re-index even if video already exists */
  forceReindex?: boolean;
  /** Language code for transcript fetching */
  lang?: string;
  /** Override the detected accent */
  accentOverride?: Accent;
}

export interface IndexVideoResult {
  videoId: string;
  success: boolean;
  subtitlesIndexed: number;
  error?: string;
  skipped?: boolean;
}

export interface BatchIndexResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: IndexVideoResult[];
}

/**
 * VideoIndexingService - Orchestrates the full video processing pipeline
 *
 * Pipeline stages:
 *   1. Fetch video metadata from YouTube Data API
 *   2. Store/update video in PostgreSQL
 *   3. Fetch transcript from YouTube Transcript API
 *   4. Parse & normalise subtitles
 *   5. Store subtitles in PostgreSQL
 *   6. Index subtitles in Elasticsearch for search
 */
export class VideoIndexingService {
  private videoService: VideoService;
  private youtubeApi: YouTubeApiService;
  private transcriptService: YouTubeTranscriptService;
  private searchService: ElasticsearchSearchService;

  constructor() {
    this.videoService = new VideoService({ cacheEnabled: false }); // skip cache during indexing
    this.youtubeApi = new YouTubeApiService();
    this.transcriptService = new YouTubeTranscriptService();
    this.searchService = new ElasticsearchSearchService();
  }

  /**
   * Index a single video: fetch metadata + transcript → store → index
   */
  async indexVideo(videoId: string, options: IndexVideoOptions = {}): Promise<IndexVideoResult> {
    logger.info(`Starting indexing for video: ${videoId}`);

    try {
      // ── Stage 1: Check if already indexed ──────────────────────────────
      if (!options.forceReindex) {
        const exists = await this.videoService.videoExists(videoId);
        if (exists) {
          logger.info(`Video ${videoId} already indexed, skipping`);
          return { videoId, success: true, subtitlesIndexed: 0, skipped: true };
        }
      }

      // ── Stage 2: Fetch metadata from YouTube API ────────────────────────
      const ytMetadata = await this.youtubeApi.getVideoMetadata(videoId);
      if (!ytMetadata) {
        return {
          videoId,
          success: false,
          subtitlesIndexed: 0,
          error: `Video ${videoId} not found on YouTube`,
        };
      }

      // Parse duration from ISO 8601 (e.g. PT3M12S → 192s)
      const duration = this.parseISO8601Duration(ytMetadata.contentDetails?.duration || 'PT0S');

      // ── Stage 3: Fetch transcript ───────────────────────────────────────
      const lang = options.lang || 'en';
      let transcriptData: any[] = [];
      let detectedAccent: Accent = options.accentOverride || 'OTHER';

      try {
        transcriptData = await this.transcriptService.fetchTranscript(videoId, lang);
        if (!options.accentOverride) {
          detectedAccent = this.transcriptService.detectAccent(lang);
        }
      } catch (transcriptErr) {
        logger.warn(`Could not fetch transcript for ${videoId}, continuing with empty subtitles`);
      }

      // ── Stage 4: Parse subtitles ────────────────────────────────────────
      const parsedSubtitles = this.transcriptService.parseSubtitles(transcriptData, videoId);

      // ── Stage 5: Store video in PostgreSQL ──────────────────────────────
      const videoData = {
        id: videoId,
        title: ytMetadata.snippet.title,
        channelName: ytMetadata.snippet.channelTitle,
        duration,
        accent: options.accentOverride || detectedAccent,
        thumbnailUrl: ytMetadata.snippet.thumbnails?.high?.url ||
                      ytMetadata.snippet.thumbnails?.medium?.url ||
                      ytMetadata.snippet.thumbnails?.default?.url || '',
      };

      await this.videoService.createVideo(videoData);
      logger.info(`Stored video metadata: ${videoId}`);

      // ── Stage 6: Store subtitles + index in Elasticsearch ───────────────
      let subtitlesIndexed = 0;
      if (parsedSubtitles.length > 0) {
        const createdSubtitles = await this.videoService.addSubtitles(videoId, parsedSubtitles);
        subtitlesIndexed = createdSubtitles.length;
        logger.info(`Indexed ${subtitlesIndexed} subtitles for ${videoId}`);
      }

      return { videoId, success: true, subtitlesIndexed };

    } catch (err: unknown) {
      const error = err as Error;
      logger.error(`Indexing failed for video ${videoId}:`, error.message);
      return { videoId, success: false, subtitlesIndexed: 0, error: error.message };
    }
  }

  /**
   * Batch index a list of video IDs, with concurrency control
   */
  async batchIndexVideos(
    videoIds: string[],
    options: IndexVideoOptions & { concurrency?: number } = {}
  ): Promise<BatchIndexResult> {
    const concurrency = options.concurrency ?? 3;
    const results: IndexVideoResult[] = [];

    logger.info(`Starting batch index: ${videoIds.length} videos, concurrency=${concurrency}`);

    // Process in chunks
    for (let i = 0; i < videoIds.length; i += concurrency) {
      const chunk = videoIds.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(id => this.indexVideo(id, options))
      );
      results.push(...chunkResults);
      logger.info(`Batch progress: ${Math.min(i + concurrency, videoIds.length)}/${videoIds.length}`);
    }

    const succeeded = results.filter(r => r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => !r.success).length;

    logger.info(`Batch index complete: ${succeeded} succeeded, ${skipped} skipped, ${failed} failed`);

    return {
      total: videoIds.length,
      succeeded,
      failed,
      skipped,
      results,
    };
  }

  /**
   * Re-index a video's subtitles in Elasticsearch only (no DB update)
   */
  async reindexVideoSubtitles(videoId: string): Promise<{ videoId: string; reindexed: number }> {
    try {
      logger.info(`Re-indexing subtitles for video: ${videoId}`);

      // Delete existing ES documents
      await this.searchService.deleteVideoSubtitles(videoId);

      // Fetch subtitles from DB and re-index
      const subtitles = await this.videoService.getSubtitles(videoId);
      const video = await this.videoService.getVideoMetadata(videoId);
      
      if (!video) {
        throw new Error(`Video ${videoId} not found in database`);
      }

      for (const subtitle of subtitles) {
        await this.searchService.indexSubtitle({
          subtitle_id: subtitle.id,
          video_id: subtitle.videoId,
          text: subtitle.text,
          start_time: subtitle.startTime,
          end_time: subtitle.endTime,
          accent: video.accent
        });
      }

      logger.info(`Re-indexed ${subtitles.length} subtitles for ${videoId}`);
      return { videoId, reindexed: subtitles.length };

    } catch (err: unknown) {
      const error = err as Error;
      logger.error(`Re-indexing failed for ${videoId}:`, error.message);
      throw new Error(`Failed to re-index video ${videoId}: ${error.message}`);
    }
  }

  /**
   * Parse ISO 8601 duration string to total seconds
   * e.g. "PT3M12S" → 192, "PT1H5M30S" → 3930
   */
  parseISO8601Duration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    return hours * 3600 + minutes * 60 + seconds;
  }
}
