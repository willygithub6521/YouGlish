import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Accent, SearchParams, SearchResult } from '../types/index.js';
import { useSearch } from '../hooks/useSearch.js';

// ─── Search form ─────────────────────────────────────────────────
const ACCENTS: { value: Accent; label: string; flag: string }[] = [
  { value: 'ALL', label: 'All', flag: '🌍' },
  { value: 'US', label: 'American', flag: '🇺🇸' },
  { value: 'UK', label: 'British', flag: '🇬🇧' },
  { value: 'AU', label: 'Australian', flag: '🇦🇺' },
  { value: 'CA', label: 'Canadian', flag: '🇨🇦' },
  { value: 'OTHER', label: 'Other', flag: '🌐' },
];

const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '');
  const [selectedAccent, setSelectedAccent] = useState<Accent>(
    (searchParams.get('accent') as Accent) ?? 'ALL'
  );
  const [fuzzy, setFuzzy] = useState(searchParams.get('fuzzy') !== 'false');

  // Build query from URL params
  const activeQuery = searchParams.get('q') ?? '';
  const activeAccent = (searchParams.get('accent') as Accent) ?? 'ALL';
  const activeFuzzy = searchParams.get('fuzzy') !== 'false';

  const queryParams: SearchParams | null = activeQuery.trim().length >= 2
    ? { query: activeQuery, accent: activeAccent, fuzzy: activeFuzzy, limit: 20, offset: 0 }
    : null;

  const { data, isLoading, isError, error } = useSearch(queryParams);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setSearchParams({ q: inputValue.trim(), accent: selectedAccent, fuzzy: String(fuzzy) });
  }, [inputValue, selectedAccent, fuzzy, setSearchParams]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
          Hear every word in context
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto">
          Search English words and phrases to hear their pronunciation in authentic YouTube videos — filtered by accent.
        </p>
      </div>

      {/* Search form */}
      <form
        onSubmit={handleSearch}
        id="search-form"
        className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-8"
      >
        {/* Input row */}
        <div className="flex gap-3 mb-5">
          <input
            id="search-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="e.g. pronunciation, definitely, schedule…"
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent text-lg transition"
            autoFocus
          />
          <button
            id="search-submit"
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed
                       text-white font-semibold rounded-xl transition-colors text-lg shadow-sm"
          >
            {isLoading ? '…' : 'Search'}
          </button>
        </div>

        {/* Options row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Accent filter */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Accent filter">
            {ACCENTS.map(({ value, label, flag }) => (
              <button
                key={value}
                type="button"
                id={`accent-${value.toLowerCase()}`}
                onClick={() => setSelectedAccent(value)}
                className={[
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  selectedAccent === value
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                ].join(' ')}
              >
                {flag} {label}
                {data?.accentCounts?.[value] !== undefined && (
                  <span className="ml-1 text-xs opacity-70">({data.accentCounts[value]})</span>
                )}
              </button>
            ))}
          </div>

          {/* Fuzzy toggle */}
          <label className="flex items-center gap-2 cursor-pointer ml-auto">
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
      </form>

      {/* Results */}
      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-6 text-red-700 text-center">
          <p className="font-semibold mb-1">Search failed</p>
          <p className="text-sm opacity-80">{(error as any)?.message ?? 'Please try again.'}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-red-200 border-t-red-500 rounded-full animate-spin" />
        </div>
      )}

      {data && !isLoading && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {data.total} result{data.total !== 1 ? 's' : ''} for{' '}
            <strong className="text-gray-800">"{data.query}"</strong>
            {data.accent !== 'ALL' && <> in <strong>{data.accent}</strong> accent</>}
          </p>

          {data.results.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-lg">No results found. Try a different word or accent.</p>
            </div>
          ) : (
            <ul className="space-y-3" id="search-results">
              {data.results.map((result: SearchResult, i: number) => (
                <li
                  key={result.id ?? i}
                  className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {result.context?.before && (
                        <span className="text-gray-400 text-sm">…{result.context.before} </span>
                      )}
                      <span
                        className="text-gray-900 font-medium"
                        dangerouslySetInnerHTML={{
                          __html: result.highlightedText ?? result.text,
                        }}
                      />
                      {result.context?.after && (
                        <span className="text-gray-400 text-sm"> {result.context.after}…</span>
                      )}
                    </div>
                    <span className="shrink-0 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg font-mono">
                      {result.accent}
                    </span>
                  </div>
                  {result.videoTitle && (
                    <p className="text-xs text-gray-400 mt-2 truncate">
                      📹 {result.videoTitle}
                      {result.channelName && <> · {result.channelName}</>}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Empty state  */}
      {!data && !isLoading && !isError && (
        <div className="text-center py-16 text-gray-300">
          <p className="text-6xl mb-4">🎙️</p>
          <p className="text-xl text-gray-400">Enter a word or phrase to begin</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
