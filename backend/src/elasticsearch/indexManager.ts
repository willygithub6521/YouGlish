import { Client } from '@elastic/elasticsearch';
import ElasticsearchConnection from './config';
import { 
  subtitlesIndexMapping, 
  subtitlesIndexTemplate, 
  indexLifecyclePolicy,
  SubtitleDocument 
} from './mappings';

/**
 * Elasticsearch Index Manager
 * Handles index creation, management, and operations
 */
export class ElasticsearchIndexManager {
  private client: Client;
  private config: any;

  constructor() {
    const esConnection = ElasticsearchConnection.getInstance();
    this.client = esConnection.getClient();
    this.config = esConnection.getConfig();
  }

  /**
   * Get the full index name with prefix
   */
  public getIndexName(suffix: string = 'subtitles'): string {
    return `${this.config.indexPrefix}_${suffix}`;
  }

  /**
   * Check if an index exists
   */
  public async indexExists(indexName: string): Promise<boolean> {
    try {
      const response = await this.client.indices.exists({
        index: indexName
      });
      return response.statusCode === 200;
    } catch (error) {
      console.error(`Error checking if index ${indexName} exists:`, error);
      return false;
    }
  }

  /**
   * Create the subtitles index with proper mappings and settings
   */
  public async createSubtitlesIndex(indexName?: string): Promise<boolean> {
    const fullIndexName = indexName || this.getIndexName('subtitles');
    
    try {
      // Check if index already exists
      if (await this.indexExists(fullIndexName)) {
        console.log(`Index ${fullIndexName} already exists`);
        return true;
      }

      console.log(`Creating index: ${fullIndexName}`);
      
      const response = await this.client.indices.create({
        index: fullIndexName,
        body: subtitlesIndexMapping
      });

      if (response.statusCode === 200) {
        console.log(`Successfully created index: ${fullIndexName}`);
        return true;
      } else {
        console.error(`Failed to create index ${fullIndexName}:`, response);
        return false;
      }
    } catch (error) {
      console.error(`Error creating index ${fullIndexName}:`, error);
      return false;
    }
  }

  /**
   * Delete an index
   */
  public async deleteIndex(indexName: string): Promise<boolean> {
    try {
      if (!(await this.indexExists(indexName))) {
        console.log(`Index ${indexName} does not exist`);
        return true;
      }

      const response = await this.client.indices.delete({
        index: indexName
      });

      if (response.statusCode === 200) {
        console.log(`Successfully deleted index: ${indexName}`);
        return true;
      } else {
        console.error(`Failed to delete index ${indexName}:`, response);
        return false;
      }
    } catch (error) {
      console.error(`Error deleting index ${indexName}:`, error);
      return false;
    }
  }

  /**
   * Create index template for consistent mapping across multiple indices
   */
  public async createIndexTemplate(): Promise<boolean> {
    const templateName = `${this.config.indexPrefix}_subtitles_template`;
    
    try {
      console.log(`Creating index template: ${templateName}`);
      
      const response = await this.client.indices.putIndexTemplate({
        name: templateName,
        body: subtitlesIndexTemplate
      });

      if (response.statusCode === 200) {
        console.log(`Successfully created index template: ${templateName}`);
        return true;
      } else {
        console.error(`Failed to create index template ${templateName}:`, response);
        return false;
      }
    } catch (error) {
      console.error(`Error creating index template ${templateName}:`, error);
      return false;
    }
  }

  /**
   * Set up index lifecycle management policy
   */
  public async createLifecyclePolicy(): Promise<boolean> {
    const policyName = `${this.config.indexPrefix}_lifecycle_policy`;
    
    try {
      console.log(`Creating lifecycle policy: ${policyName}`);
      
      const response = await this.client.ilm.putLifecycle({
        policy: policyName,
        body: indexLifecyclePolicy
      });

      if (response.statusCode === 200) {
        console.log(`Successfully created lifecycle policy: ${policyName}`);
        return true;
      } else {
        console.error(`Failed to create lifecycle policy ${policyName}:`, response);
        return false;
      }
    } catch (error) {
      console.error(`Error creating lifecycle policy ${policyName}:`, error);
      return false;
    }
  }

