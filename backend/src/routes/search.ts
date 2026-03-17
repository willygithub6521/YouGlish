import { Router, Request, Response, NextFunction } from 'express';
import validation from '../middleware/validation.js';
import { SearchParams, SearchResponse } from '../types/index.js';

const router = Router();

// Search endpoint
router.get(
  '/',
  validation.validateSearch(),
  validation.handleValidationErrors,
  validation.sanitizeRequest,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const searchParams: SearchParams = {
        query: req.query.q as string,
        accent: req.query.accent as any,
        fuzzy: req.query.fuzzy === 'true',
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      // TODO: Implement search service integration
      // For now, return a placeholder response
      const response: SearchResponse = {
        results: [],
        total: 0,
        query: searchParams.query,
        accent: searchParams.accent || 'ALL',
        accentCounts: {
          ALL: 0,
          US: 0,
          UK: 0,
          AU: 0,
          CA: 0,
          OTHER: 0,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Search suggestions endpoint
router.get(
  '/suggestions',
  validation.validateSuggestions(),
  validation.handleValidationErrors,
  validation.sanitizeRequest,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const prefix = req.query.prefix as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      // TODO: Implement suggestions service
      // For now, return empty suggestions
      const suggestions: string[] = [];

      res.json({ suggestions });
    } catch (error) {
      next(error);
    }
  }
);

export default router;