import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Accent, SearchParams, SearchResult } from '../types/index.js';
import { useSearch } from './useSearch.js';

// ── Types ─────────────────────────────────────────────────────
export interface SearchState {
  /** Current raw input value (controlled) */
  inputValue: string;
  /** Accent filter currently selected in the UI */
  selectedAccent: Accent;
  /** Whether fuzzy matching is enabled */
  fuzzy: boolean;
  /** Active query committed to the URL / data layer */
  activeQuery: string;
  /** Active accent committed to the URL */
  activeAccent: Accent;
}

export interface UseSearchStateReturn {
  // ── Form state ──
  inputValue: string;
  selectedAccent: Accent;
  fuzzy: boolean;
  // ── Committed query ──
  activeQuery: string;
  activeAccent: Accent;
  // ── Data ──
  results: SearchResult[];
  total: number;
  accentCounts: Partial<Record<Accent, number>>;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  // ── Actions ──
  setInputValue: (value: string) => void;
  setSelectedAccent: (accent: Accent) => void;
  setFuzzy: (fuzzy: boolean) => void;
  submitSearch: (query?: string) => void;
  clearSearch: () => void;
  loadMore: () => void;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

/**
 * useSearchState — Task 11.1
 *
 * Single hook owning all search concerns:
 *  - URL ↔ state synchronisation (q, accent, fuzzy, page via URLSearchParams)
 *  - React Query data fetching with caching and keepPreviousData
 *  - Pagination (offset-based "load more")
 *  - Exposes clean setter actions to the UI
 */
export function useSearchState(): UseSearchStateReturn {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Derive committed state from URL ────────────────────────
  const activeQuery = searchParams.get('q') ?? '';
  const activeAccent = (searchParams.get('accent') as Accent) ?? 'ALL';
  const activeFuzzy = searchParams.get('fuzzy') !== 'false';
  const activePage = Number(searchParams.get('page') ?? '0');

  // ── Local controlled state (before commit) ─────────────────
  const [inputValue, setInputValue] = useState(activeQuery);
  const [selectedAccent, setSelectedAccent] = useState<Accent>(activeAccent);
  const [fuzzy, setFuzzy] = useState(activeFuzzy);

  // Keep local input in sync when URL changes externally (e.g. back/forward)
  useEffect(() => {
    setInputValue(activeQuery);
    setSelectedAccent(activeAccent);
    setFuzzy(activeFuzzy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuery, activeAccent]);

  // ── Build query params ──────────────────────────────────────
  const queryParams: SearchParams | null =
    activeQuery.trim().length >= 2
      ? {
          query: activeQuery,
          accent: activeAccent,
          fuzzy: activeFuzzy,
          limit: PAGE_SIZE,
          offset: activePage * PAGE_SIZE,
        }
      : null;

  const { data, isLoading, isError, error, isFetching } = useSearch(queryParams);

  // ── Actions ─────────────────────────────────────────────────
  const submitSearch = useCallback(
    (query?: string) => {
      const q = (query ?? inputValue).trim();
      if (!q) return;
      setSearchParams({
        q,
        accent: selectedAccent,
        fuzzy: String(fuzzy),
        page: '0',
      });
    },
    [inputValue, selectedAccent, fuzzy, setSearchParams]
  );

  const clearSearch = useCallback(() => {
    setInputValue('');
    setSearchParams({});
  }, [setSearchParams]);

  const loadMore = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(activePage + 1));
      return next;
    });
  }, [activePage, setSearchParams]);

  const hasMore =
    !!data && data.total > PAGE_SIZE * (activePage + 1);

  return {
    // form state
    inputValue,
    selectedAccent,
    fuzzy,
    // committed
    activeQuery,
    activeAccent,
    // data
    results: data?.results ?? [],
    total: data?.total ?? 0,
    accentCounts: data?.accentCounts ?? {},
    isLoading,
    isError,
    error,
    isFetching,
    // actions
    setInputValue,
    setSelectedAccent,
    setFuzzy,
    submitSearch,
    clearSearch,
    loadMore,
    hasMore,
  };
}
