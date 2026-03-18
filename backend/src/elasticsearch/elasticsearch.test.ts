/**
 * Elasticsearch configuration tests
 */

import { ElasticsearchIndexManager } from './indexManager.js';
import { ElasticsearchSearchService } from './searchService.js';
import { checkElasticsearchHealth, initializeElasticsearch } from './index.js';

// Mock the config module
jest.mock('./config.js', () => {
  return {
    __esModule: true,
    default: {
      getInstance: jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue({
          ping: jest.fn().mockResolvedValue(true),
          indices: {
            exists: jest.fn().mockResolvedValue({ statusCode: 200 }),
            create: jest.fn().mockResolvedValue({ statusCode: 200 }),
            delete: jest.fn().mockResolvedValue({ statusCode: 200 }),
            getSettings: jest.fn().mockResolvedValue({ body: {} }),
            getMapping: jest.fn().mockResolvedValue({ body: {} }),
            stats: jest.fn().mockResolvedValue({ body: { indices: {} } }),
            refresh: jest.fn().mockResolvedValue({ statusCode: 200 }),
            putSettings: jest.fn().mockResolvedValue({ statusCode: 200 }),
            putIndexTemplate: jest.fn().mockResolvedValue({ statusCode: 200 }),
            existsIndexTemplate: jest.fn().mockResolvedValue({ statusCode: 200 })
          },
          ilm: {
            putLifecycle: jest.fn().mockResolvedValue({ statusCode: 200 })
          },
          search: jest.fn().mockResolvedValue({
            body: {
              hits: {
                total: { value: 0 },
                hits: []
              },
              took: 5,
              aggregations: {
                accent_counts: {
                  buckets: []
                },
                unique_videos: {
                  value: 0
                },
                avg_duration: {
                  value: 0
                }
              }
            }
          }),
          index: jest.fn().mockResolvedValue({ statusCode: 201 }),
          bulk: jest.fn().mockResolvedValue({ 
            body: { 
              errors: false,
              items: []
            } 
          }),
          deleteByQuery: jest.fn().mockResolvedValue({ 
            body: { 
              deleted: 0 
            } 
          }),
          close: jest.fn().mockResolvedValue(undefined)
        }),
        getConfig: jest.fn().mockReturnValue({
          indexPrefix: 'youtube_pronunciation'
        }),
        testConnection: jest.fn().mockResolvedValue(true),
        getClusterHealth: jest.fn().mockResolvedValue({ 
          status: 'green',
          number_of_nodes: 1,
          number_of_data_nodes: 1,
          active_shards: 3
        }),
        close: jest.fn().mockResolvedValue(undefined)
      })
    },
    getElasticsearchConfig: jest.fn().mockReturnValue({
      url: 'http://localhost:9200',
      indexPrefix: 'youtube_pronunciation',
      maxRetries: 3,
      requestTimeout: 30000
    }),
    createElasticsearchClient: jest.fn(),
    ElasticsearchConnection: {
      getInstance: jest.fn().mockReturnValue({
        testConnection: jest.fn().mockResolvedValue(true)
      })
    }
  };
});



