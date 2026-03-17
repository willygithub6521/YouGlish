import { Router, Request, Response, NextFunction } from 'express';
import validation from '../middleware/validation.js';
import { VideoMetadata, Subtitle } from '../types/index.js';

const router = Router();

// Get video metadata and subtitles
router.get(
  '/:videoId',
  validation.validateVideoId(),
  validation.handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const videoId = req.params.videoId;

      // TODO: Implement video service integration
      // For now, return a placeholder response
      const video: VideoMetadata = {
        id: videoId,
        title: 'Sample Video',
        channelName: 'Sample Channel',
        duration: 300,
        accent: 'US',
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const subtitles: Subtitle[] = [];

      res.json({
        video,
        subtitles,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get video metadata only
router.get(
  '/:videoId/metadata',
  validation.validateVideoId(),
  validation.handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const videoId = req.params.videoId;

      // TODO: Implement video service integration
      const video: VideoMetadata = {
        id: videoId,
        title: 'Sample Video',
        channelName: 'Sample Channel',
        duration: 300,
        accent: 'US',
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      res.json({ video });
    } catch (error) {
      next(error);
    }
  }
);

// Get video subtitles only
router.get(
  '/:videoId/subtitles',
  validation.validateVideoId(),
  validation.handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const videoId = req.params.videoId;

      // TODO: Implement subtitle service integration
      const subtitles: Subtitle[] = [];

      res.json({ subtitles });
    } catch (error) {
      next(error);
    }
  }
);

export default router;