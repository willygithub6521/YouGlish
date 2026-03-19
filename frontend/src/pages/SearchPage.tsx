import React, { useCallback, useRef } from 'react';
import type { Accent } from '../types/index.js';
import { useSearchState } from '../hooks/useSearchState.js';
import { usePlaybackController } from '../hooks/usePlaybackController.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import VideoPlayerPanel from '../components/VideoPlayerPanel.js';
import SearchBar from '../components/SearchBar.js';
import AccentFilter from '../components/AccentFilter.js';
import ApiErrorMessage from '../components/ApiErrorMessage.js';
import { SearchResultsListSkeleton, VideoPlayerSkeleton } from '../components/Skeleton.js';
import ErrorBoundary from '../components/ErrorBoundary.js';

// ── Accents ─────────────────────────────────────────────────────
const ACCENTS: Accent[] = ['ALL', 'US', 'UK', 'AU', 'CA', 'OTHER'];

const SearchPage: React.FC = () => {
  // ── Search state + URL sync (11.1) ────────────────────────────
  const {
    inputValue,
    selectedAccent,
    fuzzy,
    activeQuery,
    results,
    total,
    accentCounts,
    isLoading,
    isError,
    error,
    isFetching,
    setSelectedAccent,
    setFuzzy,
    submitSearch,
    clearSearch,
    loadMore,
    hasMore,
  } = useSearchState();

  // ── Video + navigation state (11.2) ──────────────────────────
  const {
    currentIndex,
    goToNext,
    goToPrevious,
    goToIndex,
  } = usePlaybackController({ results });

  // Track the play/pause function from VideoPlayer
  // (We lift it through a ref so keyboard shortcut can call it)
  const playPauseFnRef = useRef<(() => void) | null>(null);

  const handlePlayPause = useCallback(() => {
    playPauseFnRef.current?.();
  }, []);

  // ── Keyboard shortcuts (11.3) ─────────────────────────────────
  useKeyboardShortcuts({
    onPlayPause: handlePlayPause,
    onNext: goToNext,
    onPrevious: goToPrevious,
    onSearchSubmit: submitSearch,
    enabled: true,
  });

  // Build accent counts for AccentFilter
  const accentCountsFull = Object.fromEntries(
    ACCENTS.map((a) => [a, accentCounts[a] ?? 0])
  ) as Record<Accent, number>;

  const showPlayer = results.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── Hero (only visible before first search) ───────────── */}
      {!activeQuery && (
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            Hear every word in context
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Search English words and phrases to hear their pronunciation in
            authentic YouTube videos — filtered by accent.
          </p>
        </div>
      )}

      {/* ── Search bar (11.1) ─────────────────────────────────── */}
      <div className="mb-4">
        <SearchBar
          initialQuery={inputValue}
          onSearch={(query) => submitSearch(query)}
          isLoading={isLoading}
          placeholder="e.g. pronunciation, definitely, schedule…"
        />
      </div>

      {/* ── Accent filter + fuzzy toggle ──────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <AccentFilter
          selectedAccent={selectedAccent}
          onAccentChange={(accent) => {
            setSelectedAccent(accent);
            if (activeQuery) submitSearch();
          }}
          resultCounts={accentCountsFull}
          disabled={isLoading}
        />

        <label className="flex items-center gap-2 cursor-pointer ml-auto" htmlFor="fuzzy-toggle">
          <input
            id="fuzzy-toggle"
            type="checkbox"
            checked={fuzzy}
            onChange={(e) => setFuzzy(e.target.checked)}
            className="w-4 h-4 accent-red-500 cursor-pointer"
          />
          <span className="text-sm text-gray-600">Fuzzy match</span>
        </label>
      </div>

      {/* ── Error state ───────────────────────────────────────── */}
      {isError && (
        <div id="search-error" className="mb-6">
          <ApiErrorMessage
            error={error}
            context={`Search for "${activeQuery}"`}
            onRetry={() => submitSearch()}
          />
        </div>
      )}

      {/* ── Main content: player + results list ───────────────── */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: video player wrapped in ErrorBoundary */}
          <div className="lg:sticky top-6 self-start">
            <ErrorBoundary
              fallback={({ reset }) => (
                <div className="rounded-2xl bg-gray-50 border border-gray-200 p-8 text-center">
                  <p className="text-2xl mb-3">🎬</p>
                  <p className="text-sm text-gray-600 mb-4">Video player encountered an error.</p>
                  <button
                    type="button"
                    onClick={reset}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                  >
                    Reload player
                  </button>
                </div>
              )}
            >
              <VideoPlayerPanel
                results={results}
                query={activeQuery}
                isVisible={showPlayer}
              />
            </ErrorBoundary>
          </div>

          {/* Right: results list */}
          <div>
            {/* Summary bar */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-800">{total}</span>{' '}
                result{total !== 1 ? 's' : ''} for{' '}
                <strong className="text-red-600">"{activeQuery}"</strong>
              </p>
              {isFetching && !isLoading && (
                <span className="text-xs text-gray-400 animate-pulse">Updating…</span>
              )}
              {activeQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-xs text-gray-400 hover:text-gray-700 underline"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Results list */}
            <ul className="space-y-2" id="search-results" role="list">
              {results.map((result, i) => {
                const isActive = i === currentIndex;
                return (
                  <li
                    key={result.id ?? i}
                    id={`result-${i}`}
                    role="listitem"
                    onClick={() => goToIndex(i)}
                    className={[
                      'group rounded-xl px-4 py-3 border cursor-pointer transition-all',
                      isActive
                        ? 'bg-red-50 border-red-300 shadow-sm'
                        : 'bg-white border-gray-100 hover:border-red-200 hover:shadow-sm',
                    ].join(' ')}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* ▶ icon + text */}
                      <div className="flex items-start gap-2 min-w-0">
                        <span
                          className={[
                            'mt-0.5 shrink-0 text-xs',
                            isActive ? 'text-red-500' : 'text-transparent group-hover:text-gray-300',
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          ▶
                        </span>
                        <p className="text-gray-800 text-sm leading-relaxed min-w-0">
                          {result.context?.before && (
                            <span className="text-gray-400 text-xs">…{result.context.before} </span>
                          )}
                          <span
                            dangerouslySetInnerHTML={{
                              __html: result.highlightedText ?? result.text,
                            }}
                          />
                          {result.context?.after && (
                            <span className="text-gray-400 text-xs"> {result.context.after}…</span>
                          )}
                        </p>
                      </div>
                      {/* Accent badge */}
                      <span className="shrink-0 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-md font-mono">
                        {result.accent}
                      </span>
                    </div>

                    {/* Video title */}
                    {result.videoTitle && (
                      <p className="text-xs text-gray-400 mt-1.5 truncate pl-5">
                        📹 {result.videoTitle}
                        {result.channelName && <> · {result.channelName}</>}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Load more */}
            {hasMore && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  id="load-more-btn"
                  onClick={loadMore}
                  disabled={isFetching}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700
                             text-sm font-medium rounded-xl transition-colors"
                >
                  {isFetching ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Skeleton loading (initial search) ───────────────────── */}
      {isLoading && results.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VideoPlayerSkeleton />
          <SearchResultsListSkeleton count={6} />
        </div>
      )}

      {/* ── No results ────────────────────────────────────────── */}
      {!isLoading && activeQuery && results.length === 0 && !isError && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-lg">No results found for "{activeQuery}"</p>
          <p className="text-sm mt-2">Try a different word, accent, or disable fuzzy matching.</p>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!activeQuery && !isLoading && (
        <div className="text-center py-16 text-gray-300">
          <p className="text-6xl mb-4">🎙️</p>
          <p className="text-xl text-gray-400">Enter a word or phrase to begin</p>
          <p className="text-sm text-gray-300 mt-2">
            Tip: Use{' '}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-xs">Space</kbd>{' '}
            to play/pause,{' '}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-xs">←</kbd>{' '}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-xs">→</kbd>{' '}
            to navigate results
          </p>
        </div>
      )}

      {/* ── Keyboard shortcut hint (while viewing results) ────── */}
      {results.length > 0 && (
        <p className="mt-6 text-center text-xs text-gray-300">
          <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono">Space</kbd> play/pause ·{' '}
          <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono">←</kbd>{' '}
          <kbd className="px-1 py-0.5 bg-gray-100 rounded font-mono">→</kbd> navigate results
        </p>
      )}
    </div>
  );
};

export default SearchPage;
