import { useEffect, useRef, useCallback } from 'react';

interface SwipeOptions {
  /** Minimum horizontal distance (px) to trigger swipe, default 50 */
  threshold?: number;
  /** Maximum vertical drift (px) allowed while swiping, default 80 */
  maxVertical?: number;
  /** Called when user swipes left (next) */
  onSwipeLeft?: () => void;
  /** Called when user swipes right (previous) */
  onSwipeRight?: () => void;
  /** Whether the hook is active */
  enabled?: boolean;
}

/**
 * useSwipe — Task 15.2
 *
 * Attaches touchstart/touchend listeners to a ref element and fires
 * onSwipeLeft / onSwipeRight callbacks for horizontal swipe gestures.
 *
 * Safe: swipes with too much vertical drift are ignored to preserve
 * normal page scrolling.
 *
 * Usage:
 *  const ref = useSwipe({ onSwipeLeft: goToNext, onSwipeRight: goToPrevious });
 *  return <div ref={ref}> … </div>;
 */
function useSwipe<T extends HTMLElement = HTMLElement>({
  threshold = 50,
  maxVertical = 80,
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
}: SwipeOptions = {}): React.RefObject<T> {
  const ref = useRef<T>(null);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    const t = e.changedTouches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
  }, [enabled]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled || startX.current === null || startY.current === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX.current;
    const dy = Math.abs(t.clientY - startY.current);
    startX.current = null;
    startY.current = null;

    if (dy > maxVertical) return; // too much vertical movement — user is scrolling
    if (Math.abs(dx) < threshold) return; // not far enough

    if (dx < 0) {
      onSwipeLeft?.();
    } else {
      onSwipeRight?.();
    }
  }, [enabled, threshold, maxVertical, onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd, enabled]);

  return ref;
}

export default useSwipe;
