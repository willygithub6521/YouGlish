# Elasticsearch Configuration

This directory contains the Elasticsearch configuration, index management, and search functionality for the YouTube Pronunciation Search platform.

## Structure

```
elasticsearch/
├── config.ts           # Elasticsearch client configuration and connection management
├── mappings.ts         # Index mappings, settings, and query templates
├── indexManager.ts     # Index creation, management, and operations
├── searchService.ts    # Search functionality and query execution
├── cli.ts             # Command-line utility for index management
├── index.ts           # Module exports and initialization functions
└── README.md          # This documentation
```

## Configuration

### Environment Variables

Set these in your `.env` file:

```env
# Elasticsearch Configuration
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX_PREFIX=youtube_pronunciation
ELASTICSEARCH_MAX_RETRIES=3
ELASTICSEARCH_REQUEST_TIMEOUT=30000
```

### Index Design

The subtitles index is configured with the following mapping:

```json
{
  "mappings": {
    "properties": {
      "subtitle_id": { "type": "keyword" },
      "video_id": { "type": "keyword" },
      "text": {
        "type": "text",
        "analyzer": "english",
        "fields": {
          "exact": {
            "type": "text",
            "analyzer": "standard"
          }
        }
      },
      "start_time": { "type": "float" },
      "end_time": { "type": "float" },
      "accent": { "type": "keyword" }
    }
  }
}
```

**Key Features:**
- **English Analyzer**: Optimized for English text with stopword removal
- **Multi-field Text**: Both analyzed and exact matching capabilities
- **Performance Settings**: 3 shards, 1 replica for optimal performance
- **Keyword Fields**: Efficient filtering by video_id and accent

## Usage

### CLI Management

Use the provided CLI scripts for index management:

```bash
# Initialize Elasticsearch (create indices, templates, policies)
npm run es:setup

# Check Elasticsearch health and connection
npm run es:health

# Show detailed status of indices and components
npm run es:status

# Reset all Elasticsearch components (delete and recreate)
npm run es:reset

# Test search functionality
npm run es:test
```

### Programmatic Usage

#### Initialize Elasticsearch

```typescript
import { initializeElasticsearch } from './elasticsearch';

// Initialize during application startup
const success = await initializeElasticsearch();
if (!success) {
  console.error('Failed to initialize Elasticsearch');
  process.exit(1);
}
```

#### Search Service

```typescript
import { ElasticsearchSearchService } from './elasticsearch';

const searchService = new ElasticsearchSearchService();

// Basic search
const results = await searchService.searchSubtitles({
  query: 'pronunciation',
  accent: 'US',
  fuzzy: true,
  limit: 20,
  offset: 0
});

// Exact phrase search
const exactResults = await searchService.searchExactPhrase('how to pronounce');

// Get suggestions
const suggestions = await searchService.getSuggestions('pronun', 10);

// Get video subtitles
const videoSubtitles = await searchService.getVideoSubtitles('dQw4w9WgXcQ');
```

#### Index Management

```typescript
import { ElasticsearchIndexManager } from './elasticsearch';

const indexManager = new ElasticsearchIndexManager();

// Create index
await indexManager.createSubtitlesIndex();

// Bulk index subtitles
await indexManager.bulkIndexSubtitles(subtitleDocuments);

// Check index health
const health = await indexManager.healthCheck();
```

## Search Features

### Query Types

1. **Fuzzy Search**: Handles typos and variations
   - Uses `fuzziness: 'AUTO'` for intelligent fuzzy matching
   - Supports prefix matching and expansions
   - Boosts exact matches over fuzzy matches

2. **Exact Phrase Search**: Precise phrase matching
   - Uses `match_phrase` for exact word order
   - Ideal for specific pronunciation queries

3. **Multi-field Search**: Searches both analyzed and exact fields
   - Boosts phrase matches highest
   - Falls back to fuzzy matching for broader results

### Filtering

- **Accent Filtering**: Filter by US, UK, AU, CA, or OTHER accents
- **Video Filtering**: Search within specific videos
- **Time-based Sorting**: Results sorted by relevance and timestamp

### Highlighting

Search results include highlighted text with `<mark>` tags:
- Fragment size: 150 characters
- Pre/post tags: `<mark>` and `</mark>`
- Single fragment per result for clean display

### Aggregations

- **Accent Counts**: Count results by accent type
- **Video Statistics**: Unique video counts and duration averages
- **Search Analytics**: Performance and usage statistics

## Performance Optimizations

### Index Settings

```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "refresh_interval": "30s",
    "max_result_window": 50000
  }
}
```

### Query Optimizations

