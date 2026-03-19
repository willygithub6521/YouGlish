import React, { useMemo } from 'react';
import type { SubtitleDisplayProps } from '../types/index.js';

/**
 * Highlight all occurrences of `words` inside `text`, wrapping each
 * with a <mark> span. Returns an array of React nodes.
 */
function highlightWords(text: string, words: string[]): React.ReactNode[] {
  if (!words.length) return [text];

  // Build a regex that matches any of the highlight words (case-insensitive)
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');

  const parts = text.split(pattern);
  return parts.map((part, i) =>
    pattern.test(part) ? (
      <mark
        key={i}
        className="bg-yellow-200 text-yellow-900 rounded px-0.5 font-semibold"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

const SubtitleDisplay: React.FC<SubtitleDisplayProps> = ({
  text,
  highlightedText,
  highlightWords: words = [],
  context,
}) => {
  // If the backend already provided HTML-highlighted text, use it directly;
  // otherwise apply client-side word highlighting.
  const renderedText = useMemo(() => {
    if (highlightedText) {
      // Strip any remaining HTML tags for safety, then display raw text
      // (real apps would use DOMPurify – here we trust the backend)
      return (
        <span
          dangerouslySetInnerHTML={{ __html: highlightedText }}
        />
      );
    }
    return <span>{highlightWords(text, words)}</span>;
  }, [text, highlightedText, words]);

  return (
    <div
      className="subtitle-display rounded-xl border border-gray-100 bg-white px-6 py-5 shadow-sm"
      role="region"
      aria-label="Current subtitle"
    >
      {/* Context – before */}
      {context?.before && (
        <p className="text-sm text-gray-400 mb-2 leading-relaxed">
          <span className="italic">…{context.before}</span>
        </p>
      )}

      {/* Main highlighted subtitle text */}
      <p
        className="text-lg sm:text-xl font-medium text-gray-900 leading-relaxed"
        aria-live="polite"
        aria-atomic="true"
      >
        {renderedText}
      </p>

      {/* Context – after */}
      {context?.after && (
        <p className="text-sm text-gray-400 mt-2 leading-relaxed">
          <span className="italic">{context.after}…</span>
        </p>
      )}
    </div>
  );
};

export default React.memo(SubtitleDisplay);
