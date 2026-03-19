# Implementation Plan: YouTube Pronunciation Search Platform

## Overview

This implementation plan breaks down the YouTube pronunciation search platform into discrete coding tasks. The platform will be built using React/TypeScript frontend, Node.js/Express backend, with PostgreSQL, Elasticsearch, and Redis for data storage and caching.

## Tasks

- [x] 1. Project setup and infrastructure
  - [x] 1.1 Initialize project structure and dependencies
    - Create monorepo structure with frontend and backend directories
    - Set up package.json files with required dependencies
    - Configure TypeScript for both frontend and backend
    - Set up ESLint and Prettier configurations
    - _Requirements: 3.1, 3.2_

  - [x] 1.2 Configure development environment
    - Set up Docker Compose for PostgreSQL, Elasticsearch, and Redis
    - Create environment configuration files
    - Set up development scripts and build processes
    - _Requirements: 3.3_

  - [x]* 1.3 Set up testing framework
    - Configure Jest for unit testing
    - Set up React Testing Library for frontend tests
    - Configure test coverage reporting
    - _Requirements: 4.1_

- [x] 2. Database schema and indexing
  - [x] 2.1 Create PostgreSQL database schema
    - Implement videos table with proper indexes
    - Implement subtitles table with foreign key relationships
    - Create database migration scripts
    - _Requirements: 3.3, 2.3, 2.4_

  - [x] 2.2 Configure Elasticsearch index
    - Create subtitles index with proper mappings
    - Configure English text analyzer
    - Set up index settings for performance
    - _Requirements: 2.1, 3.3_

  - [x] 2.3 Set up Redis configuration
    - Configure Redis connection and settings
    - Implement cache key naming conventions
    - Set up TTL policies for different data types
    - _Requirements: 3.3, 4.1_

- [x] 3. Backend API foundation
  - [x] 3.1 Create Express server with TypeScript
    - Set up Express application with middleware
    - Configure CORS, body parsing, and error handling
    - Implement request logging and validation
    - _Requirements: 3.2_

  - [x] 3.2 Implement database connection layers
    - Create PostgreSQL connection pool and query helpers
    - Set up Elasticsearch client configuration
    - Implement Redis client with connection handling
    - _Requirements: 3.3_

  - [x] 3.3 Create core service classes
    - Implement VideoService with database operations
    - Create SearchService with Elasticsearch integration
    - Build CacheService with Redis operations
    - _Requirements: 2.1, 2.3, 2.4_

- [x] 4. External API integration
  - [x] 4.1 Implement YouTube Data API integration
    - Create YouTube API client with authentication
    - Implement video metadata fetching functions
    - Add error handling and rate limiting
    - _Requirements: 3.4, 2.3_

  - [x] 4.2 Implement YouTube Transcript API integration
    - Create transcript fetching service
    - Parse and normalize subtitle data
    - Handle multiple language and accent detection
    - _Requirements: 3.4, 2.2, 2.4_

  - [x]* 4.3 Write integration tests for external APIs
    - Test YouTube Data API integration with mock responses
    - Test transcript API with various video types
    - Test error handling for API failures
    - _Requirements: 3.4_

- [x] 5. Search functionality implementation
  - [x] 5.1 Implement core search API endpoint
    - Create GET /api/search endpoint with parameter validation
    - Implement fuzzy and exact search logic
    - Add pagination and result limiting
    - _Requirements: 2.1, 2.2_

  - [x] 5.2 Implement accent filtering
    - Accent-based search filtering via Elasticsearch
    - Accent count aggregation in search response
    - _Requirements: 2.2_

  - [x] 5.3 Implement search result ranking
    - Relevance scoring via Elasticsearch
    - Context extraction for search results
    - _Requirements: 2.1, 2.4_

  - [x]* 5.4 Write property tests for search functionality
    - Property 1: Search result consistency (identical queries → identical results)
    - Property 2: Fuzzy includes exact matches, accentCounts correctness
    - Property 3: Pagination invariants
    - Property 4: Suggestions consistency (lowercase, no duplicates)

  - [x]* 5.5 Write unit tests for search service
    - Test search parameter validation
    - Test accent filtering logic
    - Test pagination functionality
    - _Requirements: 2.1, 2.2_

