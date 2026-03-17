# Redis Configuration and Cache Services

This module provides a comprehensive Redis caching solution for the YouTube pronunciation search platform, implementing the cache strategies defined in the design document.

## Overview

The Redis module includes:
- **Connection Management**: Robust Redis connection with automatic reconnection
- **Cache Services**: High-level caching operations with TTL policies
- **Key Naming Conventions**: Structured cache keys following design patterns
- **Specialized Services**: Domain-specific cache services for search and video data
- **Health Monitoring**: Connection health checks and performance monitoring

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Redis Module                          │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ SearchCache │  │ VideoCache  │  │ CacheService│    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                          │                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │            RedisClient (Singleton)              │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │            RedisConnection                      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │   Redis   │
                    │  Server   │
                    └───────────┘
```

## Cache Key Patterns

Following the design document specifications:

```
search:{query}:{accent}:{offset}:{limit}  -> SearchResult[]
video:{videoId}:metadata                  -> VideoMetadata
video:{videoId}:subtitles                 -> Subtitle[]
suggestions:{prefix}                      -> string[]
accent_counts:{query}                     -> Record<Accent, number>
stats:{type}:{period}                     -> Statistics
```

## TTL Policies

| Data Type | TTL | Purpose |
|-----------|-----|---------|
| Search Results | 1 hour | Balance freshness with performance |
| Video Metadata | 24 hours | Stable data, infrequent changes |
| Video Subtitles | 24 hours | Stable data, expensive to fetch |
| Suggestions | 1 hour | Dynamic based on search patterns |
| Statistics | 30 minutes | Regular updates for analytics |

## Usage

### Basic Setup

```typescript
import { initializeRedis, redisClient } from './redis';

// Initialize during app startup
await initializeRedis();

// Get cache services
const searchCache = redisClient.getSearchCache();
const videoCache = redisClient.getVideoCache();
const cacheService = redisClient.getCacheService();
```

### Search Caching

```typescript
import { SearchCache, SearchCacheKey } from './redis';

const searchCache = redisClient.getSearchCache();

// Cache search results
const params: SearchCacheKey = {
  query: 'pronunciation',
  accent: 'US',
  offset: 0,
  limit: 20
};

await searchCache.cacheSearchResults(params, searchResponse);

// Retrieve cached results
const cachedResults = await searchCache.getSearchResults(params);

// Cache suggestions
await searchCache.cacheSuggestions('pronun', ['pronunciation', 'pronounce']);
const suggestions = await searchCache.getSuggestions('pronun');
```

### Video Caching

```typescript
import { VideoCache } from './redis';

const videoCache = redisClient.getVideoCache();

// Cache video data
await videoCache.cacheVideoMetadata(videoId, metadata);
await videoCache.cacheVideoSubtitles(videoId, subtitles);

// Or cache both at once
await videoCache.cacheVideoData(videoId, metadata, subtitles);

// Retrieve cached data
const { metadata, subtitles } = await videoCache.getVideoData(videoId);

// Batch operations
await videoCache.cacheMultipleVideos([
  { videoId: 'abc123', metadata, subtitles },
  { videoId: 'def456', metadata2, subtitles2 }
]);
```

### Cache Invalidation

```typescript
// Invalidate specific search query
await searchCache.invalidateSearchByQuery('pronunciation');

// Invalidate all video data for a video
await videoCache.invalidateVideo('abc123');

// Invalidate all search results
await searchCache.invalidateAllSearchResults();
```

### Health Monitoring

```typescript
import { getCacheHealthStatus, getCacheStats } from './redis';

// Check Redis health
const health = await getCacheHealthStatus();
console.log('Redis connected:', health.connected);
console.log('Latency:', health.latency, 'ms');

// Get cache statistics
const stats = await getCacheStats();
console.log('Cached videos:', stats.cachedVideosCount);
console.log('Search results:', stats.searchResultsCount);
```

## Configuration

### Environment Variables

```bash
# Redis connection (choose one)
REDIS_URL=redis://localhost:6379          # Full URL
# OR individual settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
```

### Docker Compose

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

## Performance Considerations

### Memory Management
- **LRU Eviction**: Configured with `allkeys-lru` policy
- **Memory Limit**: Set appropriate `maxmemory` based on available RAM
- **Key Expiration**: Automatic cleanup with TTL policies

### Connection Pooling
- **Singleton Pattern**: Single Redis client instance across the application
- **Connection Reuse**: Automatic connection management and reuse
- **Error Handling**: Graceful degradation when Redis is unavailable

### Batch Operations
- **Multi-Set**: Use `mset` for caching multiple items efficiently
- **Pipeline**: Automatic pipelining for better performance
- **Compression**: JSON serialization with minimal overhead

## Error Handling

The cache services implement graceful degradation:

```typescript
// Cache operations never throw - they return null on failure
const result = await searchCache.getSearchResults(params);
if (result === null) {
  // Cache miss or error - fetch from primary data source
  const freshData = await searchService.search(params);
  // Optionally cache the fresh data
  await searchCache.cacheSearchResults(params, freshData);
}
```

## Testing

### Unit Tests

```typescript
import { CacheService, RedisConnection } from './redis';

describe('CacheService', () => {
  let cacheService: CacheService;
  
  beforeEach(async () => {
    const connection = new RedisConnection({ host: 'localhost', port: 6379 });
    await connection.connect();
    cacheService = new CacheService(connection);
  });

  it('should cache and retrieve data', async () => {
    await cacheService.set('test_key', { data: 'test' });
    const result = await cacheService.get('test_key');
    expect(result).toEqual({ data: 'test' });
  });
});
```

### Integration Tests

```typescript
describe('Redis Integration', () => {
  beforeAll(async () => {
    await initializeRedis();
  });

  afterAll(async () => {
    await closeRedis();
  });

  it('should handle search caching workflow', async () => {
    const searchCache = redisClient.getSearchCache();
    // Test complete search caching workflow
  });
});
```

## Monitoring and Debugging

### Redis CLI Commands

```bash
# Connect to Redis
redis-cli

# Monitor cache keys
KEYS search:*
KEYS video:*

# Check memory usage
INFO memory

# Monitor commands in real-time
MONITOR

# Check specific key TTL
TTL search:pronunciation:US:0:20
```

### Application Metrics

```typescript
// Custom metrics collection
const metrics = {
  cacheHits: 0,
  cacheMisses: 0,
  cacheErrors: 0
};

// Track in your application
if (cachedResult) {
  metrics.cacheHits++;
} else {
  metrics.cacheMisses++;
}
```

## Best Practices

1. **Always Handle Cache Misses**: Never assume cache data exists
2. **Use Appropriate TTLs**: Balance freshness with performance
3. **Monitor Memory Usage**: Set up alerts for high memory usage
4. **Batch Operations**: Use multi-operations for better performance
5. **Graceful Degradation**: Application should work without cache
6. **Key Naming**: Follow consistent naming conventions
7. **Invalidation Strategy**: Plan cache invalidation for data updates

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check Redis server is running
2. **Memory Errors**: Increase memory limit or adjust eviction policy
3. **Slow Performance**: Check network latency and key patterns
4. **Data Inconsistency**: Review TTL policies and invalidation logic

### Debug Mode

```typescript
// Enable debug logging
process.env.REDIS_DEBUG = 'true';

// Check connection status
console.log('Redis connected:', redisClient.isConnected());

// Health check
const health = await redisClient.healthCheck();
console.log('Health check:', health);
```