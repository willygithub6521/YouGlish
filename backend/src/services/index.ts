/**
 * Core Services Module
 * 
 * This module exports all core service classes that handle the business logic
 * for the YouTube pronunciation search platform.
 */

export { VideoService, type VideoServiceOptions } from './VideoService.js';
export { SearchService, type SearchServiceOptions } from './SearchService.js';
export { CacheService, type CacheServiceOptions, type CacheStats } from './CacheService.js';
export { YouTubeApiService, type YouTubeApiServiceOptions } from './YouTubeApiService.js';
export { YouTubeTranscriptService, type YouTubeTranscriptServiceOptions } from './YouTubeTranscriptService.js';

// Re-export types from other modules for convenience
export type {
  VideoMetadata,
  Subtitle,
  SearchParams,
  SearchResponse,
  SearchResult,
  Accent,
  YouTubeVideoData
} from '../types/index.js';

export type {
  CreateVideoData,
  UpdateVideoData
} from '../database/models/Video.js';

export type {
  CreateSubtitleData,
  UpdateSubtitleData
} from '../database/models/Subtitle.js';