- [x] 6. Video and subtitle management
  - [x] 6.1 Implement video metadata API
    - Create GET /api/videos/:videoId endpoint
    - Implement video data retrieval and caching
    - Add subtitle fetching with time-based queries
    - _Requirements: 2.3, 2.4_

  - [x] 6.2 Implement video indexing service
    - Create VideoIndexingService with 6-stage pipeline
    - Fetch YouTube metadata + transcript, store in DB, index in Elasticsearch
    - Add batch processing with concurrency control and re-indexing
    - _Requirements: 2.3, 2.4_

  - [x]* 6.3 Write unit tests for video service
    - Test video route endpoints (videos.test.ts, 14 tests)
    - Test VideoIndexingService pipeline (17 tests)
    - Test error handling for invalid video IDs
    - _Requirements: 2.3, 2.4_

- [x] 7. Caching implementation
  - [x] 7.1 Implement search result caching
    - Domain-aware CacheKeys builder with consistent key strategy
    - Search/suggestions get/set with TTL management
    - Cache invalidation by query pattern or full wipe
    - Popular search tracking and top-N retrieval
    - _Requirements: 4.1_

  - [x] 7.2 Implement video metadata caching
    - Video metadata and subtitles get/set with 24h TTL
    - Cache warming for batch pre-population (mset pipeline)
    - In-memory hit/miss statistics with per-domain tracking
    - _Requirements: 4.1_

- [x] 8. Frontend foundation
  - [x] 8.1 Create React application structure
    - React 18 + Vite + TypeScript with React Query provider
    - QueryClient with staleTime, gcTime, retry defaults
    - API client (axios) with search and video endpoints
    - _Requirements: 3.1_

  - [x] 8.2 Implement routing and layout
    - BrowserRouter + React Router v6 with lazy-loaded pages
    - Layout with sticky Header, active nav, Footer
    - SearchPage, AboutPage, NotFoundPage
    - _Requirements: 4.2_

  - [x] 8.3 Create TypeScript interfaces and types
    - All API response types (SearchResponse, VideoMetadata, Subtitle etc.)
    - Component prop interfaces (SearchBarProps, AccentFilterProps…)
    - App state, pagination, route param types
    - _Requirements: 3.1_

- [x] 9. Core UI components
  - [x] 9.1 Implement SearchBar component
    - Search input with suggestions dropdown (keyboard navigable)
    - Loading state, disabled state, validation hint
    - ARIA accessibility (aria-expanded, aria-haspopup, role=option)
    - _Requirements: 2.1, 5.1_

  - [x] 9.2 Implement AccentFilter component
    - Radio group with 6 accent buttons and count badges
    - Active styling ring, disabled state, ARIA roles
    - _Requirements: 2.2, 5.2_

  - [x] 9.3 Implement ResultNavigator component
    - Prev/Next buttons with boundary disabling
    - Position counter (1-based display, aria-live)
    - Auto-play toggle switch with ARIA switch role
    - _Requirements: 2.5, 5.4_

  - [x] 9.4 Write unit tests for UI components
    - SearchBar: 11 tests (input, suggestions, keyboard nav, escape, validation)
    - AccentFilter: 6 tests (rendering, selection, counts, disabled, ARIA)
    - ResultNavigator: 12 tests (prev/next, autoplay, boundaries, loading)
    - _Requirements: 2.1, 2.2, 2.5_

