# Database Connection Layers

This module provides a unified database connection management system for the YouTube Pronunciation Search platform, integrating PostgreSQL, Elasticsearch, and Redis with comprehensive connection pooling, health monitoring, and error handling.

## Overview

The connection layers provide:

- **Unified Connection Management**: Single interface for all database connections
- **Connection Pooling**: Efficient resource management with configurable pools
- **Health Monitoring**: Continuous monitoring with alerting and recovery
- **Error Handling**: Robust error handling with retry logic
- **Environment Configuration**: Flexible configuration via environment variables
- **Graceful Shutdown**: Proper cleanup and resource management

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                Connection Manager                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ PostgreSQL   │  │Elasticsearch │  │    Redis     │  │
│  │ Pool Manager │  │ Connection   │  │ Connection   │  │
│  │              │  │ Manager      │  │ Manager      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                ┌─────────┼─────────┐
                │         │         │
    ┌───────────▼──┐  ┌──▼─────┐  ┌─▼──────┐
    │ PostgreSQL   │  │Elasticsearch│  │ Redis  │
    │ (Metadata)   │  │ (Search)    │  │(Cache) │
    └──────────────┘  └─────────────┘  └────────┘
```

## Components

### 1. ConnectionManager (`index.ts`)

Central coordinator for all database connections.

**Features:**
- Singleton pattern for global access
- Unified initialization and shutdown
- Health checking across all services
- Automatic health monitoring
- Graceful error handling

**Usage:**
```typescript
import { connectionManager, initializeConnections } from './connections';

// Initialize all connections
await initializeConnections();

// Get individual connections
const db = connectionManager.getDatabaseConnection();
const es = connectionManager.getElasticsearchConnection();
const redis = connectionManager.getRedisConnection();

// Check health
const health = await connectionManager.checkHealth();

// Shutdown
await connectionManager.shutdown();
```

### 2. ConnectionFactory (`factory.ts`)

Factory for creating and configuring database connections.

**Features:**
- Environment-based configuration
- Connection validation and testing
- Retry logic with exponential backoff
- Configuration validation
- Support for custom configurations

**Usage:**
```typescript
import { connectionFactory } from './connections/factory';

// Create individual connections
const dbManager = await connectionFactory.createPostgreSQLConnection({
  host: 'localhost',
  port: 5432,
  database: 'youtube_pronunciation',
  max: 20,
});

// Create all connections
const connections = await connectionFactory.createAllConnections({
  database: { max: 20 },
  elasticsearch: { maxRetries: 5 },
  redis: { db: 1 },
});

// Validate configuration
const validation = connectionFactory.validateConfiguration(config);
if (!validation.valid) {
  console.error('Invalid config:', validation.errors);
}
```

### 3. PoolManager (`poolManager.ts`)

Advanced connection pool management for each database type.

**PostgreSQL Pool Manager:**
- Connection lifecycle management
- Transaction support with automatic rollback
- Query execution with monitoring
- Pool statistics and health checks
- Event-driven monitoring

**Elasticsearch Connection Manager:**
- Request execution with monitoring
- Performance metrics collection
- Cluster health monitoring
- Error handling and retry logic

**Redis Connection Manager:**
- Command execution with monitoring
- Connection state tracking
- Reconnection handling
- Performance statistics

**Usage:**
```typescript
// PostgreSQL
const result = await dbManager.query('SELECT * FROM videos WHERE id = $1', [videoId]);

await dbManager.transaction(async (client) => {
  await client.query('INSERT INTO videos ...');
  await client.query('INSERT INTO subtitles ...');
});

// Elasticsearch
const searchResult = await esManager.request('search', {
  index: 'subtitles',
  body: { query: { match: { text: 'hello' } } }
});

// Redis
const value = await redisManager.command('get', 'key');
await redisManager.command('set', 'key', 'value', 'EX', 3600);
```

### 4. HealthMonitor (`healthMonitor.ts`)

Comprehensive health monitoring and alerting system.

**Features:**
- Periodic health checks
- Performance metrics collection
- Alert system for connection issues
- Automatic recovery attempts
- Event-driven architecture
- Historical performance tracking

**Usage:**
```typescript
import { HealthMonitor } from './connections/healthMonitor';

