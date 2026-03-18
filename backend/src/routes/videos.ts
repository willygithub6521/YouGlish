import { Router, Request, Response, NextFunction } from 'express';
import validation from '../middleware/validation.js';
import { VideoService } from '../services/VideoService.js';
import { createLogger } from '../utils/logger.js';

const router = Router();
const logger = createLogger();

// Lazy-initialize service
let videoService: VideoService | null = null;

function getVideoService(): VideoService {
  if (!videoService) {
    videoService = new VideoService({ cacheEnabled: true });
    logger.info('VideoService initialized');
  }
  return videoService;
}

/**
 * GET /api/videos/:videoId
 * Get video metadata and all its subtitles
 */
router.get(
  '/:videoId',
  validation.validateVideoId(),
  validation.handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { videoId } = req.params;
      const service = getVideoService();

      const [video, subtitles] = await Promise.all([
        service.getVideoMetadata(videoId),
        service.getSubtitles(videoId),
      ]);

      if (!video) {
        res.status(404).json({
          error: {
            code: 'VIDEO_NOT_FOUND',
            message: `Video with ID '${videoId}' not found`,
          },
        });
        return;
      }

      res.json({ video, subtitles });
    } catch (error) {
      logger.error('Error fetching video:', error);
      next(error);
    }
  }
);

/**
 * GET /api/videos/:videoId/metadata
 * Get video metadata only (without subtitles)
 */
router.get(
  '/:videoId/metadata',
  validation.validateVideoId(),
  validation.handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { videoId } = req.params;
      const service = getVideoService();

      const video = await service.getVideoMetadata(videoId);

      if (!video) {
        res.status(404).json({
          error: {
            code: 'VIDEO_NOT_FOUND',
            message: `Video with ID '${videoId}' not found`,
          },
        });
        return;
      }

      res.json({ video });
    } catch (error) {
      logger.error('Error fetching video metadata:', error);
      next(error);
    }
  }
);

/**
 * GET /api/videos/:videoId/subtitles
 * Get video subtitles, optionally filtered by time range
 * 
 * Query params:
 *   start: number (optional) - start time in seconds
 *   end: number (optional) - end time in seconds
 */
router.get(
  '/:videoId/subtitles',
  validation.validateVideoId(),
  validation.handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { videoId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const service = getVideoService();

      const subtitles = await service.getSubtitles(videoId, limit, offset);

      res.json({ subtitles, count: subtitles.length });
    } catch (error) {
      logger.error('Error fetching subtitles:', error);
      next(error);
    }
  }
);

/**
 * GET /api/videos/:videoId/subtitles/at
 * Get subtitle at a specific timestamp
 * 
 * Query params:
 *   time: number (required) - timestamp in seconds
 */
router.get(
  '/:videoId/subtitles/at',
  validation.validateVideoId(),
  validation.handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { videoId } = req.params;
      const time = req.query.time ? parseFloat(req.query.time as string) : undefined;

      if (time === undefined || isNaN(time)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: "Query parameter 'time' is required (timestamp in seconds)",
          },
        });
        return;
      }

      const service = getVideoService();
      const subtitle = await service.getSubtitleAtTime(videoId, time);

      res.json({ subtitle: subtitle || null });
    } catch (error) {
      logger.error('Error fetching subtitle at time:', error);
      next(error);
    }
  }
);

/**
 * GET /api/videos
 * List all videos with optional accent filter
 * 
 * Query params:
 *   accent: Accent (optional) - filter by accent
 *   limit: number (optional, default: 20)
 *   offset: number (optional, default: 0)
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accent = req.query.accent as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const service = getVideoService();
      let videos;
      let total = 0;

      if (accent && accent !== 'ALL') {
        videos = await service.getVideosByAccent(accent as any, limit, offset);
        total = videos.length;
      } else {
        const result = await service.getAllVideos(limit, offset);
        videos = result.videos;
        total = result.total;
      }

      res.json({ videos, count: videos.length, total });
    } catch (error) {
      logger.error('Error listing videos:', error);
      next(error);
    }
  }
);

export { getVideoService };
export default router;