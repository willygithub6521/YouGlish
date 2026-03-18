import { CacheService } from './cacheService';
import { CacheKeys, SearchCacheKey, TTL_POLICIES, Accent } from './cacheKeys';

export interface SearchResult {
  id: string;
  videoId: string;
  startTime: number;
  endTime: number;
  text: string;
  accent: Accent;
  relevanceScore: number;
  context: {
    before: string;
    after: string;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  accent: Accent;
  accentCounts: Record<Accent, number>;
}

/**
 * Specialized cache service for search-related operations
 */
export class SearchCache {
  constructor(private cacheService: CacheService) {}

  /**
   * Cache search results
   */
  async cacheSearchResults(
    params: SearchCacheKey,
    response: SearchResponse
  ): Promise<void> {
    const key = CacheKeys.searchResults(params);
    await this.cacheService.set(key, response, {
      ttl: TTL_POLICIES.SEARCH_RESULTS,
    });
  }

  /**
   * Get cached search results
   */
  async getSearchResults(params: SearchCacheKey): Promise<SearchResponse | null> {
    const key = CacheKeys.searchResults(params);
    return await this.cacheService.get<SearchResponse>(key);
  }

  /**
   * Cache accent counts for a query
   */
  async cacheAccentCounts(
    query: string,
    accentCounts: Record<Accent, number>
  ): Promise<void> {
    const key = CacheKeys.accentCounts(query);
    await this.cacheService.set(key, accentCounts, {
      ttl: TTL_POLICIES.SEARCH_RESULTS,
    });
  }

  /**
   * Get cached accent counts
   */
  async getAccentCounts(query: string): Promise<Record<Accent, number> | null> {
    const key = CacheKeys.accentCounts(query);
    return await this.cacheService.get<Record<Accent, number>>(key);
  }

  /**
   * Cache search suggestions
   */
  async cacheSuggestions(prefix: string, suggestions: string[]): Promise<void> {
    const key = CacheKeys.suggestions(prefix);
    await this.cacheService.set(key, suggestions, {
      ttl: TTL_POLICIES.SUGGESTIONS,
    });
  }

  /**
   * Get cached search suggestions
   */
  async getSuggestions(prefix: string): Promise<string[] | null> {
    const key = CacheKeys.suggestions(prefix);
    return await this.cacheService.get<string[]>(key);
  }

  /**
   * Invalidate all search results for a specific query
   */
  async invalidateSearchByQuery(query: string): Promise<number> {
    const pattern = CacheKeys.patterns.searchByQuery(query);
    return await this.cacheService.invalidate(pattern);
  }

  /**
   * Invalidate all search results
   */
  async invalidateAllSearchResults(): Promise<number> {
    const pattern = CacheKeys.patterns.allSearchResults();
    return await this.cacheService.invalidate(pattern);
  }

  /**
   * Invalidate all suggestions
   */
  async invalidateAllSuggestions(): Promise<number> {
    const pattern = CacheKeys.patterns.allSuggestions();
    return await this.cacheService.invalidate(pattern);
  }

  /**
   * Warm up cache with popular searches
   */
  async warmUpPopularSearches(
    popularQueries: Array<{ query: string; accent: Accent }>
  ): Promise<void> {
    // This would typically be called during application startup
    // or as a background job to pre-populate cache with popular searches
    console.log(`Warming up cache for ${popularQueries.length} popular searches`);
    
    // Implementation would depend on having access to search service
    // This is a placeholder for the warming logic
    for (const { query, accent } of popularQueries) {
      console.log(`Warming cache for query: ${query}, accent: ${accent}`);
      // Would call search service and cache results
    }
  }

  /**
   * Get cache statistics for search operations
   */
  async getSearchCacheStats(): Promise<{
    searchResultsCount: number;
    suggestionsCount: number;
    accentCountsCount: number;
  }> {
    try {
      // This is a simplified implementation
      // In production, you might want to use Redis SCAN for better performance
      const _searchKeys = await this.cacheService.mget([
        CacheKeys.patterns.allSearchResults(),
        CacheKeys.patterns.allSuggestions(),
      ]);

      return {
        searchResultsCount: 0, // Would need to implement key counting
        suggestionsCount: 0,
        accentCountsCount: 0,
      };
    } catch (error) {
      console.error('Error getting search cache stats:', error);
      return {
        searchResultsCount: 0,
        suggestionsCount: 0,
        accentCountsCount: 0,
      };
    }
  }
}