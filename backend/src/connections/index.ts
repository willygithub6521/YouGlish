/**
 * Unified Database Connection Management System
 * 
 * This module provides a centralized connection management system for:
 * - PostgreSQL (video metadata and subtitles storage)
 * - Elasticsearch (full-text search functionality)
 * - Redis (caching layer)
 * 
 * Features:
 * - Connection pooling and management
 * - Error handling and retry logic
 * - Health checking capabilities
 * - Environment-based configuration
 * - Proper cleanup and shutdown procedures
 */

import { DatabaseConnection } from '../database/connection.js';
import ElasticsearchConnection from '../elasticsearch/config.js';
import { redisClient } from '../redis/client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

export interface ConnectionHealth {
  database: {
    connected: boolean;
    latency?: number;
    error?: string;
  };
  elasticsearch: {
    connected: boolean;
    latency?: number;
    error?: string;
  };
  redis: {
    connected: boolean;
    latency?: number;
    error?: string;
  };
}

export interface ConnectionConfig {
  database?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };
  elasticsearch?: {
    url: string;
    indexPrefix: string;
    maxRetries: number;
    requestTimeout: number;
  };
  redis?: {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
}

/**
 * Unified Connection Manager
 * Manages all database connections with health monitoring and graceful shutdown
 */
export class ConnectionManager {
  private static instance: ConnectionManager;
  private dbConnection: DatabaseConnection | null = null;
  private esConnection: ElasticsearchConnection | null = null;
  private redisConnection = redisClient;
  private isInitialized = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /**
   * Initialize all database connections
   */
  public async initialize(config?: ConnectionConfig): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Connection manager already initialized');
      return;
    }

    logger.info('Initializing database connections...');

    try {
      // Initialize PostgreSQL connection
      await this.initializeDatabase(config?.database);
      
      // Initialize Elasticsearch connection
      await this.initializeElasticsearch();
      
      // Initialize Redis connection
      await this.initializeRedis();

      this.isInitialized = true;
      logger.info('All database connections initialized successfully');

      // Start health monitoring
      this.startHealthMonitoring();

    } catch (error) {
      logger.error('Failed to initialize database connections:', error);
      throw error;
    }
  }

  /**
   * Initialize PostgreSQL connection
   */
  private async initializeDatabase(config?: ConnectionConfig['database']): Promise<void> {
    try {
      const dbConfig = config || {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'youtube_pronunciation',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        ssl: process.env.NODE_ENV === 'production',
        max: parseInt(process.env.DB_POOL_MAX || '20'),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
      };

      this.dbConnection = DatabaseConnection.getInstance(dbConfig);
      
      // Test connection
      const isConnected = await this.dbConnection.testConnection();
      if (!isConnected) {
        throw new Error('PostgreSQL connection test failed');
      }

      logger.info('PostgreSQL connection initialized');
    } catch (error) {
      logger.error('Failed to initialize PostgreSQL connection:', error);
      throw error;
    }
  }

  /**
   * Initialize Elasticsearch connection
   */
  private async initializeElasticsearch(): Promise<void> {
    try {
      this.esConnection = ElasticsearchConnection.getInstance();
      
      // Test connection
      const isConnected = await this.esConnection.testConnection();
      if (!isConnected) {
        throw new Error('Elasticsearch connection test failed');
      }

      logger.info('Elasticsearch connection initialized');
    } catch (error) {
      logger.error('Failed to initialize Elasticsearch connection:', error);
      throw error;
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      await this.redisConnection.initialize();
      
      // Test connection
      const health = await this.redisConnection.healthCheck();
      if (!health.connected) {
        throw new Error(`Redis connection test failed: ${health.error}`);
      }

      logger.info('Redis connection initialized');
    } catch (error) {
      logger.error('Failed to initialize Redis connection:', error);
      throw error;
    }
  }

  /**
   * Get PostgreSQL connection
   */
  public getDatabaseConnection(): DatabaseConnection {
    if (!this.dbConnection) {
      throw new Error('Database connection not initialized');
    }
    return this.dbConnection;
  }

  /**
   * Get Elasticsearch connection
   */
  public getElasticsearchConnection(): ElasticsearchConnection {
    if (!this.esConnection) {
      throw new Error('Elasticsearch connection not initialized');
    }
    return this.esConnection;
  }

  /**
   * Get Redis connection
   */
  public getRedisConnection() {
    return this.redisConnection;
  }

  /**
   * Check health of all connections
   */
  public async checkHealth(): Promise<ConnectionHealth> {
    const health: ConnectionHealth = {
      database: { connected: false },
      elasticsearch: { connected: false },
      redis: { connected: false },
    };

    // Check PostgreSQL health
    try {
      if (this.dbConnection) {
        const start = Date.now();
        const isConnected = await this.dbConnection.testConnection();
        const latency = Date.now() - start;
        
        health.database = {
          connected: isConnected,
          latency: isConnected ? latency : undefined,
          error: isConnected ? undefined : 'Connection test failed',
        };
      } else {
        health.database.error = 'Connection not initialized';
      }
    } catch (error) {
      health.database.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check Elasticsearch health
    try {
      if (this.esConnection) {
        const start = Date.now();
        const isConnected = await this.esConnection.testConnection();
        const latency = Date.now() - start;
        
        health.elasticsearch = {
          connected: isConnected,
          latency: isConnected ? latency : undefined,
          error: isConnected ? undefined : 'Connection test failed',
        };
      } else {
        health.elasticsearch.error = 'Connection not initialized';
      }
    } catch (error) {
      health.elasticsearch.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check Redis health
    try {
      const redisHealth = await this.redisConnection.healthCheck();
      health.redis = redisHealth;
    } catch (error) {
      health.redis.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return health;
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'); // 1 minute default
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        const unhealthyServices = [];

        if (!health.database.connected) unhealthyServices.push('PostgreSQL');
        if (!health.elasticsearch.connected) unhealthyServices.push('Elasticsearch');
        if (!health.redis.connected) unhealthyServices.push('Redis');

        if (unhealthyServices.length > 0) {
          logger.warn(`Unhealthy database connections detected: ${unhealthyServices.join(', ')}`);
        } else {
          logger.debug('All database connections healthy');
        }
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, interval);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Gracefully shutdown all connections
   */
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Shutting down database connections...');

    // Stop health monitoring
    this.stopHealthMonitoring();

    const shutdownPromises: Promise<void>[] = [];

    // Close PostgreSQL connection
    if (this.dbConnection) {
      shutdownPromises.push(
        this.dbConnection.close().catch((error) => {
          logger.error('Error closing PostgreSQL connection:', error);
        })
      );
    }

    // Close Elasticsearch connection
    if (this.esConnection) {
      shutdownPromises.push(
        this.esConnection.close().catch((error) => {
          logger.error('Error closing Elasticsearch connection:', error);
        })
      );
    }

    // Close Redis connection
    shutdownPromises.push(
      this.redisConnection.close().catch((error) => {
        logger.error('Error closing Redis connection:', error);
      })
    );

    // Wait for all connections to close
    await Promise.all(shutdownPromises);

    this.isInitialized = false;
    this.dbConnection = null;
    this.esConnection = null;

    logger.info('All database connections closed');
  }

  /**
   * Check if connection manager is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const connectionManager = ConnectionManager.getInstance();

// Convenience functions for getting connections
export function getDatabaseConnection(): DatabaseConnection {
  return connectionManager.getDatabaseConnection();
}

export function getElasticsearchConnection(): ElasticsearchConnection {
  return connectionManager.getElasticsearchConnection();
}

export function getRedisConnection() {
  return connectionManager.getRedisConnection();
}

// Initialize connections (call this in your app startup)
export async function initializeConnections(config?: ConnectionConfig): Promise<void> {
  await connectionManager.initialize(config);
}

// Shutdown connections (call this in your app shutdown)
export async function shutdownConnections(): Promise<void> {
  await connectionManager.shutdown();
}

// Health check endpoint helper
export async function getConnectionsHealth(): Promise<ConnectionHealth> {
  return connectionManager.checkHealth();
}