import { ElasticsearchSearchService, SearchParams as ESSearchParams, SearchResult as ESSearchResult } from '../elasticsearch/searchService.js';
import { CacheService } from '../redis/cacheService.js';
import { getRedisConnection } from '../connections/index.js';
import { createLogger } from '../utils/logger.js';
import type { SearchParams, SearchResponse, SearchResult, Accent } from '../types/index.js';

const logger = createLogger();

export interface SearchServiceOptions {
  cacheEnabled?: boolean;
  searchCacheTTL?: number;
  suggestionsCacheTTL?: number;
}

/**
 * SearchService - Handles search logic and result ranking
 * 
 * This service provides high-level search operations with:
 * - Elasticsearch integration
 * - Result caching for performance
 * - Search suggestions
 * - Result ranking and filtering
 */
export class SearchService {
  private elasticsearchService: ElasticsearchSearchService;
  private cacheService: CacheService;
  private options: SearchServiceOptions;

  constructor(options: SearchServiceOptions = {}) {
    this.options = {
      cacheEnabled: true,
      searchCacheTTL: 60 * 60, // 1 hour
      suggestionsCacheTTL: 24 * 60 * 60, // 24 hours
      ...options
    };

    this.elasticsearchService = new ElasticsearchSearchService();
    
    const redisClient = getRedisConnection();
    this.cacheService = new CacheService(redisClient.getConnection());
  }