  /**
   * Get index information and statistics
   */
  public async getIndexInfo(indexName: string): Promise<any> {
    try {
      const [settings, mappings, stats] = await Promise.all([
        this.client.indices.getSettings({ index: indexName }),
        this.client.indices.getMapping({ index: indexName }),
        this.client.indices.stats({ index: indexName })
      ]);

      return {
        settings: settings.body[indexName]?.settings,
        mappings: mappings.body[indexName]?.mappings,
        stats: stats.body.indices[indexName]
      };
    } catch (error) {
      console.error(`Error getting index info for ${indexName}:`, error);
      throw error;
    }
  }

  /**
   * Refresh an index to make recent changes searchable
   */
  public async refreshIndex(indexName: string): Promise<boolean> {
    try {
      const response = await this.client.indices.refresh({
        index: indexName
      });

      return response.statusCode === 200;
    } catch (error) {
      console.error(`Error refreshing index ${indexName}:`, error);
      return false;
    }
  }

  /**
   * Update index settings (for performance tuning)
   */
  public async updateIndexSettings(indexName: string, settings: any): Promise<boolean> {
    try {
      const response = await this.client.indices.putSettings({
        index: indexName,
        body: {
          settings
        }
      });

      if (response.statusCode === 200) {
        console.log(`Successfully updated settings for index: ${indexName}`);
        return true;
      } else {
        console.error(`Failed to update settings for index ${indexName}:`, response);
        return false;
      }
    } catch (error) {
      console.error(`Error updating settings for index ${indexName}:`, error);
      return false;
    }
  }

  /**
   * Bulk index subtitle documents
   */
  public async bulkIndexSubtitles(
    subtitles: SubtitleDocument[], 
    indexName?: string
  ): Promise<boolean> {
    const fullIndexName = indexName || this.getIndexName('subtitles');
    
    if (subtitles.length === 0) {
      console.log('No subtitles to index');
      return true;
    }

    try {
      const body = subtitles.flatMap(subtitle => [
        { 
          index: { 
            _index: fullIndexName,
            _id: `${subtitle.video_id}_${subtitle.subtitle_id}`
          } 
        },
        subtitle
      ]);

      const response = await this.client.bulk({
        body,
        refresh: 'wait_for'
      });

      if (response.body.errors) {
        console.error('Bulk indexing errors:', response.body.items.filter((item: any) => item.index?.error));
        return false;
      }

      console.log(`Successfully indexed ${subtitles.length} subtitles to ${fullIndexName}`);
      return true;
    } catch (error) {
      console.error('Error bulk indexing subtitles:', error);
      return false;
    }
  }

  /**
   * Initialize all Elasticsearch components
   */
  public async initializeElasticsearch(): Promise<boolean> {
    try {
      console.log('Initializing Elasticsearch components...');
      
      // Test connection first
      const esConnection = ElasticsearchConnection.getInstance();
      const isConnected = await esConnection.testConnection();
      
      if (!isConnected) {
        console.error('Cannot connect to Elasticsearch');
        return false;
      }

      // Create components in order
      const results = await Promise.all([
        this.createLifecyclePolicy(),
        this.createIndexTemplate(),
        this.createSubtitlesIndex()
      ]);

      const allSuccessful = results.every(result => result === true);
      
      if (allSuccessful) {
        console.log('Elasticsearch initialization completed successfully');
      } else {
        console.error('Some Elasticsearch components failed to initialize');
      }

      return allSuccessful;
    } catch (error) {
      console.error('Error initializing Elasticsearch:', error);
      return false;
    }
  }

  /**
   * Health check for Elasticsearch setup
   */
  public async healthCheck(): Promise<{
    connected: boolean;
    indexExists: boolean;
    templateExists: boolean;
    clusterHealth?: any;
  }> {
    try {
      const esConnection = ElasticsearchConnection.getInstance();
      const connected = await esConnection.testConnection();
      
      if (!connected) {
        return { connected: false, indexExists: false, templateExists: false };
      }

      const indexName = this.getIndexName('subtitles');
      const templateName = `${this.config.indexPrefix}_subtitles_template`;
      
      const [indexExists, templateResponse, clusterHealth] = await Promise.all([
        this.indexExists(indexName),
        this.client.indices.existsIndexTemplate({ name: templateName }).catch(() => ({ statusCode: 404 })),
        esConnection.getClusterHealth().catch(() => null)
      ]);

      return {
        connected: true,
        indexExists,
        templateExists: templateResponse.statusCode === 200,
        clusterHealth
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return { connected: false, indexExists: false, templateExists: false };
    }
  }
}