import React from 'react';
import type { ResultNavigatorProps } from '../types/index.js';

const ResultNavigator: React.FC<ResultNavigatorProps> = ({
  currentIndex,
  totalResults,
  onPrevious,
  onNext,
  autoPlay,
  onAutoPlayToggle,
  isLoading = false,
}) => {
  const displayIndex = totalResults === 0 ? 0 : currentIndex + 1;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < totalResults - 1;

  return (
    <nav
      className="flex items-center gap-3 flex-wrap"
      aria-label="Result navigation"
    >
      {/* Previous button — 44px min touch target */}
      <button
        id="nav-previous-btn"
        type="button"
        onClick={onPrevious}
        disabled={!hasPrevious || isLoading}
        aria-label="Previous result"
        className={[
          'flex items-center gap-1.5 px-3 rounded-lg text-sm font-medium transition-all',
          'min-h-[44px] min-w-[44px] justify-center',
          'active:scale-95',
          hasPrevious && !isLoading
            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            : 'bg-gray-50 text-gray-300 cursor-not-allowed',
        ].join(' ')}
      >
        <span aria-hidden="true">◀</span>
        <span className="hidden sm:inline">Prev</span>
      </button>

      {/* Position indicator */}
      <div
        className="flex items-center gap-1.5 text-sm font-mono text-gray-600 min-w-[5rem] justify-center"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`Result ${displayIndex} of ${totalResults}`}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-red-400 rounded-full animate-spin" />
        ) : (
          <>
            <span
              id="nav-current-index"
              className="text-red-600 font-bold text-base"
            >
              {displayIndex}
            </span>
            <span className="text-gray-400">/</span>
            <span id="nav-total-results">{totalResults.toLocaleString()}</span>
          </>
        )}
      </div>

      {/* Next button — 44px min touch target */}
      <button
        id="nav-next-btn"
        type="button"
        onClick={onNext}
        disabled={!hasNext || isLoading}
        aria-label="Next result"
        className={[
          'flex items-center gap-1.5 px-3 rounded-lg text-sm font-medium transition-all',
          'min-h-[44px] min-w-[44px] justify-center',
          'active:scale-95',
          hasNext && !isLoading
            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            : 'bg-gray-50 text-gray-300 cursor-not-allowed',
        ].join(' ')}
      >
        <span className="hidden sm:inline">Next</span>
        <span aria-hidden="true">▶</span>
      </button>

      {/* Divider */}
      <div className="hidden sm:block w-px h-6 bg-gray-200 mx-1" aria-hidden="true" />

      {/* Auto-play toggle — 44px min touch target */}
      <button
        id="nav-autoplay-toggle"
        type="button"
        role="switch"
        aria-checked={autoPlay}
        onClick={() => onAutoPlayToggle(!autoPlay)}
        className={[
          'flex items-center gap-2 px-3 rounded-lg text-sm font-medium transition-all',
          'min-h-[44px] active:scale-95',
          autoPlay
            ? 'bg-red-50 text-red-600 ring-1 ring-red-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        ].join(' ')}
        aria-label={`Auto-play is ${autoPlay ? 'on' : 'off'}`}
      >
        {/* Toggle track */}
        <span
          aria-hidden="true"
          className={[
            'relative inline-flex items-center h-4 w-7 rounded-full transition-colors duration-200',
            autoPlay ? 'bg-red-400' : 'bg-gray-300',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-3 w-3 rounded-full bg-white shadow-sm transform transition-transform duration-200',
              autoPlay ? 'translate-x-3.5' : 'translate-x-0.5',
            ].join(' ')}
          />
        </span>
        Auto-play
      </button>

      {/* Desktop: keyboard hint. Mobile: swipe hint. */}
      {totalResults > 0 && (
        <>
          <span className="hidden md:flex items-center gap-1 text-xs text-gray-400 ml-auto">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">←</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">→</kbd>
            to navigate
          </span>
          <span className="flex md:hidden items-center gap-1 text-xs text-gray-400 ml-auto">
            ← swipe →
          </span>
        </>
      )}
    </nav>
  );
};

export default React.memo(ResultNavigator);
