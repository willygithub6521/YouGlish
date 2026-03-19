import React from 'react';

/**
 * Skeleton loading components — Task 14.2
 *
 * Provides skeleton placeholders that mimic the shape of UI elements
 * to reduce perceived loading time.
 */

// ── Base shimmer tile ─────────────────────────────────────────────
const Shimmer: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100
                bg-[length:200%_100%] rounded ${className}`}
    style={{
      animation: 'shimmer 1.5s ease-in-out infinite',
    }}
    aria-hidden="true"
  />
);

// ── Search result card skeleton ───────────────────────────────────
export const SearchResultSkeleton: React.FC = () => (
  <li className="bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-2">
    {/* Main text line */}
    <Shimmer className="h-4 w-3/4 rounded-md" />
    {/* Context line */}
    <Shimmer className="h-3 w-full rounded-md opacity-60" />
    {/* Video title */}
    <Shimmer className="h-3 w-1/2 rounded-md opacity-40" />
  </li>
);

// ── Search results list skeleton ──────────────────────────────────
export const SearchResultsListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <ul className="space-y-2" aria-label="Loading results…" aria-busy="true">
    {Array.from({ length: count }).map((_, i) => (
      <SearchResultSkeleton key={i} />
    ))}
  </ul>
);

// ── Video player skeleton ─────────────────────────────────────────
export const VideoPlayerSkeleton: React.FC = () => (
  <div className="space-y-3">
    {/* 16:9 video area */}
    <Shimmer className="aspect-video w-full rounded-2xl" />
    {/* Subtitle display */}
    <div className="rounded-xl border border-gray-100 bg-white px-6 py-5 space-y-2">
      <Shimmer className="h-4 w-1/4 rounded-md opacity-40" />
      <Shimmer className="h-5 w-full rounded-md" />
      <Shimmer className="h-5 w-5/6 rounded-md" />
      <Shimmer className="h-3 w-1/3 rounded-md opacity-40" />
    </div>
    {/* Navigator controls */}
    <div className="flex items-center gap-3">
      <Shimmer className="h-9 w-20 rounded-lg" />
      <Shimmer className="h-9 w-16 rounded-md mx-auto" />
      <Shimmer className="h-9 w-20 rounded-lg" />
    </div>
  </div>
);

// ── Inline text skeleton ──────────────────────────────────────────
export const TextSkeleton: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = '',
}) => (
  <div className={`space-y-1.5 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Shimmer
        key={i}
        className={`h-4 rounded-md ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
      />
    ))}
  </div>
);

// Inject the CSS keyframe once
const shimmerStyle =
  typeof document !== 'undefined' &&
  !document.getElementById('shimmer-keyframes');

if (shimmerStyle) {
  const style = document.createElement('style');
  style.id = 'shimmer-keyframes';
  style.textContent = `
    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}

export { Shimmer };