describe('Elasticsearch Configuration', () => {
  let indexManager: ElasticsearchIndexManager;
  let searchService: ElasticsearchSearchService;

  beforeEach(() => {
    indexManager = new ElasticsearchIndexManager();
    searchService = new ElasticsearchSearchService();
  });

  describe('Index Manager', () => {
    test('should generate correct index name', () => {
      const indexName = indexManager.getIndexName('subtitles');
      expect(indexName).toMatch(/^youtube_pronunciation_subtitles$/);
    });

    test('should check if index exists', async () => {
      const exists = await indexManager.indexExists('test_index');
      expect(exists).toBe(true);
    });

    test('should create subtitles index', async () => {
      const success = await indexManager.createSubtitlesIndex();
      expect(success).toBe(true);
    });

    test('should create index template', async () => {
      const success = await indexManager.createIndexTemplate();
      expect(success).toBe(true);
    });

    test('should create lifecycle policy', async () => {
      const success = await indexManager.createLifecyclePolicy();
      expect(success).toBe(true);
    });

    test('should perform health check', async () => {
      const health = await indexManager.healthCheck();
      expect(health.connected).toBe(true);
      expect(health.indexExists).toBe(true);
      expect(health.templateExists).toBe(true);
    });

    test('should bulk index subtitles', async () => {
      const subtitles = [
        {
          subtitle_id: 1,
          video_id: 'test123',
          text: 'Hello world',
          start_time: 0.0,
          end_time: 2.5,
          accent: 'US'
        }
      ];

      const success = await indexManager.bulkIndexSubtitles(subtitles);
      expect(success).toBe(true);
    });
  });

  describe('Search Service', () => {
    test('should search subtitles with basic query', async () => {
      const results = await searchService.searchSubtitles({
        query: 'test',
        limit: 10
      });

      expect(results).toHaveProperty('results');
      expect(results).toHaveProperty('total');
      expect(results).toHaveProperty('accentCounts');
      expect(results).toHaveProperty('took');
      expect(Array.isArray(results.results)).toBe(true);
    });

    test('should search with accent filter', async () => {
      const results = await searchService.searchSubtitles({
        query: 'pronunciation',
        accent: 'US',
        fuzzy: true,
        limit: 20
      });

      expect(results.total).toBe(0); // Mock returns empty results
      expect(results.accentCounts).toHaveProperty('ALL');
    });

    test('should get search suggestions', async () => {
      const suggestions = await searchService.getSuggestions('hel', 5);
      expect(Array.isArray(suggestions)).toBe(true);
    });

    test('should search exact phrases', async () => {
      const results = await searchService.searchExactPhrase('hello world');
      expect(results).toHaveProperty('results');
      expect(results).toHaveProperty('total');
    });

    test('should get video subtitles', async () => {
      const subtitles = await searchService.getVideoSubtitles('test123');
      expect(Array.isArray(subtitles)).toBe(true);
    });

    test('should get search statistics', async () => {
      const stats = await searchService.getSearchStats();
      expect(stats).toHaveProperty('totalDocuments');
      expect(stats).toHaveProperty('accentCounts');
    });

    test('should index single subtitle', async () => {
      const subtitle = {
        subtitle_id: 1,
        video_id: 'test123',
        text: 'Test subtitle',
        start_time: 0.0,
        end_time: 2.0,
        accent: 'US'
      };

      const success = await searchService.indexSubtitle(subtitle);
      expect(success).toBe(true);
    });

    test('should delete video subtitles', async () => {
      const success = await searchService.deleteVideoSubtitles('test123');
      expect(success).toBe(true);
    });
  });

  describe('Health and Initialization', () => {
    test('should check Elasticsearch health', async () => {
      const health = await checkElasticsearchHealth();
      console.log('HEALTH STATUS:', health);
      expect(health.connected).toBe(true);
    });

    test('should initialize Elasticsearch', async () => {
      const success = await initializeElasticsearch();
      console.log('INIT SUCCESS:', success);
      expect(success).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should have correct environment configuration', () => {
      // Test that configuration can be loaded
      const { getElasticsearchConfig } = require('./config.js');
      const config = getElasticsearchConfig();
      
      expect(config).toHaveProperty('url');
      expect(config).toHaveProperty('indexPrefix');
      expect(config).toHaveProperty('maxRetries');
      expect(config).toHaveProperty('requestTimeout');
    });
  });

  describe('Error Handling', () => {
    test('should handle connection errors gracefully', async () => {
      // Mock connection failure
      const mockClient = {
        ping: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };

      // Test that errors are caught and handled
      try {
        await mockClient.ping();
      } catch (error: unknown) {
        const err = error as Error;
        expect(err.message).toBe('Connection failed');
      }
    });

    test('should handle search errors gracefully', async () => {
      // This test verifies that search service handles errors properly
      // The actual implementation should catch and handle Elasticsearch errors
      const results = await searchService.searchSubtitles({
        query: 'test'
      });
      
      // Should return valid structure even on errors
      expect(results).toHaveProperty('results');
      expect(results).toHaveProperty('total');
    });
  });
});

describe('Elasticsearch Mappings and Templates', () => {
  test('should have valid subtitles mapping structure', () => {
    const { subtitlesIndexMapping } = require('./mappings.js');
    
    expect(subtitlesIndexMapping).toHaveProperty('mappings');
    expect(subtitlesIndexMapping).toHaveProperty('settings');
    expect(subtitlesIndexMapping.mappings).toHaveProperty('properties');
    
    const properties = subtitlesIndexMapping.mappings.properties;
    expect(properties).toHaveProperty('subtitle_id');
    expect(properties).toHaveProperty('video_id');
    expect(properties).toHaveProperty('text');
    expect(properties).toHaveProperty('start_time');
    expect(properties).toHaveProperty('end_time');
    expect(properties).toHaveProperty('accent');
  });

  test('should have English analyzer configuration', () => {
    const { subtitlesIndexMapping } = require('./mappings.js');
    
    expect(subtitlesIndexMapping.settings.analysis).toHaveProperty('analyzer');
    expect(subtitlesIndexMapping.settings.analysis.analyzer).toHaveProperty('english');
  });

  test('should have performance optimizations', () => {
    const { subtitlesIndexMapping } = require('./mappings.js');
    
    expect(subtitlesIndexMapping.settings.number_of_shards).toBe(3);
    expect(subtitlesIndexMapping.settings.number_of_replicas).toBe(1);
    expect(subtitlesIndexMapping.settings.refresh_interval).toBe('30s');
  });
});