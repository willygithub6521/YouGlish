/**
 * Elasticsearch module exports
 * Provides centralized access to all Elasticsearch functionality
 */

import ElasticsearchConnection, { createElasticsearchClient, getElasticsearchConfig, type ElasticsearchConfig } from './config.js';
import { ElasticsearchIndexManager } from './indexManager.js';
import { ElasticsearchSearchService, type SearchParams, type SearchResult, type SearchResponse } from './searchService.js';
import { 
  subtitlesIndexMapping, 
  subtitlesIndexTemplate, 
  searchQueryTemplates,
  aggregationQueries,
  indexLifecyclePolicy,
  type SubtitleDocument
} from './mappings.js';

export {
  ElasticsearchConnection,
  createElasticsearchClient,
  getElasticsearchConfig,
  type ElasticsearchConfig,
  ElasticsearchIndexManager,
  ElasticsearchSearchService,
  type SearchParams,
  type SearchResult,
  type SearchResponse,
  subtitlesIndexMapping,
  subtitlesIndexTemplate,
  searchQueryTemplates,
  aggregationQueries,
  indexLifecyclePolicy,
  type SubtitleDocument
};

/**
 * Initialize Elasticsearch for the application
 * This function should be called during application startup
 */
export async function initializeElasticsearch(): Promise<boolean> {
  try {
    console.log('Starting Elasticsearch initialization...');
    
    const indexManager = new ElasticsearchIndexManager();
    const success = await indexManager.initializeElasticsearch();
    
    if (success) {
      console.log('Elasticsearch initialization completed successfully');
    } else {
      console.error('Elasticsearch initialization failed');
    }
    
    return success;
  } catch (error) {
    console.error('Error during Elasticsearch initialization:', error);
    return false;
  }
}

/**
 * Perform Elasticsearch health check
 */
export async function checkElasticsearchHealth(): Promise<any> {
  try {
    const indexManager = new ElasticsearchIndexManager();
    return await indexManager.healthCheck();
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Elasticsearch health check failed:', err);
    return {
      connected: false,
      indexExists: false,
      templateExists: false,
      error: error.message
    };
  }
}

/**
 * Get a configured search service instance
 */
export function getSearchService(): ElasticsearchSearchService {
  return new ElasticsearchSearchService();
}

/**
 * Get a configured index manager instance
 */
export function getIndexManager(): ElasticsearchIndexManager {
  return new ElasticsearchIndexManager();
}

/**
 * Gracefully shutdown Elasticsearch connections
 */
export async function shutdownElasticsearch(): Promise<void> {
  try {
    const connection = ElasticsearchConnection.getInstance();
    await connection.close();
    console.log('Elasticsearch connections closed');
  } catch (error) {
    console.error('Error closing Elasticsearch connections:', error);
  }
}