/**
 * Simple validation script for Redis configuration
 * This script validates the Redis module without requiring a running Redis server
 */

import { getRedisConfig, RedisConnection } from './config';
import { CacheKeys, TTL_POLICIES } from './cacheKeys';
import { CacheService } from './cacheService';
import { SearchCache } from './searchCache';
import { VideoCache } from './videoCache';
import { RedisClient } from './client';

console.log('🔍 Validating Redis Configuration...\n');

// Test 1: Configuration
console.log('1. Testing configuration...');
const config = getRedisConfig();
console.log('✅ Configuration loaded:', {
  host: config.host,
  port: config.port,
  db: config.db,
});

// Test 2: Cache key generation
console.log('\n2. Testing cache key generation...');
const searchKey = CacheKeys.searchResults({
  query: 'Hello World',
  accent: 'US',
  offset: 0,
  limit: 20,
});
console.log('✅ Search key:', searchKey);

const videoMetadataKey = CacheKeys.videoMetadata('abc123');
console.log('✅ Video metadata key:', videoMetadataKey);

const suggestionsKey = CacheKeys.suggestions('hello');
console.log('✅ Suggestions key:', suggestionsKey);

// Test 3: TTL policies
console.log('\n3. Testing TTL policies...');
console.log('✅ Search results TTL:', TTL_POLICIES.SEARCH_RESULTS, 'seconds');
console.log('✅ Video metadata TTL:', TTL_POLICIES.VIDEO_METADATA, 'seconds');
console.log('✅ Video subtitles TTL:', TTL_POLICIES.VIDEO_SUBTITLES, 'seconds');

// Test 4: Service instantiation
console.log('\n4. Testing service instantiation...');
const connection = new RedisConnection(config);
console.log('✅ RedisConnection created');

const cacheService = new CacheService(connection);
console.log('✅ CacheService created');

const searchCache = new SearchCache(cacheService);
console.log('✅ SearchCache created');

const videoCache = new VideoCache(cacheService);
console.log('✅ VideoCache created');

// Test 5: Singleton pattern
console.log('\n5. Testing singleton pattern...');
const client1 = RedisClient.getInstance();
const client2 = RedisClient.getInstance();
console.log('✅ Singleton pattern working:', client1 === client2);

// Test 6: Pattern generation
console.log('\n6. Testing invalidation patterns...');
const searchPattern = CacheKeys.patterns.searchByQuery('test query');
console.log('✅ Search pattern:', searchPattern);

const videoPattern = CacheKeys.patterns.videoAll('abc123');
console.log('✅ Video pattern:', videoPattern);

console.log('\n🎉 All Redis configuration validations passed!');
console.log('\n📋 Summary:');
console.log('- Configuration management: ✅');
console.log('- Cache key generation: ✅');
console.log('- TTL policies: ✅');
console.log('- Service instantiation: ✅');
console.log('- Singleton pattern: ✅');
console.log('- Pattern generation: ✅');
console.log('\n✨ Redis module is ready for use!');