// Accent types
export type Accent = 'ALL' | 'US' | 'UK' | 'AU' | 'CA' | 'OTHER';

// Video metadata interface
export interface VideoMetadata {
  id: string;
  title: string;
  channelName: string;
  duration: number;
  accent: Accent;
  thumbnailUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

// Subtitle interface
export interface Subtitle {
  id: number;
  videoId: string;
  startTime: number;
  endTime: number;
  text: string;
  createdAt: Date;
}

// Search result interface
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

// Search parameters interface
export interface SearchParams {
  query: string;
  accent?: Accent;
  fuzzy?: boolean;
  limit?: number;
  offset?: number;
}

// Search response interface
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  accent: Accent;
  accentCounts: Record<Accent, number>;
}

// API Error interface
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

// YouTube API interfaces
export interface YouTubeVideoData {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
  };
  contentDetails: {
    duration: string;
  };
}

export interface YouTubeTranscriptItem {
  text: string;
  start: number;
  duration: number;
}