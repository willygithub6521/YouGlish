import { Client } from '@elastic/elasticsearch';
import ElasticsearchConnection from './config.js';
import { ElasticsearchIndexManager } from './indexManager.js';
import { searchQueryTemplates, aggregationQueries, SubtitleDocument } from './mappings.js';

/**
 * Search parameters interface
 */
export interface SearchParams {
  query: string;
  accent?: string;
  fuzzy?: boolean;
  limit?: number;
  offset?: number;
  videoId?: string;
}

/**
 * Search result interface
 */
export interface SearchResult {
  id: string;
  videoId: string;
  startTime: number;
  endTime: number;
  text: string;
  accent: string;
  relevanceScore: number;
  highlightedText?: string;
}

/**
 * Search response interface
 */
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  accentCounts: Record<string, number>;
  took: number;
}

/**
 * Elasticsearch Search Service
 * Handles all search operations for subtitle content
 */
export class ElasticsearchSearchService {
  private client: Client;
  private indexManager: ElasticsearchIndexManager;
  private indexName: string;

  constructor() {
    const esConnection = ElasticsearchConnection.getInstance();
    this.client = esConnection.getClient();
    this.indexManager = new ElasticsearchIndexManager();
    this.indexName = this.indexManager.getIndexName('subtitles');
  }

