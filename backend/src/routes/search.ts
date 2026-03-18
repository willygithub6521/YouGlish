import { Router, Request, Response, NextFunction } from 'express';
import validation from '../middleware/validation.js';
import { SearchService } from '../services/SearchService.js';
import { SearchParams } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const router = Router();
const logger = createLogger();

// Lazy-initialize the service to allow mocking in tests
let searchService: SearchService | null = null;

function getSearchService(): SearchService {
  if (!searchService) {
    searchService = new SearchService({ cacheEnabled: true });
    logger.info('SearchService initialized');
  }
  return searchService;
}

/**
 * GET /api/search
 * Main search endpoint for subtitle search
 * 
 * Query params:
 *   q: string (required) - search query
 *   accent: 'ALL' | 'US' | 'UK' | 'AU' | 'CA' | 'OTHER' (optional, default: 'ALL')
 *   fuzzy: boolean (optional, default: true) - enable fuzzy search
 *   limit: number (optional, default: 20, max: 100) - results per page
 *   offset: number (optional, default: 0) - pagination offset
 *   exact: boolean (optional, default: false) - use exact phrase matching
 */
router.get(
  '/',
  validation.validateSearch(),
  validation.handleValidationErrors,
  validation.sanitizeRequest,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const searchParams: SearchParams = {
        query: req.query.q as string,
        accent: (req.query.accent as any) || 'ALL',
        fuzzy: req.query.fuzzy !== 'false',
        limit: req.query.limit ? Math.min(parseInt(req.query.limit as string), 100) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const exact = req.query.exact === 'true';

      logger.debug(`Search request: query="${searchParams.query}" accent=${searchParams.accent} fuzzy=${searchParams.fuzzy} exact=${exact}`);

      const service = getSearchService();
      let results;

      if (exact) {
        // Exact phrase search
        results = await service.searchExactPhrase(
          searchParams.query,
          searchParams.accent === 'ALL' ? undefined : searchParams.accent,
          searchParams.limit
        );
      } else {
        // Regular search (fuzzy or exact match)
        results = await service.search(searchParams);
      }

      res.json(results);
    } catch (error) {
      logger.error('Search error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/search/suggestions
 * Autocomplete suggestions for search input
 * 
 * Query params:
 *   prefix: string (required) - text prefix for suggestions
 *   limit: number (optional, default: 10) - max suggestions to return
 */
router.get(
  '/suggestions',
  validation.validateSuggestions(),
  validation.handleValidationErrors,
  validation.sanitizeRequest,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const prefix = req.query.prefix as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      logger.debug(`Suggestions request: prefix="${prefix}" limit=${limit}`);

      const service = getSearchService();
      const suggestions = await service.getSuggestions(prefix, limit);

      res.json({ suggestions });
    } catch (error) {
      logger.error('Suggestions error:', error);
      next(error);
    }
  }
);

/**
 * GET /api/search/stats
 * Get search statistics and index information
 */
router.get(
  '/stats',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const service = getSearchService();
      const stats = await service.getSearchStats();
      res.json(stats);
    } catch (error) {
      logger.error('Stats error:', error);
      next(error);
    }
  }
);

export { getSearchService };
export default router;