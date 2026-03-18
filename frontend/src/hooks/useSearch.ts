import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { searchApi, videoApi } from '../api/client.js';
import type {
  SearchParams,
  SearchResponse,
  SuggestionsResponse,
  SearchStatsResponse,
} from '../types/index.js';

// ─── Query keys ─────────────────────────────────────────────────
export const queryKeys = {
  search: (params: SearchParams) => ['search', params] as const,
  suggestions: (prefix: string, limit: number) => ['suggestions', prefix, limit] as const,
  searchStats: () => ['search', 'stats'] as const,
  video: (videoId: string) => ['video', videoId] as const,
  videoMetadata: (videoId: string) => ['video', videoId, 'metadata'] as const,
  videoSubtitles: (videoId: string, limit?: number, offset?: number) =>
    ['video', videoId, 'subtitles', limit, offset] as const,
  videos: (accent?: string, limit?: number, offset?: number) =>
    ['videos', accent, limit, offset] as const,
};

// ──────────────────────────────────────────────────────────────
// Search hooks
// ──────────────────────────────────────────────────────────────

/**
 * Hook to search subtitles with caching and deduplication
 */
export function useSearch(params: SearchParams | null, options?: { enabled?: boolean }) {
  return useQuery<SearchResponse>({
    queryKey: params ? queryKeys.search(params) : ['search', 'idle'],
    queryFn: () => searchApi.search(params!),
    enabled: !!params && params.query.trim().length >= 2 && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,       // 5 minutes
    placeholderData: keepPreviousData, // show old results while fetching new ones
    retry: 2,
  });
}

/**
 * Hook to get autocomplete suggestions
 */
export function useSuggestions(prefix: string, limit = 10) {
  return useQuery<SuggestionsResponse>({
    queryKey: queryKeys.suggestions(prefix, limit),
    queryFn: () => searchApi.getSuggestions(prefix, limit),
    enabled: prefix.trim().length >= 2,
    staleTime: 10 * 60 * 1000,      // 10 minutes
    retry: 1,
  });
}

/**
 * Hook to get search statistics
 */
export function useSearchStats() {
  return useQuery<SearchStatsResponse>({
    queryKey: queryKeys.searchStats(),
    queryFn: searchApi.getStats,
    staleTime: 60 * 60 * 1000,      // 1 hour
    retry: 1,
  });
}

// ──────────────────────────────────────────────────────────────
// Video hooks
// ──────────────────────────────────────────────────────────────

/**
 * Hook to get a video with its subtitles
 */
export function useVideo(videoId: string | null) {
  return useQuery({
    queryKey: videoId ? queryKeys.video(videoId) : ['video', 'idle'],
    queryFn: () => videoApi.getVideo(videoId!),
    enabled: !!videoId,
    staleTime: 30 * 60 * 1000,      // 30 minutes
  });
}

/**
 * Hook to get video metadata only
 */
export function useVideoMetadata(videoId: string | null) {
  return useQuery({
    queryKey: videoId ? queryKeys.videoMetadata(videoId) : ['video', 'idle', 'metadata'],
    queryFn: () => videoApi.getMetadata(videoId!),
    enabled: !!videoId,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to list videos
 */
export function useVideos(accent?: string, limit = 20, offset = 0) {
  return useQuery({
    queryKey: queryKeys.videos(accent, limit, offset),
    queryFn: () => videoApi.listVideos(accent, limit, offset),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