- [x] 10. Video player integration
  - [x] 10.1 Implement VideoPlayer component
    - YouTube IFrame API with singleton loader and onYouTubeIframeAPIReady
    - useVideoPlayer hook: time polling (250ms), endTime auto-pause, play/pause/seekTo
    - Loading overlay, hover status bar, aspect-ratio embed
    - _Requirements: 2.3, 3.1_

  - [x] 10.2 Implement SubtitleDisplay component
    - Client-side word highlighting via regex (case-insensitive)
    - Server-provided highlightedText HTML fallback
    - Context before/after display with ARIA live region
    - _Requirements: 2.4_

  - [x] 10.3 Implement continuous playback
    - usePlaybackController hook: goToNext/Prev/goToIndex/handleVideoEnded
    - Auto-advance on video end (if autoPlay enabled), stops at last result
    - Keyboard ← → arrow navigation
    - VideoPlayerPanel composite: wires VideoPlayer + SubtitleDisplay + ResultNavigator
    - _Requirements: 2.5_

  - [x] 10.4 Write integration tests for video player
    - VideoPlayer: 5 tests (loading overlay, region, play/pause button states)
    - SubtitleDisplay: 6 tests (text, highlighting, context, ARIA, HTML fallback)
    - usePlaybackController: 11 tests (navigation, boundaries, autoPlay, reset)
    - _Requirements: 2.3, 2.4_

- [x] 11. Search integration and state management
  - [x] 11.1 Implement search state management
    - useSearchState hook: URL ↔ state sync (q, accent, fuzzy, page params)
    - React Query caching via useSearch, keepPreviousData for smooth UX
    - Pagination (offset-based load-more), clearSearch and submitSearch actions
    - _Requirements: 2.1, 4.1_

  - [x] 11.2 Connect search to video player
    - SearchPage rebuilt with left/right split layout (video | results list)
    - VideoPlayerPanel integrated: clicking a result updates player to that video
    - Active result highlighted, accent filter triggers re-search, error retry
    - _Requirements: 2.1, 2.3, 2.5_

  - [x] 11.3 Implement keyboard shortcuts
    - useKeyboardShortcuts hook: refs-based stable subscriptions
    - Space/k = play/pause, ArrowRight/l = next, ArrowLeft/j = previous
    - Enter inside search input = submit, suppressed when typing elsewhere
    - _Requirements: 4.2_

- [x] 12. Performance optimization
  - [x] 12.1 Implement frontend performance optimizations
    - React.memo wrapping: SearchBar, AccentFilter, ResultNavigator, SubtitleDisplay, VideoPlayer
    - Prevents unnecessary re-renders during time polling and parent state updates
    - useCallback + useRef already applied to all hook callbacks for stable references
    - _Requirements: 4.1, 4.2_

  - [x] 12.2 Implement backend performance optimizations
    - DB migration 002_performance_indexes.sql: 6 PostgreSQL indexes
      (GIN full-text, accent+video composite, video_id, time-range, accent aggregation, partial)
    - cacheHeaders.ts middleware: Cache-Control + Vary headers with presets
      (search 5/10min, suggestions 10/30min, stats 1/2hr, video 30min/1hr)
    - Per-route rate limiters: search 30 req/min, suggestions 60 req/min
    - Global compression + existing rate limiter already in place
    - _Requirements: 4.1_

- [x] 13. Checkpoint - Core functionality complete
  - ✅ Frontend: 51/51 tests pass (2 suites — components.test.tsx, video.test.tsx)
  - ✅ Backend: 270/270 tests pass (16 suites — all services, routes, Redis, Elasticsearch)
  - ✅ TypeScript: frontend clean, backend pre-existing unused-var warnings only
  - ✅ Tasks 1–12 all complete

- [x] 14. Error handling and user experience
  - [x] 14.1 Implement comprehensive error handling
    - `ErrorBoundary` class component: resetKeys auto-recovery, custom fallback prop, onError logging
    - `ApiErrorMessage` component: maps HTTP 400/429/500/503/404 to user-friendly text
    - Root ErrorBoundary wraps entire app in App.tsx
    - VideoPlayer section wrapped in ErrorBoundary with "Reload player" fallback
    - _Requirements: 4.2_

  - [x] 14.2 Implement loading states and feedback
    - `Skeleton.tsx`: Shimmer, SearchResultSkeleton, SearchResultsListSkeleton, VideoPlayerSkeleton, TextSkeleton
    - Skeleton grid (video + 6 results) replaces spinner during initial search
    - `Toast.tsx`: ToastProvider context + useToast hook, success/error/warning/info shortcuts
    - Toast system: slide-in animation, auto-dismiss, ARIA live regions, bottom-right fixed
    - ToastProvider wired into App.tsx alongside ErrorBoundary
    - _Requirements: 4.2_