const monitor = new HealthMonitor({
  checkInterval: 30000,    // 30 seconds
  alertThreshold: 3,       // 3 consecutive failures
  recoveryAttempts: 3,     // Max recovery attempts
});

// Register connections
monitor.registerConnections({
  database: dbManager,
  elasticsearch: esManager,
  redis: redisManager,
});

// Event handling
monitor.on('healthCheck', (report) => {
  console.log('Health check:', report.overall.healthy);
});

monitor.on('serviceAlert', (alert) => {
  console.error(`Service ${alert.service} is unhealthy!`);
});

// Start monitoring
monitor.start();

// Get current health
const health = await monitor.getCurrentHealth();

// Get performance metrics
const metrics = monitor.getPerformanceMetrics('database');
```

## Configuration

### Environment Variables

**PostgreSQL:**
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=youtube_pronunciation
DB_USER=postgres
DB_PASSWORD=postgres
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
DB_ACQUIRE_TIMEOUT=5000
DB_STATEMENT_TIMEOUT=30000
DB_QUERY_TIMEOUT=30000
```

**Elasticsearch:**
```bash
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX_PREFIX=youtube_pronunciation
ELASTICSEARCH_MAX_RETRIES=3
ELASTICSEARCH_REQUEST_TIMEOUT=30000
ELASTICSEARCH_PING_TIMEOUT=3000
ELASTICSEARCH_SNIFF_ON_START=false
ELASTICSEARCH_SNIFF_ON_FAULT=false
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=password
```

**Redis:**
```bash
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=password
REDIS_DB=0
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=100
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
```

**Health Monitoring:**
```bash
HEALTH_CHECK_INTERVAL=60000
```

### Docker Compose Configuration

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: youtube_pronunciation
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    command: >
      postgres
      -c max_connections=100
      -c shared_buffers=256MB
      -c effective_cache_size=1GB

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
```

## Health Monitoring

### Health Check Endpoint

```typescript
import { getConnectionsHealth } from './connections';

app.get('/health/connections', async (req, res) => {
  try {
    const health = await getConnectionsHealth();
    const status = health.database.connected && 
                   health.elasticsearch.connected && 
                   health.redis.connected ? 200 : 503;
    
    res.status(status).json(health);
  } catch (error) {
    res.status(503).json({ error: 'Health check failed' });
  }
});
```

### Health Response Format

```json
{
  "database": {
    "connected": true,
    "latency": 12,
    "error": null
  },
  "elasticsearch": {
    "connected": true,
    "latency": 8,
    "error": null
  },
  "redis": {
    "connected": true,
    "latency": 3,
    "error": null
  }
}
```

## Performance Monitoring

### Pool Statistics

```typescript
// Get PostgreSQL pool stats
const dbStats = dbManager.getStats();
console.log({
  totalConnections: dbStats.totalConnections,
  idleConnections: dbStats.idleConnections,
  activeConnections: dbStats.activeConnections,
  waitingClients: dbStats.waitingClients,
  queriesExecuted: dbStats.queriesExecuted,
  errors: dbStats.errors,
});

// Get Elasticsearch stats
const esStats = esManager.getStats();
console.log({
  requestsExecuted: esStats.requestsExecuted,
  averageLatency: esStats.averageLatency,
  errors: esStats.errors,
});

