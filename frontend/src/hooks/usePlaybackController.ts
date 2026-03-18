import { useState, useCallback, useEffect, useRef } from 'react';
import type { SearchResult } from '../types/index.js';

export interface UsePlaybackControllerOptions {
  results: SearchResult[];
  autoPlay?: boolean;
  onIndexChange?: (index: number) => void;
}

export interface UsePlaybackControllerReturn {
  currentIndex: number;
  currentResult: SearchResult | null;
  autoPlay: boolean;
  setAutoPlay: (enabled: boolean) => void;
  goToNext: () => void;
  goToPrevious: () => void;
  goToIndex: (index: number) => void;
  handleVideoEnded: () => void;
}

/**
 * usePlaybackController — manages result navigation and auto-play (Task 10.3)
 *
 * Uses refs for all values that callbacks need to read "live" so that
 * useCallback deps stay stable and closures never go stale.
 */
export function usePlaybackController(
  options: UsePlaybackControllerOptions
): UsePlaybackControllerReturn {
  const { results, autoPlay: initialAutoPlay = false, onIndexChange } = options;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlay, setAutoPlayState] = useState(initialAutoPlay);

  // ── Live refs (never stale) ────────────────────────────────
  const resultsLengthRef = useRef(results.length);
  const autoPlayRef = useRef(autoPlay);
  const onIndexChangeRef = useRef(onIndexChange);

  useEffect(() => { resultsLengthRef.current = results.length; }, [results.length]);
  useEffect(() => { autoPlayRef.current = autoPlay; }, [autoPlay]);
  useEffect(() => { onIndexChangeRef.current = onIndexChange; }, [onIndexChange]);

  // Reset position when results change (use length as a proxy since
  // callers often pass new array literals on each render)
  const prevLengthRef = useRef(results.length);
  useEffect(() => {
    if (prevLengthRef.current !== results.length) {
      prevLengthRef.current = results.length;
      setCurrentIndex(0);
      onIndexChangeRef.current?.(0);
    }
  }, [results.length]);

  // ── Navigation callbacks (stable – only use refs inside) ───
  const goToIndex = useCallback((index: number) => {
    const len = resultsLengthRef.current;
    if (len === 0) return;
    const clamped = Math.max(0, Math.min(index, len - 1));
    setCurrentIndex(clamped);
    onIndexChangeRef.current?.(clamped);
  }, []);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const len = resultsLengthRef.current;
      if (prev >= len - 1) return prev;
      const next = prev + 1;
      onIndexChangeRef.current?.(next);
      return next;
    });
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev <= 0) return 0;
      const next = prev - 1;
      onIndexChangeRef.current?.(next);
      return next;
    });
  }, []);

  /**
   * Called by VideoPlayer onEnded — advances to next result if autoPlay on.
   * Stops at last result (no wrap-around).
   */
  const handleVideoEnded = useCallback(() => {
    if (!autoPlayRef.current) return;
    setCurrentIndex((prev) => {
      const len = resultsLengthRef.current;
      if (prev >= len - 1) return prev;
      const next = prev + 1;
      onIndexChangeRef.current?.(next);
      return next;
    });
  }, []);

  // ── Keyboard: ← → for navigation ─────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') goToNext();
      else if (e.key === 'ArrowLeft') goToPrevious();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goToNext, goToPrevious]);

  const setAutoPlay = useCallback((enabled: boolean) => {
    setAutoPlayState(enabled);
  }, []);

  const currentResult = results[currentIndex] ?? null;

  return {
    currentIndex,
    currentResult,
    autoPlay,
    setAutoPlay,
    goToNext,
    goToPrevious,
    goToIndex,
    handleVideoEnded,
  };
}
