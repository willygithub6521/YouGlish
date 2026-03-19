import { useEffect, useCallback, useRef } from 'react';

export interface UseKeyboardShortcutsOptions {
  /** Called when Space is pressed (play/pause) */
  onPlayPause?: () => void;
  /** Called when ArrowRight / j is pressed (next result) */
  onNext?: () => void;
  /** Called when ArrowLeft / k is pressed (previous result) */
  onPrevious?: () => void;
  /** Called when Enter is pressed while search input is focused */
  onSearchSubmit?: () => void;
  /** Whether keyboard shortcuts are currently active */
  enabled?: boolean;
}

/**
 * useKeyboardShortcuts — Task 11.3
 *
 * Global keyboard handler that wires:
 *  - Space      → play / pause
 *  - ArrowRight → next result
 *  - ArrowLeft  → previous result
 *  - Enter      → submit search (when search input is focused)
 *
 * Automatically suppresses all shortcuts when the user is typing
 * in an <input>, <textarea>, or [contenteditable] element.
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const { onPlayPause, onNext, onPrevious, onSearchSubmit, enabled = true } = options;

  // Use refs so the effect never needs to re-subscribe when callbacks change
  const onPlayPauseRef = useRef(onPlayPause);
  const onNextRef = useRef(onNext);
  const onPreviousRef = useRef(onPrevious);
  const onSearchSubmitRef = useRef(onSearchSubmit);
  const enabledRef = useRef(enabled);

  useEffect(() => { onPlayPauseRef.current = onPlayPause; }, [onPlayPause]);
  useEffect(() => { onNextRef.current = onNext; }, [onNext]);
  useEffect(() => { onPreviousRef.current = onPrevious; }, [onPrevious]);
  useEffect(() => { onSearchSubmitRef.current = onSearchSubmit; }, [onSearchSubmit]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabledRef.current) return;

    const target = e.target as HTMLElement;
    const isTyping =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    // Enter to submit when inside a search input
    if (e.key === 'Enter' && isTyping) {
      onSearchSubmitRef.current?.();
      return;
    }

    // All other shortcuts only fire when NOT typing
    if (isTyping) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        onPlayPauseRef.current?.();
        break;
      case 'ArrowRight':
      case 'l':
        e.preventDefault();
        onNextRef.current?.();
        break;
      case 'ArrowLeft':
      case 'j':
        e.preventDefault();
        onPreviousRef.current?.();
        break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
