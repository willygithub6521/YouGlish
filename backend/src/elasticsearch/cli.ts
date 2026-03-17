#!/usr/bin/env node

/**
 * Elasticsearch CLI utility for index management
 * Usage: npm run es:setup, npm run es:health, etc.
 */

import { ElasticsearchIndexManager } from './indexManager';
import { checkElasticsearchHealth, initializeElasticsearch } from './index';

/**
 * CLI command handlers
 */
class ElasticsearchCLI {
  private indexManager: ElasticsearchIndexManager;

  constructor() {
    this.indexManager = new ElasticsearchIndexManager();
  }

  /**
   * Initialize Elasticsearch (create indices, templates, policies)
   */
  async setup(): Promise<void> {
    console.log('🚀 Setting up Elasticsearch...\n');
    
    try {
      const success = await initializeElasticsearch();
      
      if (success) {
        console.log('\n✅ Elasticsearch setup completed successfully!');
        await this.status();
      } else {
        console.log('\n❌ Elasticsearch setup failed!');
        process.exit(1);
      }
    } catch (error) {
      console.error('\n💥 Setup error:', error.message);
      process.exit(1);
    }
  }

  /**
   * Check Elasticsearch health and status
   */
  async health(): Promise<void> {
    console.log('🏥 Checking Elasticsearch health...\n');
    
    try {
      const health = await checkElasticsearchHealth();
      
      console.log('Connection Status:', health.connected ? '✅ Connected' : '❌ Disconnected');
      console.log('Index Exists:', health.indexExists ? '✅ Yes' : '❌ No');
      console.log('Template Exists:', health.templateExists ? '✅ Yes' : '❌ No');
      
      if (health.clusterHealth) {
        console.log('\nCluster Health:');
        console.log(`  Status: ${health.clusterHealth.status}`);
        console.log(`  Nodes: ${health.clusterHealth.number_of_nodes}`);
        console.log(`  Data Nodes: ${health.clusterHealth.number_of_data_nodes}`);
        console.log(`  Active Shards: ${health.clusterHealth.active_shards}`);
      }
      
      if (!health.connected) {
        console.log('\n⚠️  Make sure Elasticsearch is running on the configured URL');
        process.exit(1);
      }
    } catch (error) {
      console.error('\n💥 Health check error:', error.message);
      process.exit(1);
    }
  }

  /**
   * Show detailed status of Elasticsearch components
   */
  async status(): Promise<void> {
    console.log('📊 Elasticsearch Status:\n');
    
    try {
      const indexName = this.indexManager.getIndexName('subtitles');
      const indexExists = await this.indexManager.indexExists(indexName);
      
      if (indexExists) {
        const info = await this.indexManager.getIndexInfo(indexName);
        
        console.log(`Index: ${indexName}`);
        console.log(`  Documents: ${info.stats?.total?.docs?.count || 0}`);
        console.log(`  Size: ${info.stats?.total?.store?.size_in_bytes || 0} bytes`);
        console.log(`  Shards: ${info.settings?.index?.number_of_shards || 'N/A'}`);
        console.log(`  Replicas: ${info.settings?.index?.number_of_replicas || 'N/A'}`);
      } else {
        console.log(`Index: ${indexName} - ❌ Not found`);
      }
    } catch (error) {
      console.error('\n💥 Status error:', error.message);
    }
  }

  /**
   * Reset Elasticsearch (delete and recreate everything)
   */
  async reset(): Promise<void> {
    console.log('🔄 Resetting Elasticsearch...\n');
    
    try {
      const indexName = this.indexManager.getIndexName('subtitles');
      
      // Delete existing index
      console.log('Deleting existing index...');
      await this.indexManager.deleteIndex(indexName);
      
      // Recreate everything
      console.log('Recreating components...');
      const success = await initializeElasticsearch();
      
      if (success) {
        console.log('\n✅ Elasticsearch reset completed successfully!');
      } else {
        console.log('\n❌ Elasticsearch reset failed!');
        process.exit(1);
      }
    } catch (error) {
      console.error('\n💥 Reset error:', error.message);
      process.exit(1);
    }
  }

  /**
   * Test search functionality
   */
  async testSearch(): Promise<void> {
    console.log('🔍 Testing search functionality...\n');
    
    try {
      const { ElasticsearchSearchService } = await import('./searchService');
      const searchService = new ElasticsearchSearchService();
      
      // Test basic search
      console.log('Testing basic search...');
      const results = await searchService.searchSubtitles({
        query: 'test',
        limit: 5
      });
      
      console.log(`Found ${results.total} results`);
      console.log(`Search took ${results.took}ms`);
      
      if (results.results.length > 0) {
        console.log('\nSample results:');
        results.results.slice(0, 3).forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.text.substring(0, 100)}...`);
        });
      }
      
      // Test suggestions
      console.log('\nTesting suggestions...');
      const suggestions = await searchService.getSuggestions('hel', 5);
      console.log('Suggestions:', suggestions);
      
      console.log('\n✅ Search test completed!');
    } catch (error) {
      console.error('\n💥 Search test error:', error.message);
    }
  }

  /**
   * Show help information
   */
  help(): void {
    console.log(`
🔧 Elasticsearch CLI Utility

Available commands:
  setup     - Initialize Elasticsearch (create indices, templates, policies)
  health    - Check Elasticsearch connection and health
  status    - Show detailed status of Elasticsearch components
  reset     - Delete and recreate all Elasticsearch components
  test      - Test search functionality
  help      - Show this help message

Usage:
  npm run es:setup
  npm run es:health
  npm run es:status
  npm run es:reset
  npm run es:test

Environment Variables:
  ELASTICSEARCH_URL              - Elasticsearch server URL (default: http://localhost:9200)
  ELASTICSEARCH_INDEX_PREFIX     - Index name prefix (default: youtube_pronunciation)
  ELASTICSEARCH_MAX_RETRIES      - Max connection retries (default: 3)
  ELASTICSEARCH_REQUEST_TIMEOUT  - Request timeout in ms (default: 30000)
`);
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const cli = new ElasticsearchCLI();
  const command = process.argv[2];

  switch (command) {
    case 'setup':
      await cli.setup();
      break;
    case 'health':
      await cli.health();
      break;
    case 'status':
      await cli.status();
      break;
    case 'reset':
      await cli.reset();
      break;
    case 'test':
      await cli.testSearch();
      break;
    case 'help':
    case '--help':
    case '-h':
      cli.help();
      break;
    default:
      console.log('❌ Unknown command. Use "help" to see available commands.');
      cli.help();
      process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 CLI Error:', error);
    process.exit(1);
  });
}

export default ElasticsearchCLI;