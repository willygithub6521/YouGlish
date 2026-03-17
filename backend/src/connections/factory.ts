/**
 * Connection Factory
 * 
 * Factory for creating and configuring database connections with:
 * - Environment-based configuration
 * - Connection validation and testing
 * - Retry logic and error handling
 * - Connection lifecycle management
 */

import { Pool, PoolConfig } from 'pg';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { createClient, RedisClientType } from 'redis';
import { createLogger } from '../utils/logger.js';
import { PostgreSQLPoolManager, ElasticsearchConnectionManager, RedisConnectionManager } from './poolManager.js';

const logger = createLogger();

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  acquireTimeoutMillis?: number;
  statement_timeout?: number;
  query_timeout?: number;
}

export interface ElasticsearchConnectionConfig {
  url: string;
  indexPrefix: string;
  maxRetries: number;
  requestTimeout: number;
  pingTimeout?: number;
  sniffOnStart?: boolean;
  sniffOnConnectionFault?: boolean;
  auth?: {
    username: string;
    password: string;
  };
}

export interface RedisConnectionConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  connectTimeout?: number;
  commandTimeout?: number;
  lazyConnect?: boolean;
}

/**
 * Connection Factory Class
 * Creates and manages database connections with proper configuration
 */
export class ConnectionFactory {
  private static instance: ConnectionFactory;

  private constructor() {}

  public static getInstance(): ConnectionFactory {
    if (!ConnectionFactory.instance) {
      ConnectionFactory.instance = new ConnectionFactory();
    }
    return ConnectionFactory.instance;
  }

  /**
   * Create PostgreSQL connection with pool management
   */
  public async createPostgreSQLConnection(
    config?: Partial<DatabaseConnectionConfig>
  ): Promise<PostgreSQLPoolManager> {
    const dbConfig: DatabaseConnectionConfig = {
      host: config?.host || process.env.DB_HOST || 'localhost',
      port: config?.port || parseInt(process.env.DB_PORT || '5432'),
      database: config?.database || process.env.DB_NAME || 'youtube_pronunciation',
      user: config?.user || process.env.DB_USER || 'postgres',
      password: config?.password || process.env.DB_PASSWORD || 'postgres',
      ssl: config?.ssl ?? (process.env.NODE_ENV === 'production'),
      max: config?.max || parseInt(process.env.DB_POOL_MAX || '20'),
      min: config?.min || parseInt(process.env.DB_POOL_MIN || '2'),
      idleTimeoutMillis: config?.idleTimeoutMillis || parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: config?.connectionTimeoutMillis || parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
      acquireTimeoutMillis: config?.acquireTimeoutMillis || parseInt(process.env.DB_ACQUIRE_TIMEOUT || '5000'),
      statement_timeout: config?.statement_timeout || parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
      query_timeout: config?.query_timeout || parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
    };

    logger.info('Creating PostgreSQL connection', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      ssl: dbConfig.ssl,
      poolMax: dbConfig.max,
      poolMin: dbConfig.min,
    });

    const poolConfig: PoolConfig = {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
      max: dbConfig.max,
      min: dbConfig.min,
      idleTimeoutMillis: dbConfig.idleTimeoutMillis,
      connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
      statement_timeout: dbConfig.statement_timeout,
      query_timeout: dbConfig.query_timeout,
    };

    const pool = new Pool(poolConfig);

    // Test connection
    try {
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('PostgreSQL connection test successful');
    } catch (error) {
      logger.error('PostgreSQL connection test failed:', error);
      await pool.end();
      throw error;
    }

