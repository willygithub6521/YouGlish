import { Client } from '@elastic/elasticsearch';

/**
 * Elasticsearch configuration and client setup
 */

export interface ElasticsearchConfig {
  url: string;
  indexPrefix: string;
  maxRetries: number;
  requestTimeout: number;
}

/**
 * Get Elasticsearch configuration from environment variables
 */
export function getElasticsearchConfig(): ElasticsearchConfig {
  return {
    url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    indexPrefix: process.env.ELASTICSEARCH_INDEX_PREFIX || 'youtube_pronunciation',
    maxRetries: parseInt(process.env.ELASTICSEARCH_MAX_RETRIES || '3'),
    requestTimeout: parseInt(process.env.ELASTICSEARCH_REQUEST_TIMEOUT || '30000'),
  };
}

/**
 * Create and configure Elasticsearch client
 */
export function createElasticsearchClient(config?: ElasticsearchConfig): Client {
  const esConfig = config || getElasticsearchConfig();
  
  return new Client({
    node: esConfig.url,
    maxRetries: esConfig.maxRetries,
    requestTimeout: esConfig.requestTimeout,
    sniffOnStart: false,
    sniffOnConnectionFault: false,
  });
}

/**
 * Singleton Elasticsearch client instance
 */
class ElasticsearchConnection {
  private static instance: ElasticsearchConnection;
  private client: Client;
  private config: ElasticsearchConfig;

  private constructor() {
    this.config = getElasticsearchConfig();
    this.client = createElasticsearchClient(this.config);
  }

  public static getInstance(): ElasticsearchConnection {
    if (!ElasticsearchConnection.instance) {
      ElasticsearchConnection.instance = new ElasticsearchConnection();
    }
    return ElasticsearchConnection.instance;
  }

  public getClient(): Client {
    return this.client;
  }

  public getConfig(): ElasticsearchConfig {
    return this.config;
  }

  /**
   * Test Elasticsearch connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.ping();
      return response.statusCode === 200;
    } catch (error) {
      console.error('Elasticsearch connection test failed:', error);
      return false;
    }
  }

  /**
   * Get cluster health information
   */
  public async getClusterHealth(): Promise<any> {
    try {
      const response = await this.client.cluster.health();
      return response.body;
    } catch (error) {
      console.error('Failed to get cluster health:', error);
      throw error;
    }
  }

  /**
   * Close Elasticsearch connection
   */
  public async close(): Promise<void> {
    try {
      await this.client.close();
    } catch (error) {
      console.error('Error closing Elasticsearch connection:', error);
    }
  }
}

export default ElasticsearchConnection;