  /**
   * Search subtitles with caching and result processing
   */
  async search(params: SearchParams): Promise<SearchResponse> {
    const { query, accent = 'ALL', fuzzy = true, limit = 20, offset = 0 } = params;
    
    // Generate cache key
    const cacheKey = this.generateSearchCacheKey(params);

    try {
      // Try cache first if enabled
      if (this.options.cacheEnabled) {
        const cached = await this.cacheService.get<SearchResponse>(cacheKey);
        if (cached) {
          logger.debug(`Search cache hit for query: ${query}`);
          return cached;
        }
      }

      // Convert to Elasticsearch params
      const esParams: ESSearchParams = {
        query,
        accent: accent === 'ALL' ? undefined : accent,
        fuzzy,
        limit,
        offset
      };

      // Execute search
      const esResponse = await this.elasticsearchService.searchSubtitles(esParams);
      
      // Process and enhance results
      const processedResults = await this.processSearchResults(esResponse.results, query);
      
      // Build final response
      const response: SearchResponse = {
        results: processedResults,
        total: esResponse.total,
        query,
        accent,
        accentCounts: this.processAccentCounts(esResponse.accentCounts)
      };

      // Cache the result
      if (this.options.cacheEnabled) {
        await this.cacheService.set(cacheKey, response, { ttl: this.options.searchCacheTTL });
        logger.debug(`Search result cached for query: ${query}`);
      }

      logger.info(`Search completed: "${query}" (${accent}) - ${response.total} results`);
      return response;

    } catch (err: unknown) {
      const error = err as Error;
      logger.error(`Search error for query "${query}":`, error.message);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Get search suggestions with caching
   */
  async getSuggestions(prefix: string, limit = 10): Promise<string[]> {
    if (!prefix || prefix.length < 2) {
      return [];
    }

    const cacheKey = `suggestions:${prefix.toLowerCase()}:${limit}`;

    try {
      // Try cache first if enabled
      if (this.options.cacheEnabled) {
        const cached = await this.cacheService.get<string[]>(cacheKey);
        if (cached) {
          logger.debug(`Suggestions cache hit for prefix: ${prefix}`);
          return cached;
        }
      }

      // Get suggestions from Elasticsearch
      const suggestions = await this.elasticsearchService.getSuggestions(prefix, limit);
      
      // Filter and clean suggestions
      const cleanedSuggestions = this.cleanSuggestions(suggestions, prefix);

      // Cache the result
      if (this.options.cacheEnabled) {
        await this.cacheService.set(cacheKey, cleanedSuggestions, { 
          ttl: this.options.suggestionsCacheTTL 
        });
        logger.debug(`Suggestions cached for prefix: ${prefix}`);
      }

      return cleanedSuggestions;

    } catch (error) {
      logger.error(`Suggestions error for prefix "${prefix}":`, error);
      return [];
    }
  }

  /**
   * Search for exact phrases
   */
  async searchExactPhrase(phrase: string, accent?: Accent, limit = 20): Promise<SearchResponse> {
    const cacheKey = `exact:${phrase.toLowerCase()}:${accent || 'ALL'}:${limit}`;

    try {
      // Try cache first if enabled
      if (this.options.cacheEnabled) {
        const cached = await this.cacheService.get<SearchResponse>(cacheKey);
        if (cached) {
          logger.debug(`Exact phrase cache hit for: ${phrase}`);
          return cached;
        }
      }

      // Execute exact phrase search
      const esResponse = await this.elasticsearchService.searchExactPhrase(
        phrase, 
        accent === 'ALL' ? undefined : accent, 
        limit
      );

      // Process results
      const processedResults = await this.processSearchResults(esResponse.results, phrase);

      const response: SearchResponse = {
        results: processedResults,
        total: esResponse.total,
        query: phrase,
        accent: accent || 'ALL',
        accentCounts: this.processAccentCounts(esResponse.accentCounts)
      };

      // Cache the result
      if (this.options.cacheEnabled) {
        await this.cacheService.set(cacheKey, response, { ttl: this.options.searchCacheTTL });
      }

      logger.info(`Exact phrase search completed: "${phrase}" - ${response.total} results`);
      return response;

    } catch (err: unknown) {
      const error = err as Error;
      logger.error(`Exact phrase search error for "${phrase}":`, error.message);
      throw new Error(`Exact phrase search failed: ${error.message}`);
    }
  }

  /**
   * Get search statistics
   */
  async getSearchStats(): Promise<{
    totalDocuments: number;
    accentCounts: Record<Accent, number>;
    uniqueVideos: number;
    avgDuration: number;
  }> {
    const cacheKey = 'search:stats';

    try {
      // Try cache first if enabled
      if (this.options.cacheEnabled) {
        const cached = await this.cacheService.get<any>(cacheKey);
        if (cached) {
          logger.debug('Search stats cache hit');
          return cached;
        }
      }

      // Get stats from Elasticsearch
      const stats = await this.elasticsearchService.getSearchStats();
      
      // Process accent counts
      const processedStats = {
        ...stats,
        accentCounts: this.processAccentCounts(stats.accentCounts)
      };

      // Cache the result
      if (this.options.cacheEnabled) {
        await this.cacheService.set(cacheKey, processedStats, { ttl: 60 * 60 }); // 1 hour
      }

      return processedStats;

    } catch (err: unknown) {
      const error = err as Error;
      logger.error('Error getting search stats:', error.message);
      throw new Error(`Failed to get search stats: ${error.message}`);
    }
  }

  /**
   * Invalidate search cache for specific patterns
   */
  async invalidateSearchCache(pattern?: string): Promise<void> {
    try {
      const patterns = pattern ? [pattern] : [
        'search:*',
        'suggestions:*',
        'exact:*',
        'search:stats'
      ];

      for (const p of patterns) {
        await this.cacheService.invalidate(p);
      }

      logger.info(`Search cache invalidated for patterns: ${patterns.join(', ')}`);
    } catch (error) {
      logger.warn('Failed to invalidate search cache:', error);
    }
  }

  /**
   * Process and enhance search results
   */
  private async processSearchResults(results: ESSearchResult[], query: string): Promise<SearchResult[]> {
    return results.map(result => {
      // Extract context from the text
      const context = this.extractContext(result.text, query);
      
      return {
        id: result.id,
        videoId: result.videoId,
        startTime: result.startTime,
        endTime: result.endTime,
        text: result.highlightedText || result.text,
        accent: result.accent as Accent,
        relevanceScore: result.relevanceScore,
        context
      };
    });
  }

  /**
   * Extract context (before and after) from subtitle text
   */
  private extractContext(text: string, query: string): { before: string; after: string } {
    const queryIndex = text.toLowerCase().indexOf(query.toLowerCase());
    
    if (queryIndex === -1) {
      return { before: '', after: '' };
    }

    const words = text.split(' ');
    const queryWords = query.split(' ');
    const queryWordCount = queryWords.length;
    
    // Find the word index where the query starts
    let wordIndex = 0;
    for (let i = 0; i < words.length; i++) {
      const wordSlice = words.slice(i, i + queryWordCount).join(' ');
      if (wordSlice.toLowerCase().includes(query.toLowerCase())) {
        wordIndex = i;
        break;
      }
    }

    // Extract context (3 words before and after)
    const contextSize = 3;
    const beforeWords = words.slice(Math.max(0, wordIndex - contextSize), wordIndex);
    const afterWords = words.slice(wordIndex + queryWordCount, wordIndex + queryWordCount + contextSize);

    return {
      before: beforeWords.join(' '),
      after: afterWords.join(' ')
    };
  }

  /**
   * Process accent counts to ensure all accents are included
   */
  private processAccentCounts(accentCounts: Record<string, number>): Record<Accent, number> {
    const processed: Record<Accent, number> = {
      ALL: 0,
      US: 0,
      UK: 0,
      AU: 0,
      CA: 0,
      OTHER: 0
    };

    // Copy existing counts
    Object.entries(accentCounts).forEach(([accent, count]) => {
      if (accent in processed) {
        processed[accent as Accent] = count;
      }
    });

    // Calculate total for ALL if not already set
    if (processed.ALL === 0) {
      processed.ALL = processed.US + processed.UK + processed.AU + processed.CA + processed.OTHER;
    }

    return processed;
  }

  /**
   * Clean and filter suggestions
   */
  private cleanSuggestions(suggestions: string[], prefix: string): string[] {
    return suggestions
      .filter(suggestion => {
        // Filter out very short or very long suggestions
        return suggestion.length >= 2 && suggestion.length <= 50;
      })
      .filter(suggestion => {
        // Ensure suggestion starts with prefix (case insensitive)
        return suggestion.toLowerCase().startsWith(prefix.toLowerCase());
      })
      .filter(suggestion => {
        // Filter out suggestions with special characters
        return /^[a-zA-Z\s'-]+$/.test(suggestion);
      })
      .map(suggestion => {
        // Normalize case
        return suggestion.toLowerCase();
      })
      .filter((suggestion, index, array) => {
        // Remove duplicates
        return array.indexOf(suggestion) === index;
      })
      .sort((a, b) => {
        // Sort by length first, then alphabetically
        if (a.length !== b.length) {
          return a.length - b.length;
        }
        return a.localeCompare(b);
      });
  }

  /**
   * Generate cache key for search parameters
   */
  private generateSearchCacheKey(params: SearchParams): string {
    const { query, accent = 'ALL', fuzzy = true, limit = 20, offset = 0 } = params;
    return `search:${query.toLowerCase()}:${accent}:${fuzzy}:${limit}:${offset}`;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    elasticsearch: boolean;
    cache: boolean;
  }> {
    try {
      const [esHealth, cacheHealth] = await Promise.all([
        this.elasticsearchService.getSearchStats().then(() => true).catch(() => false),
        this.cacheService.exists('health:check').then(() => true).catch(() => false)
      ]);

      return {
        elasticsearch: esHealth,
        cache: cacheHealth
      };
    } catch (error) {
      logger.error('Error checking search service health:', error);
      return {
        elasticsearch: false,
        cache: false
      };
    }
  }
}