    return new PostgreSQLPoolManager(pool, {
      min: dbConfig.min,
      max: dbConfig.max,
      idleTimeoutMillis: dbConfig.idleTimeoutMillis,
      connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
      acquireTimeoutMillis: dbConfig.acquireTimeoutMillis,
    });
  }

  /**
   * Create Elasticsearch connection with retry logic
   */
  public async createElasticsearchConnection(
    config?: Partial<ElasticsearchConnectionConfig>
  ): Promise<ElasticsearchConnectionManager> {
    const esConfig: ElasticsearchConnectionConfig = {
      url: config?.url || process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      indexPrefix: config?.indexPrefix || process.env.ELASTICSEARCH_INDEX_PREFIX || 'youtube_pronunciation',
      maxRetries: config?.maxRetries || parseInt(process.env.ELASTICSEARCH_MAX_RETRIES || '3'),
      requestTimeout: config?.requestTimeout || parseInt(process.env.ELASTICSEARCH_REQUEST_TIMEOUT || '30000'),
      pingTimeout: config?.pingTimeout || parseInt(process.env.ELASTICSEARCH_PING_TIMEOUT || '3000'),
      sniffOnStart: config?.sniffOnStart ?? (process.env.ELASTICSEARCH_SNIFF_ON_START === 'true'),
      sniffOnConnectionFault: config?.sniffOnConnectionFault ?? (process.env.ELASTICSEARCH_SNIFF_ON_FAULT === 'true'),
      auth: config?.auth || (process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD ? {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD,
      } : undefined),
    };

    logger.info('Creating Elasticsearch connection', {
      url: esConfig.url,
      indexPrefix: esConfig.indexPrefix,
      maxRetries: esConfig.maxRetries,
      requestTimeout: esConfig.requestTimeout,
      auth: !!esConfig.auth,
    });

    const clientConfig: any = {
      node: esConfig.url,
      maxRetries: esConfig.maxRetries,
      requestTimeout: esConfig.requestTimeout,
      pingTimeout: esConfig.pingTimeout,
      sniffOnStart: esConfig.sniffOnStart,
      sniffOnConnectionFault: esConfig.sniffOnConnectionFault,
    };

    if (esConfig.auth) {
      clientConfig.auth = esConfig.auth;
    }

    const client = new ElasticsearchClient(clientConfig);

    // Test connection with retry logic
    let retries = 0;
    const maxRetries = esConfig.maxRetries;
    
    while (retries < maxRetries) {
      try {
        const response = await client.ping();
        if (response.statusCode === 200) {
          logger.info('Elasticsearch connection test successful');
          break;
        }
        throw new Error(`Ping failed with status ${response.statusCode}`);
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          logger.error('Elasticsearch connection test failed after retries:', error);
          await client.close();
          throw error;
        }
        
        const delay = Math.min(1000 * Math.pow(2, retries), 10000); // Exponential backoff
        logger.warn(`Elasticsearch connection attempt ${retries} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return new ElasticsearchConnectionManager(client);
  }

  /**
   * Create Redis connection with reconnection logic
   */
  public async createRedisConnection(
    config?: Partial<RedisConnectionConfig>
  ): Promise<RedisConnectionManager> {
    const redisConfig: RedisConnectionConfig = {
      url: config?.url || process.env.REDIS_URL,
      host: config?.host || process.env.REDIS_HOST || 'localhost',
      port: config?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config?.password || process.env.REDIS_PASSWORD,
      db: config?.db || parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: config?.maxRetriesPerRequest || parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelayOnFailover: config?.retryDelayOnFailover || parseInt(process.env.REDIS_RETRY_DELAY || '100'),
      connectTimeout: config?.connectTimeout || parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
      commandTimeout: config?.commandTimeout || parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
      lazyConnect: config?.lazyConnect ?? true,
    };

    logger.info('Creating Redis connection', {
      url: redisConfig.url ? '[URL provided]' : undefined,
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
      hasPassword: !!redisConfig.password,
    });

    let client: RedisClientType;

    if (redisConfig.url) {
      client = createClient({
        url: redisConfig.url,
        socket: {
          connectTimeout: redisConfig.connectTimeout,
          commandTimeout: redisConfig.commandTimeout,
        },
      });
    } else {
      client = createClient({
        socket: {
          host: redisConfig.host,
          port: redisConfig.port,
          connectTimeout: redisConfig.connectTimeout,
          commandTimeout: redisConfig.commandTimeout,
        },
        password: redisConfig.password,
        database: redisConfig.db,
      });
    }

    // Test connection
    try {
      await client.connect();
      await client.ping();
      logger.info('Redis connection test successful');
    } catch (error) {
      logger.error('Redis connection test failed:', error);
      await client.quit();
      throw error;
    }

    return new RedisConnectionManager(client);
  }

  /**
   * Create all connections with validation
   */
  public async createAllConnections(config?: {
    database?: Partial<DatabaseConnectionConfig>;
    elasticsearch?: Partial<ElasticsearchConnectionConfig>;
    redis?: Partial<RedisConnectionConfig>;
  }): Promise<{
    database: PostgreSQLPoolManager;
    elasticsearch: ElasticsearchConnectionManager;
    redis: RedisConnectionManager;
  }> {
    logger.info('Creating all database connections...');

    const connections = await Promise.all([
      this.createPostgreSQLConnection(config?.database),
      this.createElasticsearchConnection(config?.elasticsearch),
      this.createRedisConnection(config?.redis),
    ]);

    logger.info('All database connections created successfully');

    return {
      database: connections[0],
      elasticsearch: connections[1],
      redis: connections[2],
    };
  }

  /**
   * Validate connection configuration
   */
  public validateConfiguration(config: {
    database?: Partial<DatabaseConnectionConfig>;
    elasticsearch?: Partial<ElasticsearchConnectionConfig>;
    redis?: Partial<RedisConnectionConfig>;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate database config
    if (config.database) {
      const db = config.database;
      if (db.port && (db.port < 1 || db.port > 65535)) {
        errors.push('Database port must be between 1 and 65535');
      }
      if (db.max && db.min && db.max < db.min) {
        errors.push('Database max pool size must be greater than min pool size');
      }
    }

    // Validate Elasticsearch config
    if (config.elasticsearch) {
      const es = config.elasticsearch;
      if (es.url && !es.url.startsWith('http')) {
        errors.push('Elasticsearch URL must start with http:// or https://');
      }
      if (es.maxRetries && es.maxRetries < 0) {
        errors.push('Elasticsearch max retries must be non-negative');
      }
    }

    // Validate Redis config
    if (config.redis) {
      const redis = config.redis;
      if (redis.port && (redis.port < 1 || redis.port > 65535)) {
        errors.push('Redis port must be between 1 and 65535');
      }
      if (redis.db && (redis.db < 0 || redis.db > 15)) {
        errors.push('Redis database number must be between 0 and 15');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const connectionFactory = ConnectionFactory.getInstance();