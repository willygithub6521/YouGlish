/**
 * Connection Pool Manager
 * 
 * Manages connection pools for all database services with:
 * - Dynamic pool sizing based on load
 * - Connection lifecycle management
 * - Pool statistics and monitoring
 * - Automatic pool cleanup and recovery
 */

import { Pool, PoolClient } from 'pg';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingClients: number;
}

export interface PoolConfig {
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  acquireTimeoutMillis?: number;
}

/**
 * PostgreSQL Pool Manager
 * Manages PostgreSQL connection pool with advanced features
 */
export class PostgreSQLPoolManager {
  private pool: Pool;
  private config: PoolConfig;
  private stats = {
    totalConnections: 0,
    connectionsCreated: 0,
    connectionsDestroyed: 0,
    queriesExecuted: 0,
    errors: 0,
  };

  constructor(pool: Pool, config: PoolConfig = {}) {
    this.pool = pool;
    this.config = {
      min: config.min || 2,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
      acquireTimeoutMillis: config.acquireTimeoutMillis || 5000,
      ...config,
    };

    this.setupEventListeners();
  }

  /**
   * Set up pool event listeners for monitoring
   */
  private setupEventListeners(): void {
    this.pool.on('connect', (client: PoolClient) => {
      this.stats.connectionsCreated++;
      this.stats.totalConnections++;
      logger.debug('New PostgreSQL client connected', {
        totalConnections: this.stats.totalConnections,
      });
    });

    this.pool.on('remove', (client: PoolClient) => {
      this.stats.connectionsDestroyed++;
      this.stats.totalConnections--;
      logger.debug('PostgreSQL client removed', {
        totalConnections: this.stats.totalConnections,
      });
    });

    this.pool.on('error', (err: Error, client: PoolClient) => {
      this.stats.errors++;
      logger.error('PostgreSQL pool error:', err);
    });

    this.pool.on('acquire', (client: PoolClient) => {
      logger.debug('PostgreSQL client acquired from pool');
    });

    this.pool.on('release', (client: PoolClient) => {
      logger.debug('PostgreSQL client released to pool');
    });
  }

  /**
   * Execute query with connection management
   */
  public async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();
      const result = await client.query(text, params);
      
      this.stats.queriesExecuted++;
      const duration = Date.now() - start;
      
      logger.debug('PostgreSQL query executed', {
        duration,
        rows: result.rowCount,
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      });

      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('PostgreSQL query error:', {
        error: error instanceof Error ? error.message : error,
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: Date.now() - start,
      });
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Execute transaction with automatic rollback on error
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      
      logger.debug('PostgreSQL transaction committed successfully');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('PostgreSQL transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pool statistics
   */
  public getStats(): PoolStats & typeof this.stats {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      activeConnections: this.pool.totalCount - this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
      ...this.stats,
    };
  }