  /**
   * Search subtitles with various options
   */
  public async searchSubtitles(params: SearchParams): Promise<SearchResponse> {
    const {
      query,
      accent,
      fuzzy = true,
      limit = 20,
      offset = 0,
      videoId
    } = params;

    try {
      // Build the search query
      const searchQuery = this.buildSearchQuery(query, accent, fuzzy, videoId);
      
      // Execute search with aggregations
      const response = await this.client.search({
        index: this.indexName,
        body: {
          ...searchQuery,
          from: offset,
          size: limit,
          // Add aggregations for accent counts
          aggs: aggregationQueries.accentCounts.aggs
        }
      });

      // Process results
      const results = this.processSearchResults(response.body.hits.hits);
      const accentCounts = this.processAccentAggregations(response.body.aggregations);

      return {
        results,
        total: response.body.hits.total.value,
        accentCounts,
        took: response.body.took
      };
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Get search suggestions based on input prefix
   */
  public async getSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            match_phrase_prefix: {
              text: {
                query: prefix,
                max_expansions: 50
              }
            }
          },
          _source: ['text'],
          size: limit * 2, // Get more to filter duplicates
          highlight: {
            fields: {
              text: {
                pre_tags: [''],
                post_tags: [''],
                fragment_size: 50,
                number_of_fragments: 1
              }
            }
          }
        }
      });

      // Extract unique suggestions from results
      const suggestions = new Set<string>();
      
      response.body.hits.hits.forEach((hit: any) => {
        const text = hit._source.text.toLowerCase();
        const words = text.split(/\s+/);
        
        // Find words that start with the prefix
        words.forEach(word => {
          const cleanWord = word.replace(/[^\w]/g, '');
          if (cleanWord.toLowerCase().startsWith(prefix.toLowerCase()) && cleanWord.length > prefix.length) {
            suggestions.add(cleanWord);
          }
        });
      });

      return Array.from(suggestions).slice(0, limit);
    } catch (error) {
      console.error('Suggestions error:', error);
      return [];
    }
  }

  /**
   * Search for exact phrases
   */
  public async searchExactPhrase(phrase: string, accent?: string, limit: number = 20): Promise<SearchResponse> {
    try {
      const filters = accent ? [{ term: { accent } }] : [];
      
      const query = {
        query: {
          bool: {
            must: [
              {
                match_phrase: {
                  text: phrase
                }
              }
            ],
            filter: filters
          }
        },
        highlight: {
          fields: {
            text: {
              pre_tags: ['<mark>'],
              post_tags: ['</mark>'],
              type: 'phrase'
            }
          }
        },
        size: limit,
        aggs: aggregationQueries.accentCounts.aggs
      };

      const response = await this.client.search({
        index: this.indexName,
        body: query
      });

      const results = this.processSearchResults(response.body.hits.hits);
      const accentCounts = this.processAccentAggregations(response.body.aggregations);

      return {
        results,
        total: response.body.hits.total.value,
        accentCounts,
        took: response.body.took
      };
    } catch (error) {
      console.error('Exact phrase search error:', error);
      throw new Error(`Exact phrase search failed: ${error.message}`);
    }
  }

  /**
   * Get subtitles for a specific video
   */
  public async getVideoSubtitles(videoId: string): Promise<SearchResult[]> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            term: {
              video_id: videoId
            }
          },
          sort: [
            {
              start_time: {
                order: 'asc'
              }
            }
          ],
          size: 10000 // Large number to get all subtitles for a video
        }
      });

      return this.processSearchResults(response.body.hits.hits);
    } catch (error) {
      console.error('Get video subtitles error:', error);
      throw new Error(`Failed to get video subtitles: ${error.message}`);
    }
  }

  /**
   * Get statistics about the search index
   */
  public async getSearchStats(): Promise<any> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          size: 0,
          aggs: {
            ...aggregationQueries.accentCounts.aggs,
            ...aggregationQueries.videoStats.aggs
          }
        }
      });

      return {
        totalDocuments: response.body.hits.total.value,
        accentCounts: this.processAccentAggregations(response.body.aggregations),
        uniqueVideos: response.body.aggregations.unique_videos.value,
        avgDuration: response.body.aggregations.avg_duration.value
      };
    } catch (error) {
      console.error('Get search stats error:', error);
      throw new Error(`Failed to get search stats: ${error.message}`);
    }
  }

  /**
   * Build search query based on parameters
   */
  private buildSearchQuery(query: string, accent?: string, fuzzy: boolean = true, videoId?: string): any {
    const filters: any[] = [];
    
    // Add accent filter if specified
    if (accent && accent !== 'ALL') {
      filters.push({ term: { accent } });
    }
    
    // Add video filter if specified
    if (videoId) {
      filters.push({ term: { video_id: videoId } });
    }

    if (fuzzy) {
      // Use fuzzy search with multi-field matching
      return {
        query: {
          bool: {
            should: [
              {
                multi_match: {
                  query,
                  fields: ['text^2', 'text.exact'],
                  type: 'best_fields',
                  fuzziness: 'AUTO',
                  prefix_length: 1,
                  max_expansions: 50
                }
              },
              {
                match_phrase: {
                  text: {
                    query,
                    boost: 3.0
                  }
                }
              }
            ],
            minimum_should_match: 1,
            filter: filters
          }
        },
        highlight: {
          fields: {
            text: {
              pre_tags: ['<mark>'],
              post_tags: ['</mark>'],
              fragment_size: 150,
              number_of_fragments: 1
            }
          }
        },
        sort: [
          '_score',
          {
            start_time: {
              order: 'asc'
            }
          }
        ]
      };
    } else {
      // Use exact matching
      return {
        query: {
          bool: {
            must: [
              {
                match: {
                  'text.exact': query
                }
              }
            ],
            filter: filters
          }
        },
        highlight: {
          fields: {
            text: {
              pre_tags: ['<mark>'],
              post_tags: ['</mark>']
            }
          }
        },
        sort: [
          '_score',
          {
            start_time: {
              order: 'asc'
            }
          }
        ]
      };
    }
  }

  /**
   * Process search results from Elasticsearch response
   */
  private processSearchResults(hits: any[]): SearchResult[] {
    return hits.map(hit => {
      const source = hit._source;
      const highlight = hit.highlight?.text?.[0];
      
      return {
        id: hit._id,
        videoId: source.video_id,
        startTime: source.start_time,
        endTime: source.end_time,
        text: source.text,
        accent: source.accent,
        relevanceScore: hit._score,
        highlightedText: highlight
      };
    });
  }

  /**
   * Process accent aggregations from Elasticsearch response
   */
  private processAccentAggregations(aggregations: any): Record<string, number> {
    const accentCounts: Record<string, number> = {
      ALL: 0,
      US: 0,
      UK: 0,
      AU: 0,
      CA: 0,
      OTHER: 0
    };

    if (aggregations?.accent_counts?.buckets) {
      let total = 0;
      aggregations.accent_counts.buckets.forEach((bucket: any) => {
        accentCounts[bucket.key] = bucket.doc_count;
        total += bucket.doc_count;
      });
      accentCounts.ALL = total;
    }

    return accentCounts;
  }

  /**
   * Index a single subtitle document
   */
  public async indexSubtitle(subtitle: SubtitleDocument): Promise<boolean> {
    try {
      const response = await this.client.index({
        index: this.indexName,
        id: `${subtitle.video_id}_${subtitle.subtitle_id}`,
        body: subtitle,
        refresh: 'wait_for'
      });

      return response.statusCode === 201 || response.statusCode === 200;
    } catch (error) {
      console.error('Error indexing subtitle:', error);
      return false;
    }
  }

  /**
   * Delete subtitles for a specific video
   */
  public async deleteVideoSubtitles(videoId: string): Promise<boolean> {
    try {
      const response = await this.client.deleteByQuery({
        index: this.indexName,
        body: {
          query: {
            term: {
              video_id: videoId
            }
          }
        },
        refresh: true
      });

      console.log(`Deleted ${response.body.deleted} subtitles for video ${videoId}`);
      return true;
    } catch (error) {
      console.error('Error deleting video subtitles:', error);
      return false;
    }
  }
}