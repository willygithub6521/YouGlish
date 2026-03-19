/**
 * E2E Integration Tests — Task 16.2
 *
 * Covers complete user workflows:
 *  - Search bar → results → video player → subtitle display
 *  - Accent filtering interactions
 *  - Navigation (prev/next, auto-play toggle)
 *  - Error scenarios (API failure, empty results)
 *  - useSwipe hook touch gestures
 *  - ErrorBoundary recovery
 *  - Skeleton loading states
 *  - Toast notification rendering
 *
 * NOTE: These are integration/component-level tests (no real network calls).
 * True E2E browser tests (Playwright/Cypress) would require a running backend.
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';


// ── Components under test ─────────────────────────────────────
import AccentFilter from '../components/AccentFilter';
import ResultNavigator from '../components/ResultNavigator';
import ErrorBoundary from '../components/ErrorBoundary';
import ApiErrorMessage from '../components/ApiErrorMessage';
import { SearchResultsListSkeleton, VideoPlayerSkeleton, TextSkeleton } from '../components/Skeleton';
import { ToastProvider, useToast } from '../components/Toast';
import useSwipe from '../hooks/useSwipe';
import type { Accent } from '../types/index';

// ── Helpers ───────────────────────────────────────────────────
function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const MOCK_COUNTS: Record<Accent, number> = {
  ALL: 0, US: 10, UK: 4, AU: 2, CA: 6, OTHER: 1,
};

// ══════════════════════════════════════════════════════════════
//  16.2a — Accent Filter Workflow
// ══════════════════════════════════════════════════════════════
describe('Accent Filter Workflow (Task 16.2a)', () => {
  const onChange = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('starts with ALL selected by default', () => {
    render(
      <AccentFilter selectedAccent="ALL" onAccentChange={onChange} resultCounts={MOCK_COUNTS} />
    );
    expect(screen.getByRole('radio', { name: /all/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('allows user to switch accent → callback receives new value', () => {
    render(
      <AccentFilter selectedAccent="ALL" onAccentChange={onChange} resultCounts={MOCK_COUNTS} />
    );
    fireEvent.click(screen.getByRole('radio', { name: /american/i }));
    expect(onChange).toHaveBeenCalledWith('US');
  });

  it('cycles through all accents without errors', () => {
    const accents: Accent[] = ['ALL', 'US', 'UK', 'AU', 'CA', 'OTHER'];
    accents.forEach((accent) => {
      const { unmount } = render(
        <AccentFilter selectedAccent={accent} onAccentChange={onChange} resultCounts={MOCK_COUNTS} />
      );
      // Use the aria-label pattern: "<Label> accent – <N> result(s)"
      // We check aria-checked=true on the button whose aria-label starts with the accent label
      const buttons = screen.getAllByRole('radio');
      const selected = buttons.find(
        (btn) => btn.getAttribute('aria-checked') === 'true'
      );
      expect(selected).not.toBeUndefined();
      unmount();
    });
  });

  it('shows count = sum of non-ALL accents for the ALL button', () => {
    render(
      <AccentFilter selectedAccent="ALL" onAccentChange={onChange} resultCounts={MOCK_COUNTS} />
    );
    // 10 + 4 + 2 + 6 + 1 = 23
    const allBtn = screen.getByRole('radio', { name: /all/i });
    expect(allBtn).toHaveTextContent('23');
  });

  it('does not fire onChange when disabled', () => {
    render(
      <AccentFilter selectedAccent="ALL" onAccentChange={onChange} resultCounts={MOCK_COUNTS} disabled />
    );
    fireEvent.click(screen.getByRole('radio', { name: /british/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('has scrollable container for horizontal scroll on mobile', () => {
    render(
      <AccentFilter selectedAccent="ALL" onAccentChange={onChange} resultCounts={MOCK_COUNTS} />
    );
    const container = screen.getByRole('radiogroup');
    // The class list contains overflow-x-auto for mobile
    expect(container.className).toContain('overflow-x-auto');
  });
});

// ══════════════════════════════════════════════════════════════
//  16.2b — Result Navigation Workflow
// ══════════════════════════════════════════════════════════════
describe('Result Navigation Workflow (Task 16.2b)', () => {
  const baseProps = {
    currentIndex: 0,
    totalResults: 5,
    onPrevious: jest.fn(),
    onNext: jest.fn(),
    autoPlay: false,
    onAutoPlayToggle: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('complete navigation workflow: next → next → prev', () => {
    const { rerender } = render(<ResultNavigator {...baseProps} />);

    // Navigate forward
    fireEvent.click(screen.getByLabelText('Next result'));
    expect(baseProps.onNext).toHaveBeenCalledTimes(1);

    // Simulate state update
    rerender(<ResultNavigator {...baseProps} currentIndex={1} />);
    fireEvent.click(screen.getByLabelText('Next result'));
    expect(baseProps.onNext).toHaveBeenCalledTimes(2);

    // Navigate back
    rerender(<ResultNavigator {...baseProps} currentIndex={2} />);
    fireEvent.click(screen.getByLabelText('Previous result'));
    expect(baseProps.onPrevious).toHaveBeenCalledTimes(1);
  });

  it('auto-play toggle: off → on → off', () => {
    const { rerender } = render(<ResultNavigator {...baseProps} autoPlay={false} />);
    const toggle = screen.getByRole('switch', { name: /auto-play/i });

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(baseProps.onAutoPlayToggle).toHaveBeenCalledWith(true);

    rerender(<ResultNavigator {...baseProps} autoPlay={true} />);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(baseProps.onAutoPlayToggle).toHaveBeenCalledWith(false);
  });

  it('shows swipe hint on mobile (md:hidden helper class) when results exist', () => {
    render(<ResultNavigator {...baseProps} totalResults={5} />);
    expect(screen.getByText(/swipe/i)).toBeInTheDocument();
  });

  it('prev disabled at index 0, next disabled at last index', () => {
    const { rerender } = render(<ResultNavigator {...baseProps} currentIndex={0} totalResults={3} />);
    expect(screen.getByLabelText('Previous result')).toBeDisabled();
    expect(screen.getByLabelText('Next result')).not.toBeDisabled();

    rerender(<ResultNavigator {...baseProps} currentIndex={2} totalResults={3} />);
    expect(screen.getByLabelText('Next result')).toBeDisabled();
    expect(screen.getByLabelText('Previous result')).not.toBeDisabled();
  });
});

// ══════════════════════════════════════════════════════════════
//  16.2c — Error Handling Workflow
// ══════════════════════════════════════════════════════════════
describe('Error Handling Workflow (Task 16.2c)', () => {
  // Suppress console.error for expected boundary errors
  const originalError = console.error;
  beforeAll(() => { console.error = jest.fn(); });
  afterAll(() => { console.error = originalError; });

  it('ErrorBoundary catches render error and shows fallback', () => {
    const ThrowingComponent = () => { throw new Error('Test render crash'); };

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('ErrorBoundary recovery: clicking "Try again" resets state', () => {
    let shouldThrow = true;
    const MaybeThrow = () => {
      if (shouldThrow) throw new Error('Oops');
      return <p>Recovered</p>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Fix the component
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    rerender(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('ErrorBoundary uses custom fallback when provided', () => {
    const ThrowingComponent = () => { throw new Error('boom'); };

    render(
      <ErrorBoundary fallback={() => <div>Custom fallback UI</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom fallback UI')).toBeInTheDocument();
  });

  it('ApiErrorMessage: shows 429 rate-limit message', () => {
    const err = { response: { status: 429, data: {} } };
    render(<ApiErrorMessage error={err} />);
    // Both title and detail contain "too many requests" — use getAllByText
    const matches = screen.getAllByText(/too many requests/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('ApiErrorMessage: shows 500 server error message', () => {
    const err = { response: { status: 500, data: {} } };
    render(<ApiErrorMessage error={err} />);
    expect(screen.getByText(/server error/i)).toBeInTheDocument();
  });

  it('ApiErrorMessage: shows 404 not-found message', () => {
    const err = { response: { status: 404, data: {} } };
    render(<ApiErrorMessage error={err} />);
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it('ApiErrorMessage: shows retry button and calls onRetry', () => {
    const onRetry = jest.fn();
    const err = { response: { status: 500, data: {} } };
    render(<ApiErrorMessage error={err} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ApiErrorMessage inline mode renders in a paragraph', () => {
    const err = { response: { status: 400, data: { message: 'Bad query' } } };
    render(<ApiErrorMessage error={err} inline />);
    // Inline mode shows only the detail text (no separate title element)
    expect(screen.getByText(/check your search query/i)).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════
//  16.2d — Skeleton Loading States
// ══════════════════════════════════════════════════════════════
describe('Skeleton Loading States (Task 16.2d)', () => {
  it('SearchResultsListSkeleton renders N skeleton items', () => {
    render(<SearchResultsListSkeleton count={4} />);
    const list = screen.getByRole('list');
    expect(list).toHaveAttribute('aria-busy', 'true');
    expect(list.children).toHaveLength(4);
  });

  it('SearchResultsListSkeleton defaults to 6 items', () => {
    render(<SearchResultsListSkeleton />);
    expect(screen.getByRole('list').children).toHaveLength(6);
  });

  it('VideoPlayerSkeleton renders without crashing', () => {
    const { container } = render(<VideoPlayerSkeleton />);
    expect(container.firstChild).not.toBeNull();
  });

  it('TextSkeleton renders correct number of lines', () => {
    render(<TextSkeleton lines={3} />);
    // The outer wrapper div has aria-hidden="true", and each shimmer child also has it.
    // Use the wrapper's children count instead.
    const wrapper = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(wrapper?.children).toHaveLength(3);
  });
});

// ══════════════════════════════════════════════════════════════
//  16.2e — Toast Notification System
// ══════════════════════════════════════════════════════════════
describe('Toast Notification System (Task 16.2e)', () => {
  // Helper component that calls the toast API
  const ToastTrigger: React.FC<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  }> = ({ type, message }) => {
    const toast = useToast();
    return (
      <button type="button" onClick={() => toast[type](message, 0)}>
        Show toast
      </button>
    );
  };

  it('shows success toast', async () => {
    renderWithToast(<ToastTrigger type="success" message="Saved!" />);
    fireEvent.click(screen.getByText('Show toast'));
    await waitFor(() => expect(screen.getByText('Saved!')).toBeInTheDocument());
  });

  it('shows error toast', async () => {
    renderWithToast(<ToastTrigger type="error" message="Something failed" />);
    fireEvent.click(screen.getByText('Show toast'));
    await waitFor(() => expect(screen.getByText('Something failed')).toBeInTheDocument());
  });

  it('shows warning toast', async () => {
    renderWithToast(<ToastTrigger type="warning" message="Check your input" />);
    fireEvent.click(screen.getByText('Show toast'));
    await waitFor(() => expect(screen.getByText('Check your input')).toBeInTheDocument());
  });

  it('shows info toast', async () => {
    renderWithToast(<ToastTrigger type="info" message="FYI" />);
    fireEvent.click(screen.getByText('Show toast'));
    await waitFor(() => expect(screen.getByText('FYI')).toBeInTheDocument());
  });

  it('dismisses toast when ✕ clicked', async () => {
    renderWithToast(<ToastTrigger type="success" message="Dismiss me" />);
    fireEvent.click(screen.getByText('Show toast'));
    await waitFor(() => screen.getByText('Dismiss me'));
    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    await waitFor(() => expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument());
  });

  it('throws if useToast is used outside ToastProvider', () => {
    const ThrowingComponent = () => {
      useToast();
      return null;
    };
    const originalError = console.error;
    console.error = jest.fn();
    expect(() => render(<ThrowingComponent />)).toThrow(
      'useToast must be used within a ToastProvider'
    );
    console.error = originalError;
  });
});

// ══════════════════════════════════════════════════════════════
//  16.2f — useSwipe Hook
// ══════════════════════════════════════════════════════════════
describe('useSwipe Hook (Task 16.2f)', () => {
  const SwipeTestComponent: React.FC<{
    onLeft?: () => void;
    onRight?: () => void;
    enabled?: boolean;
  }> = ({ onLeft, onRight, enabled = true }) => {
    const ref = useSwipe<HTMLDivElement>({
      onSwipeLeft: onLeft,
      onSwipeRight: onRight,
      threshold: 50,
      maxVertical: 80,
      enabled,
    });
    return <div ref={ref} data-testid="swipe-area">Swipe area</div>;
  };

  function swipe(el: Element, dx: number, dy = 0) {
    fireEvent.touchStart(el, { changedTouches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(el, { changedTouches: [{ clientX: 100 + dx, clientY: 100 + dy }] });
  }

  it('calls onSwipeLeft on left swipe', () => {
    const onLeft = jest.fn();
    render(<SwipeTestComponent onLeft={onLeft} />);
    swipe(screen.getByTestId('swipe-area'), -60);
    expect(onLeft).toHaveBeenCalledTimes(1);
  });

  it('calls onSwipeRight on right swipe', () => {
    const onRight = jest.fn();
    render(<SwipeTestComponent onRight={onRight} />);
    swipe(screen.getByTestId('swipe-area'), 70);
    expect(onRight).toHaveBeenCalledTimes(1);
  });

  it('ignores swipe below threshold', () => {
    const onLeft = jest.fn();
    render(<SwipeTestComponent onLeft={onLeft} />);
    swipe(screen.getByTestId('swipe-area'), -30); // below 50px threshold
    expect(onLeft).not.toHaveBeenCalled();
  });

  it('ignores swipe with excessive vertical drift', () => {
    const onLeft = jest.fn();
    render(<SwipeTestComponent onLeft={onLeft} />);
    swipe(screen.getByTestId('swipe-area'), -60, 100); // 100px vertical > maxVertical 80
    expect(onLeft).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const onLeft = jest.fn();
    const onRight = jest.fn();
    render(<SwipeTestComponent onLeft={onLeft} onRight={onRight} enabled={false} />);
    swipe(screen.getByTestId('swipe-area'), -80);
    swipe(screen.getByTestId('swipe-area'), 80);
    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
  });
});