- **Field Boosting**: Text field boosted 2x, phrase matches 3x
- **Prefix Length**: Minimum 1 character before fuzzy expansion
- **Max Expansions**: Limited to 50 for performance
- **Result Window**: Capped at 50,000 documents

### Caching Strategy

- **Query Result Caching**: Elasticsearch's built-in query cache
- **Filter Caching**: Efficient caching of accent and video filters
- **Refresh Strategy**: 30-second refresh interval for near real-time search

## Index Lifecycle Management

### Lifecycle Policy

```json
{
  "hot": "Active indexing and searching",
  "warm": "Read-only after 30 days, reduced replicas",
  "cold": "Long-term storage after 90 days",
  "delete": "Automatic deletion after 365 days"
}
```

### Index Templates

- **Consistent Mapping**: Ensures all subtitle indices use the same mapping
- **Automatic Application**: New indices automatically inherit settings
- **Version Control**: Template versioning for schema evolution

## Monitoring and Health

### Health Checks

```typescript
import { checkElasticsearchHealth } from './elasticsearch';

const health = await checkElasticsearchHealth();
console.log('Connected:', health.connected);
console.log('Index exists:', health.indexExists);
console.log('Template exists:', health.templateExists);
```

### Statistics

```typescript
const stats = await searchService.getSearchStats();
console.log('Total documents:', stats.totalDocuments);
console.log('Accent distribution:', stats.accentCounts);
console.log('Unique videos:', stats.uniqueVideos);
```

## Error Handling

### Connection Errors

- **Automatic Retries**: Up to 3 retries with exponential backoff
- **Timeout Handling**: 30-second request timeout
- **Graceful Degradation**: Fallback to database search if Elasticsearch fails

### Index Errors

- **Mapping Conflicts**: Automatic index recreation if mapping changes
- **Shard Failures**: Replica shards provide redundancy
- **Disk Space**: Monitoring and alerting for storage issues

## Development Workflow

### Local Setup

1. **Start Elasticsearch**:
   ```bash
   docker-compose up -d elasticsearch
   ```

2. **Initialize Indices**:
   ```bash
   npm run es:setup
   ```

3. **Verify Setup**:
   ```bash
   npm run es:health
   npm run es:status
   ```

### Testing

```bash
# Test search functionality
npm run es:test

# Run unit tests
npm test -- elasticsearch

# Check index health
npm run es:health
```

### Debugging

```bash
# Check cluster health
curl http://localhost:9200/_cluster/health

# View index mapping
curl http://localhost:9200/youtube_pronunciation_subtitles/_mapping

# Search directly
curl -X POST "http://localhost:9200/youtube_pronunciation_subtitles/_search" \
  -H "Content-Type: application/json" \
  -d '{"query": {"match": {"text": "pronunciation"}}}'
```

## Production Considerations

### Security

- **Authentication**: Configure Elasticsearch security features
- **Network Security**: Use HTTPS and restrict network access
- **Index Permissions**: Limit access to specific indices

### Scaling

- **Horizontal Scaling**: Add more nodes for increased capacity
- **Shard Strategy**: Adjust shard count based on data volume
- **Replica Strategy**: Increase replicas for read performance

### Backup and Recovery

- **Snapshot Repository**: Configure automated snapshots
- **Index Restoration**: Procedures for index recovery
- **Data Migration**: Tools for moving data between clusters

### Monitoring

- **Cluster Monitoring**: Use Elasticsearch monitoring features
- **Performance Metrics**: Track query performance and resource usage
- **Alerting**: Set up alerts for cluster health and performance issues

## Integration with Application

### Search API Integration

The Elasticsearch search service integrates with the backend API:

```typescript
// In your API route
import { getSearchService } from './elasticsearch';

app.get('/api/search', async (req, res) => {
  const searchService = getSearchService();
  const results = await searchService.searchSubtitles(req.query);
  res.json(results);
});
```

### Data Indexing Pipeline

Subtitle data flows from PostgreSQL to Elasticsearch:

1. **Video Processing**: New videos processed and subtitles extracted
2. **Database Storage**: Subtitles stored in PostgreSQL
3. **Index Synchronization**: Subtitles indexed in Elasticsearch
4. **Search Availability**: Content becomes searchable

### Cache Integration

Elasticsearch works with Redis caching:

- **Search Result Caching**: Frequent queries cached in Redis
- **Suggestion Caching**: Popular suggestions cached for performance
- **Statistics Caching**: Aggregation results cached to reduce load

This Elasticsearch configuration provides a robust, scalable search foundation for the YouTube Pronunciation Search platform, supporting fuzzy search, accent filtering, and high-performance text analysis optimized for pronunciation learning use cases.