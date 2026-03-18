import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  SearchParams,
  SearchResponse,
  VideoMetadata,
  Subtitle,
  SuggestionsResponse,
  SearchStatsResponse,
  ApiError,
} from '../types/index.js';

// ─── Base URL from env ──────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

// ─── Axios instance ─────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Response interceptor: unwrap data / normalise errors ───────
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error: ApiError }>) => {
    const apiErr: ApiError = error.response?.data?.error ?? {
      code: 'NETWORK_ERROR',
      message: error.message ?? 'An unexpected error occurred',
    };
    return Promise.reject(apiErr);
  }
);

// ──────────────────────────────────────────────────────────────────
// Search API
// ──────────────────────────────────────────────────────────────────

export const searchApi = {
  /**
   * Main subtitle search
   */
  search: async (params: SearchParams): Promise<SearchResponse> => {
    const { data } = await api.get<SearchResponse>('/search', {
      params: {
        q: params.query,
        accent: params.accent ?? 'ALL',
        fuzzy: params.fuzzy ?? true,
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
        exact: params.exact ?? false,
      },
    });
    return data;
  },

  /**
   * Exact phrase search
   */
  searchExact: async (params: SearchParams): Promise<SearchResponse> => {
    const { data } = await api.get<SearchResponse>('/search', {
      params: {
        q: params.query,
        accent: params.accent ?? 'ALL',
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
        exact: true,
      },
    });
    return data;
  },

  /**
   * Autocomplete suggestions
   */
  getSuggestions: async (prefix: string, limit = 10): Promise<SuggestionsResponse> => {
    const { data } = await api.get<SuggestionsResponse>('/search/suggestions', {
      params: { prefix, limit },
    });
    return data;
  },

  /**
   * Search index stats
   */
  getStats: async (): Promise<SearchStatsResponse> => {
    const { data } = await api.get<SearchStatsResponse>('/search/stats');
    return data;
  },
};

// ──────────────────────────────────────────────────────────────────
// Video API
// ──────────────────────────────────────────────────────────────────

export const videoApi = {
  /**
   * Get a single video with its subtitles
   */
  getVideo: async (videoId: string): Promise<{ video: VideoMetadata; subtitles: Subtitle[] }> => {
    const { data } = await api.get(`/videos/${videoId}`);
    return data;
  },

  /**
   * Get video metadata only
   */
  getMetadata: async (videoId: string): Promise<{ video: VideoMetadata }> => {
    const { data } = await api.get(`/videos/${videoId}/metadata`);
    return data;
  },

  /**
   * Get video subtitles (paginated)
   */
  getSubtitles: async (
    videoId: string,
    limit = 100,
    offset = 0
  ): Promise<{ subtitles: Subtitle[]; count: number }> => {
    const { data } = await api.get(`/videos/${videoId}/subtitles`, {
      params: { limit, offset },
    });
    return data;
  },

  /**
   * Get subtitle at a timestamp
   */
  getSubtitleAtTime: async (
    videoId: string,
    time: number
  ): Promise<{ subtitle: Subtitle | null }> => {
    const { data } = await api.get(`/videos/${videoId}/subtitles/at`, {
      params: { time },
    });
    return data;
  },

  /**
   * List all videos (optional accent filter)
   */
  listVideos: async (
    accent?: string,
    limit = 20,
    offset = 0
  ): Promise<{ videos: VideoMetadata[]; count: number; total: number }> => {
    const { data } = await api.get('/videos', { params: { accent, limit, offset } });
    return data;
  },
};

export default api;