  /**
   * Get pool health information
   */
  public async getHealth(): Promise<{
    healthy: boolean;
    stats: PoolStats & typeof this.stats;
    latency?: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      await this.query('SELECT 1');
      const latency = Date.now() - start;
      
      return {
        healthy: true,
        stats: this.getStats(),
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        stats: this.getStats(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Drain pool connections gracefully
   */
  public async drain(): Promise<void> {
    logger.info('Draining PostgreSQL connection pool...');
    await this.pool.end();
    logger.info('PostgreSQL connection pool drained');
  }
}

/**
 * Elasticsearch Connection Manager
 * Manages Elasticsearch client with connection monitoring
 */
export class ElasticsearchConnectionManager {
  private client: ElasticsearchClient;
  private stats = {
    requestsExecuted: 0,
    errors: 0,
    totalLatency: 0,
  };

  constructor(client: ElasticsearchClient) {
    this.client = client;
  }

  /**
   * Execute Elasticsearch request with monitoring
   */
  public async request<T = any>(
    method: string,
    params: any = {}
  ): Promise<T> {
    const start = Date.now();
    
    try {
      const result = await (this.client as any)[method](params);
      
      this.stats.requestsExecuted++;
      const latency = Date.now() - start;
      this.stats.totalLatency += latency;
      
      logger.debug('Elasticsearch request executed', {
        method,
        latency,
        statusCode: result.statusCode,
      });

      return result;
    } catch (error) {
      this.stats.errors++;
      const latency = Date.now() - start;
      
      logger.error('Elasticsearch request error:', {
        method,
        error: error instanceof Error ? error.message : error,
        latency,
      });
      
      throw error;
    }
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      ...this.stats,
      averageLatency: this.stats.requestsExecuted > 0 
        ? this.stats.totalLatency / this.stats.requestsExecuted 
        : 0,
    };
  }

  /**
   * Get connection health
   */
  public async getHealth(): Promise<{
    healthy: boolean;
    stats: ReturnType<typeof this.getStats>;
    clusterHealth?: any;
    latency?: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      const pingResult = await this.client.ping();
      const latency = Date.now() - start;
      
      if (pingResult.statusCode !== 200) {
        throw new Error(`Ping failed with status ${pingResult.statusCode}`);
      }

      // Get cluster health
      const clusterHealth = await this.client.cluster.health();
      
      return {
        healthy: true,
        stats: this.getStats(),
        clusterHealth: clusterHealth.body,
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        stats: this.getStats(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close Elasticsearch connection
   */
  public async close(): Promise<void> {
    logger.info('Closing Elasticsearch connection...');
    await this.client.close();
    logger.info('Elasticsearch connection closed');
  }
}

/**
 * Redis Connection Manager
 * Manages Redis connection with monitoring and reconnection logic
 */
export class RedisConnectionManager {
  private client: any; // Redis client type
  private stats = {
    commandsExecuted: 0,
    errors: 0,
    reconnections: 0,
    totalLatency: 0,
  };
  private isConnected = false;

  constructor(client: any) {
    this.client = client;
    this.setupEventListeners();
  }

  /**
   * Set up Redis event listeners
   */
  private setupEventListeners(): void {
    if (this.client.on) {
      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis connected');
      });

      this.client.on('disconnect', () => {
        this.isConnected = false;
        logger.warn('Redis disconnected');
      });

      this.client.on('reconnecting', () => {
        this.stats.reconnections++;
        logger.info('Redis reconnecting...');
      });

      this.client.on('error', (error: Error) => {
        this.stats.errors++;
        logger.error('Redis error:', error);
      });
    }
  }

  /**
   * Execute Redis command with monitoring
   */
  public async command(command: string, ...args: any[]): Promise<any> {
    const start = Date.now();
    
    try {
      let result;
      
      // Handle different command types for redis client
      if (command.toLowerCase() === 'ping') {
        result = await this.client.ping();
      } else if (command.toLowerCase() === 'get') {
        result = await this.client.get(args[0]);
      } else if (command.toLowerCase() === 'set') {
        if (args.length === 2) {
          result = await this.client.set(args[0], args[1]);
        } else if (args.length === 4 && args[2].toUpperCase() === 'EX') {
          result = await this.client.setEx(args[0], args[3], args[1]);
        } else {
          result = await this.client.set(args[0], args[1]);
        }
      } else if (command.toLowerCase() === 'del') {
        result = await this.client.del(args);
      } else {
        // Fallback for other commands
        result = await (this.client as any)[command](...args);
      }
      
      this.stats.commandsExecuted++;
      const latency = Date.now() - start;
      this.stats.totalLatency += latency;
      
      logger.debug('Redis command executed', {
        command,
        latency,
        args: args.length,
      });

      return result;
    } catch (error) {
      this.stats.errors++;
      const latency = Date.now() - start;
      
      logger.error('Redis command error:', {
        command,
        error: error instanceof Error ? error.message : error,
        latency,
      });
      
      throw error;
    }
  }

  /**
   * Get connection statistics
   */
  public getStats() {
    return {
      ...this.stats,
      isConnected: this.isConnected,
      averageLatency: this.stats.commandsExecuted > 0 
        ? this.stats.totalLatency / this.stats.commandsExecuted 
        : 0,
    };
  }

  /**
   * Get connection health
   */
  public async getHealth(): Promise<{
    healthy: boolean;
    stats: ReturnType<typeof this.getStats>;
    latency?: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      await this.command('ping');
      const latency = Date.now() - start;
      
      return {
        healthy: true,
        stats: this.getStats(),
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        stats: this.getStats(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close Redis connection
   */
  public async close(): Promise<void> {
    logger.info('Closing Redis connection...');
    if (this.client.quit) {
      await this.client.quit();
    } else if (this.client.disconnect) {
      await this.client.disconnect();
    }
    this.isConnected = false;
    logger.info('Redis connection closed');
  }
}