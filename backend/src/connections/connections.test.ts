/**
 * Connection Layers Test Suite
 * 
 * Comprehensive tests for database connection management system
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies before importing modules
jest.mock('../database/connection.js', () => ({
  DatabaseConnection: {
    getInstance: jest.fn().mockReturnValue({
      testConnection: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  },
  createDatabaseConnection: jest.fn(),
}));

jest.mock('../elasticsearch/config.js', () => ({
  default: {
    getInstance: jest.fn().mockReturnValue({
      testConnection: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('../redis/client.js', () => ({
  redisClient: {
    initialize: jest.fn().mockResolvedValue(undefined),
    healthCheck: jest.fn().mockResolvedValue({ connected: true }),
    close: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../utils/logger.js', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Import after mocking
import { ConnectionManager, ConnectionHealth } from './index.js';
import { ConnectionFactory } from './factory.js';
import { HealthMonitor } from './healthMonitor.js';
import { PostgreSQLPoolManager, ElasticsearchConnectionManager, RedisConnectionManager } from './poolManager.js';

describe('Connection Management System', () => {
  let connectionManager: ConnectionManager;
  let connectionFactory: ConnectionFactory;
  let healthMonitor: HealthMonitor;

  beforeEach(() => {
    connectionManager = ConnectionManager.getInstance();
    connectionFactory = ConnectionFactory.getInstance();
    healthMonitor = new HealthMonitor();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (connectionManager.isReady()) {
      await connectionManager.shutdown();
    }
    healthMonitor.stop();
  });

  describe('ConnectionManager', () => {
    it('should be a singleton', () => {
      const instance1 = ConnectionManager.getInstance();
      const instance2 = ConnectionManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize all connections', async () => {
      // Mock successful connections
      const mockDbConnection = {
        testConnection: jest.fn().mockResolvedValue(true),
        close: jest.fn().mockResolvedValue(undefined),
      };
      
      const mockEsConnection = {
        testConnection: jest.fn().mockResolvedValue(true),
        close: jest.fn().mockResolvedValue(undefined),
      };
      
      const mockRedisConnection = {
        initialize: jest.fn().mockResolvedValue(undefined),
        healthCheck: jest.fn().mockResolvedValue({ connected: true }),
        close: jest.fn().mockResolvedValue(undefined),
      };

      // Mock the connection creation
      jest.spyOn(connectionManager as any, 'initializeDatabase')
        .mockResolvedValue(undefined);
      jest.spyOn(connectionManager as any, 'initializeElasticsearch')
        .mockResolvedValue(undefined);
      jest.spyOn(connectionManager as any, 'initializeRedis')
        .mockResolvedValue(undefined);

      await connectionManager.initialize();
      
      expect(connectionManager.isReady()).toBe(true);
    });

    it('should handle initialization failures', async () => {
      // Mock failed database connection
      jest.spyOn(connectionManager as any, 'initializeDatabase')
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(connectionManager.initialize()).rejects.toThrow('Database connection failed');
      expect(connectionManager.isReady()).toBe(false);
    });

    it('should check health of all connections', async () => {
      // Mock connections
      const mockDbConnection = {
        testConnection: jest.fn().mockResolvedValue(true),
      };
      
      const mockEsConnection = {
        testConnection: jest.fn().mockResolvedValue(true),
      };
      
      const mockRedisConnection = {
        healthCheck: jest.fn().mockResolvedValue({ 
          connected: true, 
          latency: 10 
        }),
      };

      // Set up mocked connections
      (connectionManager as any).dbConnection = mockDbConnection;
      (connectionManager as any).esConnection = mockEsConnection;
      (connectionManager as any).redisConnection = mockRedisConnection;

      const health = await connectionManager.checkHealth();

      expect(health).toEqual({
        database: {
          connected: true,
          latency: expect.any(Number),
        },
        elasticsearch: {
          connected: true,
          latency: expect.any(Number),
        },
        redis: {
          connected: true,
          latency: 10,
        },
      });
    });

    it('should handle health check failures gracefully', async () => {
      // Mock failing connections
      const mockDbConnection = {
        testConnection: jest.fn().mockRejectedValue(new Error('DB Error')),
      };
      
      const mockEsConnection = {
        testConnection: jest.fn().mockResolvedValue(false),
      };
      
      const mockRedisConnection = {
        healthCheck: jest.fn().mockResolvedValue({ 
          connected: false, 
          error: 'Redis Error' 
        }),
      };

      // Set up mocked connections
      (connectionManager as any).dbConnection = mockDbConnection;
      (connectionManager as any).esConnection = mockEsConnection;
      (connectionManager as any).redisConnection = mockRedisConnection;

      const health = await connectionManager.checkHealth();

      expect(health.database.connected).toBe(false);
      expect(health.database.error).toBe('DB Error');
      expect(health.elasticsearch.connected).toBe(false);
      expect(health.redis.connected).toBe(false);
      expect(health.redis.error).toBe('Redis Error');
    });

    it('should shutdown all connections gracefully', async () => {
      const mockDbConnection = {
        close: jest.fn().mockResolvedValue(undefined),
      };
      
      const mockEsConnection = {
        close: jest.fn().mockResolvedValue(undefined),
      };
      
      const mockRedisConnection = {
        close: jest.fn().mockResolvedValue(undefined),
      };

      // Set up mocked connections
      (connectionManager as any).dbConnection = mockDbConnection;
      (connectionManager as any).esConnection = mockEsConnection;
      (connectionManager as any).redisConnection = mockRedisConnection;
      (connectionManager as any).isInitialized = true;

      await connectionManager.shutdown();

      expect(mockDbConnection.close).toHaveBeenCalled();
      expect(mockEsConnection.close).toHaveBeenCalled();
      expect(mockRedisConnection.close).toHaveBeenCalled();
      expect(connectionManager.isReady()).toBe(false);
    });
  });

  describe('ConnectionFactory', () => {
    it('should be a singleton', () => {
      const instance1 = ConnectionFactory.getInstance();
      const instance2 = ConnectionFactory.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should validate configuration correctly', () => {
      const validConfig = {
        database: {
          host: 'localhost',
          port: 5432,
          min: 2,
          max: 10,
        },
        elasticsearch: {
          url: 'http://localhost:9200',
          maxRetries: 3,
        },
        redis: {
          port: 6379,
          db: 0,
        },
      };

      const result = connectionFactory.validateConfiguration(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      const invalidConfig = {
        database: {
          port: 70000, // Invalid port
          max: 5,
          min: 10, // min > max
        },
        elasticsearch: {
          url: 'invalid-url', // Invalid URL
          maxRetries: -1, // Negative retries
        },
        redis: {
          port: 0, // Invalid port
          db: 20, // Invalid DB number
        },
      };

      const result = connectionFactory.validateConfiguration(invalidConfig);
      expect(result.errors).toContain('Database port must be between 1 and 65535');
      expect(result.errors).toContain('Database max pool size must be greater than min pool size');
      expect(result.errors).toContain('Elasticsearch URL must start with http:// or https://');
      expect(result.errors).toContain('Elasticsearch max retries must be non-negative');
      expect(result.errors).toContain('Redis port must be between 1 and 65535');
      expect(result.errors).toContain('Redis database number must be between 0 and 15');
    });
  });

  describe('HealthMonitor', () => {
    let mockConnections: {
      database: PostgreSQLPoolManager;
      elasticsearch: ElasticsearchConnectionManager;
      redis: RedisConnectionManager;
    };

    beforeEach(() => {
      mockConnections = {
        database: {
          getHealth: jest.fn().mockResolvedValue({
            healthy: true,
            latency: 10,
            stats: { totalConnections: 5 },
          }),
        } as any,
        elasticsearch: {
          getHealth: jest.fn().mockResolvedValue({
            healthy: true,
            latency: 15,
            stats: { requestsExecuted: 100 },
          }),
        } as any,
        redis: {
          getHealth: jest.fn().mockResolvedValue({
            healthy: true,
            latency: 5,
            stats: { commandsExecuted: 200 },
          }),
        } as any,
      };

      healthMonitor.registerConnections(mockConnections);
    });

    it('should register connections for monitoring', () => {
      const monitor = new HealthMonitor();
      monitor.registerConnections(mockConnections);
      
      // Should not throw and should accept the connections
      expect(() => monitor.registerConnections(mockConnections)).not.toThrow();
    });

    it('should start and stop monitoring', (done) => {
      let startEventFired = false;
      let stopEventFired = false;

      healthMonitor.on('started', () => {
        startEventFired = true;
      });

      healthMonitor.on('stopped', () => {
        stopEventFired = true;
        expect(startEventFired).toBe(true);
        expect(stopEventFired).toBe(true);
        done();
      });

      healthMonitor.start();
      expect(healthMonitor.getStatus().isMonitoring).toBe(true);
      
      setTimeout(() => {
        healthMonitor.stop();
        expect(healthMonitor.getStatus().isMonitoring).toBe(false);
      }, 100);
    });

    it('should perform health checks and emit events', (done) => {
      healthMonitor.on('healthCheck', (report) => {
        expect(report.overall.healthy).toBe(true);
        expect(report.services).toHaveLength(3);
        expect(report.services.every(s => s.healthy)).toBe(true);
        
        healthMonitor.stop();
        done();
      });

      healthMonitor.start();
    });

    it('should detect service failures and emit alerts', async () => {
      // Mock failing service
      mockConnections.database.getHealth = jest.fn().mockResolvedValue({
        healthy: false,
        error: 'Connection timeout',
      });

      let failureCount = 0;
      
      // Use shorter intervals for testing
      const testMonitor = new HealthMonitor({
        checkInterval: 100,
        alertThreshold: 3,
      });

      const p1 = new Promise<void>((resolve) => {
        testMonitor.on('serviceFailure', (event) => {
          failureCount++;
          expect(event.service).toBe('database');
          expect(event.status.healthy).toBe(false);
          expect(event.status.error).toBe('Connection timeout');
          if (failureCount >= 3) {
             resolve();
          }
        });
      });

      const p2 = new Promise<void>((resolve) => {
        testMonitor.on('serviceAlert', (event) => {
          expect(event.service).toBe('database');
          expect(event.consecutiveFailures).toBeGreaterThanOrEqual(3);
          
          testMonitor.stop();
          resolve();
        });
      });

      
      testMonitor.registerConnections(mockConnections);
      testMonitor.start();
      await Promise.all([p1, p2]);
      testMonitor.stop();
    });

    it('should get current health status', async () => {
      const health = await healthMonitor.getCurrentHealth();
      
      expect(health.overall.healthy).toBe(true);
      expect(health.services).toHaveLength(3);
      expect(health.services.find(s => s.service === 'database')?.healthy).toBe(true);
      expect(health.services.find(s => s.service === 'elasticsearch')?.healthy).toBe(true);
      expect(health.services.find(s => s.service === 'redis')?.healthy).toBe(true);
    });

    it('should calculate performance metrics', () => {
      // Add some mock history
      const mockHistory = [
        { service: 'database', healthy: true, latency: 10, timestamp: new Date() },
        { service: 'database', healthy: true, latency: 15, timestamp: new Date() },
        { service: 'database', healthy: false, latency: undefined, timestamp: new Date() },
        { service: 'database', healthy: true, latency: 20, timestamp: new Date() },
      ];

      // Manually set history for testing
      (healthMonitor as any).healthHistory.set('database', mockHistory);

      const metrics = healthMonitor.getPerformanceMetrics('database');
      
      expect(metrics).not.toBeNull();
      expect(metrics!.averageLatency).toBe(15); // (10 + 15 + 20) / 3
      expect(metrics!.minLatency).toBe(10);
      expect(metrics!.maxLatency).toBe(20);
      expect(metrics!.successRate).toBe(75); // 3 out of 4 successful
      expect(metrics!.totalChecks).toBe(4);
    });

    it('should return null metrics for unknown service', () => {
      const metrics = healthMonitor.getPerformanceMetrics('unknown');
      expect(metrics).toBeNull();
    });

    it('should get monitoring status', () => {
      const status = healthMonitor.getStatus();
      
      expect(status.isMonitoring).toBe(false);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.checkInterval).toBe(30000); // Default interval
      expect(status.lastCheck).toBeUndefined();
    });
  });

  describe('Integration Tests', () => {
    it('should integrate connection manager with health monitor', async () => {
      const monitor = new HealthMonitor({ checkInterval: 100 });
      
      // Mock successful initialization
      jest.spyOn(connectionManager as any, 'initializeDatabase')
        .mockResolvedValue(undefined);
      jest.spyOn(connectionManager as any, 'initializeElasticsearch')
        .mockResolvedValue(undefined);
      jest.spyOn(connectionManager as any, 'initializeRedis')
        .mockResolvedValue(undefined);

      await connectionManager.initialize();
      
      // Register connections with monitor
      const mockConnections = {
        database: { getHealth: jest.fn().mockResolvedValue({ healthy: true }) } as any,
        elasticsearch: { getHealth: jest.fn().mockResolvedValue({ healthy: true }) } as any,
        redis: { getHealth: jest.fn().mockResolvedValue({ healthy: true }) } as any,
      };
      
      monitor.registerConnections(mockConnections);
      
      const health = await monitor.getCurrentHealth();
      expect(health.overall.healthy).toBe(true);
      
      monitor.stop();
    });

    it('should handle graceful shutdown with health monitoring', async () => {
      const monitor = new HealthMonitor();
      
      // Start monitoring
      monitor.start();
      expect(monitor.getStatus().isMonitoring).toBe(true);
      
      // Stop monitoring
      monitor.stop();
      expect(monitor.getStatus().isMonitoring).toBe(false);
      
      // Should not throw when stopping already stopped monitor
      expect(() => monitor.stop()).not.toThrow();
    });
  });
});