// Get Redis stats
const redisStats = redisManager.getStats();
console.log({
  commandsExecuted: redisStats.commandsExecuted,
  averageLatency: redisStats.averageLatency,
  isConnected: redisStats.isConnected,
  reconnections: redisStats.reconnections,
});
```

### Performance Metrics

```typescript
// Get performance metrics from health monitor
const metrics = healthMonitor.getPerformanceMetrics('database');
console.log({
  averageLatency: metrics.averageLatency,
  minLatency: metrics.minLatency,
  maxLatency: metrics.maxLatency,
  successRate: metrics.successRate,
  totalChecks: metrics.totalChecks,
});
```

## Error Handling

### Connection Errors

All connection operations include comprehensive error handling:

```typescript
try {
  const result = await dbManager.query('SELECT * FROM videos');
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    // Handle connection refused
    logger.error('Database connection refused');
  } else if (error.code === '23505') {
    // Handle unique constraint violation
    logger.error('Duplicate key error');
  } else {
    // Handle other errors
    logger.error('Database query failed:', error);
  }
}
```

### Graceful Degradation

Services are designed to degrade gracefully when connections fail:

```typescript
// Example: Cache fallback
async function getVideoData(videoId: string) {
  try {
    // Try cache first
    const cached = await redisManager.command('get', `video:${videoId}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    logger.warn('Redis unavailable, falling back to database');
  }
  
  // Fallback to database
  return await dbManager.query('SELECT * FROM videos WHERE id = $1', [videoId]);
}
```

## Testing

### Unit Tests

Run the test suite:

```bash
npm test connections
```

### Integration Tests

Test with real databases:

```bash
# Start test databases
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
npm run test:integration

# Cleanup
docker-compose -f docker-compose.test.yml down
```

### Load Testing

Test connection pools under load:

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery run load-test.yml
```

## Production Deployment

### Scaling Considerations

1. **Connection Pool Sizing:**
   - PostgreSQL: 20-50 connections per instance
   - Monitor pool utilization and adjust based on load

2. **Elasticsearch Cluster:**
   - Use multiple nodes for high availability
   - Configure proper shard and replica settings

3. **Redis Clustering:**
   - Use Redis Cluster for horizontal scaling
   - Configure appropriate memory limits

### Monitoring Setup

1. **Application Metrics:**
   - Connection pool statistics
   - Query performance metrics
   - Error rates and latency

2. **Infrastructure Metrics:**
   - Database CPU and memory usage
   - Network latency and throughput
   - Disk I/O and storage usage

3. **Alerting:**
   - Connection failures
   - High latency alerts
   - Pool exhaustion warnings

### Security Considerations

1. **Network Security:**
   - Use VPC/private networks
   - Configure firewalls and security groups
   - Enable SSL/TLS for all connections

2. **Authentication:**
   - Use strong passwords
   - Rotate credentials regularly
   - Use IAM roles where possible

3. **Data Protection:**
   - Encrypt data at rest
   - Use connection encryption
   - Implement proper access controls

## Troubleshooting

### Common Issues

1. **Connection Pool Exhaustion:**
   ```
   Error: remaining connection slots are reserved
   ```
   - Increase pool size or reduce connection hold time
   - Check for connection leaks

2. **Elasticsearch Connection Timeout:**
   ```
   Error: Request Timeout after 30000ms
   ```
   - Increase request timeout
   - Check Elasticsearch cluster health

3. **Redis Connection Drops:**
   ```
   Error: Connection lost
   ```
   - Check Redis memory usage
   - Verify network connectivity

### Debug Mode

Enable debug logging:

```bash
DEBUG=connections:* npm start
```

### Health Check Debugging

```typescript
// Get detailed health information
const health = await connectionManager.checkHealth();
console.log('Detailed health:', JSON.stringify(health, null, 2));

// Get pool statistics
const dbHealth = await dbManager.getHealth();
console.log('Database pool health:', dbHealth);
```

## API Reference

### ConnectionManager

- `initialize(config?)`: Initialize all connections
- `getDatabaseConnection()`: Get PostgreSQL connection
- `getElasticsearchConnection()`: Get Elasticsearch connection
- `getRedisConnection()`: Get Redis connection
- `checkHealth()`: Check health of all connections
- `shutdown()`: Gracefully shutdown all connections
- `isReady()`: Check if manager is initialized

### ConnectionFactory

- `createPostgreSQLConnection(config?)`: Create PostgreSQL connection
- `createElasticsearchConnection(config?)`: Create Elasticsearch connection
- `createRedisConnection(config?)`: Create Redis connection
- `createAllConnections(config?)`: Create all connections
- `validateConfiguration(config)`: Validate configuration

### HealthMonitor

- `registerConnections(connections)`: Register connections for monitoring
- `start()`: Start health monitoring
- `stop()`: Stop health monitoring
- `getCurrentHealth()`: Get current health status
- `getPerformanceMetrics(service)`: Get performance metrics
- `getStatus()`: Get monitoring status

## Contributing

When adding new database connections or modifying existing ones:

1. Follow the established patterns for connection management
2. Add comprehensive error handling and logging
3. Include health check capabilities
4. Write unit and integration tests
5. Update documentation and examples
6. Consider performance and security implications

## License

This module is part of the YouTube Pronunciation Search platform and follows the same license terms.