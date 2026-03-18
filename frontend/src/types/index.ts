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
  createdAt: string; // ISO string from API
  updatedAt: string;
}

// Subtitle interface
export interface Subtitle {
  id: number;
  videoId: string;
  startTime: number;
  endTime: number;
  text: string;
  createdAt: string;
}

// Search result interface
export interface SearchResult {
  id: string;
  videoId: string;
  videoTitle?: string;
  channelName?: string;
  startTime: number;
  endTime: number;
  text: string;
  accent: Accent;
  relevanceScore: number;
  highlightedText?: string;
  context?: {
    before: string;
    after: string;
  };
}

// Search parameters interface
export interface SearchParams {
  query: string;
  accent?: Accent;
  fuzzy?: boolean;
  exact?: boolean;
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

// Suggestions response
export interface SuggestionsResponse {
  suggestions: string[];
}

// Search stats response
export interface SearchStatsResponse {
  totalDocuments: number;
  accentCounts: Record<string, number>;
  uniqueVideos: number;
  avgDuration: number;
}

// Player state enum
export enum PlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5,
}

// App-level state
export interface AppState {
  query: string;
  accent: Accent;
  fuzzy: boolean;
  exact: boolean;
  currentResultIndex: number;
  autoPlay: boolean;
}

// Component prop interfaces
export interface SearchBarProps {
  initialQuery?: string;
  onSearch: (query: string, options?: { fuzzy?: boolean; exact?: boolean }) => void;
  isLoading: boolean;
  placeholder?: string;
}

export interface AccentFilterProps {
  selectedAccent: Accent;
  onAccentChange: (accent: Accent) => void;
  resultCounts: Record<Accent, number>;
  disabled?: boolean;
}

export interface VideoPlayerProps {
  videoId: string;
  startTime: number;
  endTime?: number;
  autoPlay?: boolean;
  onReady?: () => void;
  onStateChange?: (state: PlayerState) => void;
  onTimeUpdate?: (time: number) => void;
}

export interface SubtitleDisplayProps {
  text: string;
  highlightedText?: string;
  highlightWords?: string[];
  context?: {
    before: string;
    after: string;
  };
}

export interface ResultNavigatorProps {
  currentIndex: number;
  totalResults: number;
  onPrevious: () => void;
  onNext: () => void;
  autoPlay: boolean;
  onAutoPlayToggle: (enabled: boolean) => void;
  isLoading?: boolean;
}

export interface SearchResultCardProps {
  result: SearchResult;
  isActive: boolean;
  onClick: () => void;
}

// Pagination
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// API Error interface
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// Route param types
export interface SearchPageParams {
  q?: string;
  accent?: Accent;
  fuzzy?: string;
  page?: string;
}