- [x] 15. Mobile responsiveness
  - [x] 15.1 Implement mobile-first responsive design
    - AccentFilter: horizontal scroll strip on mobile (single row, no wrap)
    - Scrollbar hidden (`-webkit-scrollbar`, `-ms-overflow-style`, `scrollbar-width`) with touch inertia
    - All accent buttons: `min-h-[44px]` WCAG touch target, `shrink-0` to prevent squeezing
    - SearchPage: stacked (single column) on mobile, two-column on `lg:` desktop
    - ResultNavigator: `min-h-[44px]`/`min-w-[44px]` on Prev/Next/AutoPlay buttons, `active:scale-95` tap feedback
    - _Requirements: 4.2_

  - [x] 15.2 Implement mobile-specific features
    - `useSwipe` hook: touchstart/touchend gestures, configurable threshold (50px) and maxVertical (80px)
    - VideoPlayerPanel: swipe left = next result, swipe right = previous result
    - Swipe ignores vertical-dominant drags (page scroll preserved)
    - ResultNavigator: shows "← swipe →" hint on `< md` screens instead of keyboard shortcut hint
    - AccentFilter: shows short value code ("US") on `< xs` screens, full label on wider screens
    - _Requirements: 4.2_

- [x] 16. Final integration and testing
  - [x] 16.1 Implement end-to-end integration
    - All frontend components wired to backend API (`useSearch`, `useSuggestions`)
    - `SearchPage` integrates: SearchBar → AccentFilter → VideoPlayerPanel → ResultNavigator → SubtitleDisplay
    - ErrorBoundary + ToastProvider wrap full app; ApiErrorMessage used in SearchPage error state
    - URL sync (`useSearchState`), keyboard shortcuts (`useKeyboardShortcuts`), swipe gestures (`useSwipe`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x]* 16.2 Write end-to-end tests (`integration.test.tsx` — 33 new tests)
    - 16.2a Accent filter workflow (6 tests): selection, callback, counts, scroll container
    - 16.2b Navigation workflow (4 tests): next/prev chaining, auto-play toggle, swipe hint, boundary disable
    - 16.2c Error handling (8 tests): ErrorBoundary catch + recovery, custom fallback, ApiErrorMessage 400/429/500/404 + retry
    - 16.2d Skeleton loading (4 tests): SearchResultsListSkeleton count, VideoPlayerSkeleton, TextSkeleton lines
    - 16.2e Toast notifications (6 tests): success/error/warning/info render, dismiss, outside-provider throw
    - 16.2f useSwipe hook (5 tests): left/right swipe, threshold, vertical drift, disabled state
    - _Requirements: All user stories_

  - [x] 16.3 Performance testing and optimization
    - Backend: 270/270 tests pass (16 suites) including search, caching, and rate limiter tests
    - Frontend: 84/84 tests pass (3 suites — components, video, integration)
    - Verified: HTTP cache headers on search routes (5/10 min), suggestions (10/30 min), stats (1/2 hr)
    - Verified: Per-route rate limiters (30 req/min search, 60 req/min suggestions)
    - DB migration `002_performance_indexes.sql`: 6 PostgreSQL performance indexes
    - _Requirements: 4.1_

- [x] 17. Final checkpoint - Production readiness
  - ✅ Frontend: 84/84 tests pass (3 suites)
  - ✅ Backend: 270/270 tests pass (16 suites)
  - ✅ TypeScript: frontend clean, backend has only pre-existing unused-var warnings
  - ✅ Tasks 1–16 all complete

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows the three-tier architecture from the design document
- External API integrations include proper error handling and rate limiting
- Performance requirements are addressed throughout the implementation