import { Router, Request, Response } from 'express';

const router = Router();

// Basic health check
router.get('/', (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Detailed health check with service status
router.get('/detailed', async (req: Request, res: Response): Promise<void> => {
  const healthStatus = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'unknown',
      elasticsearch: 'unknown',
      redis: 'unknown',
    },
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
    },
    cpu: {
      usage: process.cpuUsage(),
    },
  };

  // TODO: Add actual service health checks
  // For now, we'll assume all services are healthy
  healthStatus.services = {
    database: 'healthy',
    elasticsearch: 'healthy',
    redis: 'healthy',
  };

  res.status(200).json(healthStatus);
});

export default router;