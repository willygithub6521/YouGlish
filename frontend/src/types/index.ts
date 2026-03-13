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

// Player state enum
export enum PlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5,
}

// Component prop interfaces
export interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export interface AccentFilterProps {
  selectedAccent: Accent;
  onAccentChange: (accent: Accent) => void;
  resultCounts: Record<Accent, number>;
}

export interface VideoPlayerProps {
  videoId: string;
  startTime: number;
  onReady: () => void;
  onStateChange: (state: PlayerState) => void;
}

export interface SubtitleDisplayProps {
  text: string;
  highlightWords: string[];
  context: {
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
}

// API Error interface
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}