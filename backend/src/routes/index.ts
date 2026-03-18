import { Router } from 'express';
import searchRoutes from './search.js';
import videoRoutes from './videos.js';
import healthRoutes from './health.js';

const router = Router();

// Mount route modules
router.use('/search', searchRoutes);
router.use('/videos', videoRoutes);
router.use('/health', healthRoutes);

// API info endpoint
router.get('/', (_req, res) => {
  res.json({
    message: 'YouTube Pronunciation Search API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      search: '/api/search',
      videos: '/api/videos',
      health: '/api/health',
    },
  });
});

export default router;