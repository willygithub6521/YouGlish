/**
 * Server Integration for Connection Layers
 * 
 * Integrates the unified connection management system with the Express server
 */

import { Express } from 'express';
import { createLogger } from '../utils/logger.js';
import { connectionManager, getConnectionsHealth } from './index.js';
import { HealthMonitor } from './healthMonitor.js';

const logger = createLogger();

/**
 * Initialize database connections for the server
 */
export async function initializeServerConnections(): Promise<void> {
  logger.info('Initializing server database connections...');
  
  try {
    await connectionManager.initialize();
    logger.info('✅ All database connections initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize database connections:', error);
    throw error;
  }
}

/**
 * Setup health monitoring for the server
 */
export function setupHealthMonitoring(): HealthMonitor {
  logger.info('Setting up health monitoring...');
  
  const healthMonitor = new HealthMonitor({
    checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'), // 1 minute
    alertThreshold: parseInt(process.env.HEALTH_ALERT_THRESHOLD || '3'),
    recoveryAttempts: parseInt(process.env.HEALTH_RECOVERY_ATTEMPTS || '3'),
  });

  // Register connections with health monitor
  try {
    const connections = {
      database: connectionManager.getDatabaseConnection(),
      elasticsearch: connectionManager.getElasticsearchConnection(),
      redis: connectionManager.getRedisConnection(),
    };

    // Create pool managers for health monitoring
    const poolManagers = {
      database: connections.database as any, // Will be properly typed in actual implementation
      elasticsearch: connections.elasticsearch as any,
      redis: connections.redis as any,
    };

    healthMonitor.registerConnections(poolManagers);
    
    // Set up event listeners
    healthMonitor.on('healthCheck', (report) => {
      if (!report.overall.healthy) {
        logger.warn('Unhealthy services detected in health check', {
          unhealthyServices: report.services
            .filter(s => !s.healthy)
            .map(s => ({ service: s.service, error: s.error })),
        });
      }
    });

    healthMonitor.on('serviceAlert', (alert) => {
      logger.error(`🚨 Service alert: ${alert.service} has failed ${alert.consecutiveFailures} times`, {
        service: alert.service,
        consecutiveFailures: alert.consecutiveFailures,
        threshold: alert.threshold,
        error: alert.status.error,
      });
    });

    healthMonitor.on('serviceFailure', (failure) => {
      logger.warn(`Service failure detected: ${failure.service}`, {
        service: failure.service,
        consecutiveFailures: failure.consecutiveFailures,
        error: failure.status.error,
      });
    });

    healthMonitor.start();
    logger.info('✅ Health monitoring started');
    
  } catch (error) {
    logger.error('❌ Failed to setup health monitoring:', error);
    throw error;
  }

  return healthMonitor;
}

/**
 * Add health check routes to Express app
 */
export function addHealthRoutes(app: Express): void {
  logger.info('Adding health check routes...');

  // Basic health check
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'youtube-pronunciation-search-api',
    });
  });

  // Database connections health check
  app.get('/health/connections', async (req, res) => {
    try {
      const health = await getConnectionsHealth();
      
      const allHealthy = health.database.connected && 
                        health.elasticsearch.connected && 
                        health.redis.connected;
      
      const status = allHealthy ? 200 : 503;
      
      res.status(status).json({
        status: allHealthy ? 'OK' : 'DEGRADED',
        timestamp: new Date().toISOString(),
        connections: health,
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Detailed health check with performance metrics
  app.get('/health/detailed', async (req, res) => {
    try {
      const health = await getConnectionsHealth();
      
      // Get additional server metrics
      const serverMetrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      };

      const allHealthy = health.database.connected && 
                        health.elasticsearch.connected && 
                        health.redis.connected;
      
      const status = allHealthy ? 200 : 503;
      
      res.status(status).json({
        status: allHealthy ? 'OK' : 'DEGRADED',
        timestamp: new Date().toISOString(),
        connections: health,
        server: serverMetrics,
      });
    } catch (error) {
      logger.error('Detailed health check failed:', error);
      res.status(503).json({
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        error: 'Detailed health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  logger.info('✅ Health check routes added');
}

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown(healthMonitor?: HealthMonitor): void {
  logger.info('Setting up graceful shutdown handlers...');

  const gracefulShutdown = async (signal: string) => {
    logger.info(`🛑 Received ${signal}, starting graceful shutdown...`);

    try {
      // Stop health monitoring
      if (healthMonitor) {
        healthMonitor.stop();
        logger.info('✅ Health monitoring stopped');
      }

      // Close database connections
      await connectionManager.shutdown();
      logger.info('✅ Database connections closed');

      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  // Handle different shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught exception:', error);
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled promise rejection:', { reason, promise });
    gracefulShutdown('unhandledRejection');
  });

  logger.info('✅ Graceful shutdown handlers configured');
}

/**
 * Complete server initialization with connection layers
 */
export async function initializeServerWithConnections(app: Express): Promise<{
  healthMonitor: HealthMonitor;
}> {
  logger.info('🚀 Starting server initialization with connection layers...');

  try {
    // Initialize database connections
    await initializeServerConnections();

    // Setup health monitoring
    const healthMonitor = setupHealthMonitoring();

    // Add health check routes
    addHealthRoutes(app);

    // Setup graceful shutdown
    setupGracefulShutdown(healthMonitor);

    logger.info('✅ Server initialization with connection layers completed');

    return { healthMonitor };
  } catch (error) {
    logger.error('❌ Server initialization failed:', error);
    throw error;
  }
}

/**
 * Middleware to check database connections before processing requests
 */
export function createConnectionCheckMiddleware() {
  return async (req: any, res: any, next: any) => {
    // Skip connection check for health endpoints
    if (req.path.startsWith('/health')) {
      return next();
    }

    try {
      // Quick connection check (only if not ready)
      if (!connectionManager.isReady()) {
        return res.status(503).json({
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Database connections not ready',
          },
        });
      }

      next();
    } catch (error) {
      logger.error('Connection check middleware error:', error);
      res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database connection check failed',
        },
      });
    }
  };
}

/**
 * Get connection instances for use in routes/services
 */
export function getConnections() {
  if (!connectionManager.isReady()) {
    throw new Error('Connection manager not initialized');
  }

  return {
    database: connectionManager.getDatabaseConnection(),
    elasticsearch: connectionManager.getElasticsearchConnection(),
    redis: connectionManager.getRedisConnection(),
  };
}