// React is used implicitly via JSX transform
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

// ══════════════════════════════════════════════════════════════
//  Mocks
// ══════════════════════════════════════════════════════════════

// Mock the YouTube IFrame API on window
const mockPlayer = {
  loadVideoById: jest.fn(),
  seekTo: jest.fn(),
  playVideo: jest.fn(),
  pauseVideo: jest.fn(),
  stopVideo: jest.fn(),
  destroy: jest.fn(),
  getPlayerState: jest.fn(() => 1),
  getCurrentTime: jest.fn(() => 5.2),
  getDuration: jest.fn(() => 120),
};

// Store the onReady/onStateChange callbacks so tests can trigger them
const MockYTPlayer = jest.fn().mockImplementation((_el, opts) => {
  // capture events for potential future use
  void opts.events;
  return mockPlayer;
});

beforeAll(() => {
  Object.defineProperty(window, 'YT', {
    value: { Player: MockYTPlayer },
    writable: true,
  });
  // Simulate API already loaded
  Object.defineProperty(window, 'onYouTubeIframeAPIReady', {
    value: undefined,
    writable: true,
  });
});

// Mock useVideoPlayer to isolate component from actual YT API in component tests
jest.mock('../hooks/useVideoPlayer', () => ({
  useVideoPlayer: jest.fn(() => ({
    containerRef: { current: null },
    playerState: -1,
    currentTime: 0,
    duration: 0,
    isReady: false,
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    loadVideo: jest.fn(),
  })),
}));

import VideoPlayer from '../components/VideoPlayer';
import SubtitleDisplay from '../components/SubtitleDisplay';
import { usePlaybackController } from '../hooks/usePlaybackController';
import type { SearchResult, Accent } from '../types/index';

// ── Sample data ──────────────────────────────────────────────
const makeResult = (overrides: Partial<SearchResult> = {}): SearchResult => ({
  id: 'sub-1',
  videoId: 'dQw4w9WgXcQ',
  startTime: 10,
  endTime: 13,
  text: 'Never gonna give you up',
  accent: 'UK' as Accent,
  relevanceScore: 0.95,
  context: { before: 'We know the song', after: 'so well' },
  ...overrides,
});

// ══════════════════════════════════════════════════════════════
//  VideoPlayer Tests (Task 10.1)
// ══════════════════════════════════════════════════════════════
describe('VideoPlayer (Task 10.1)', () => {
  it('renders a loading overlay when not ready', () => {
    render(<VideoPlayer videoId="abc123" startTime={0} />);
    expect(screen.getByText(/loading video/i)).toBeInTheDocument();
  });

  it('renders a region container', () => {
    render(<VideoPlayer videoId="abc123" startTime={5} />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('renders play/pause button when ready (mocked)', () => {
    const { useVideoPlayer } = require('../hooks/useVideoPlayer');
    useVideoPlayer.mockReturnValueOnce({
      containerRef: { current: null },
      playerState: 2,   // PAUSED
      currentTime: 5,
      duration: 120,
      isReady: true,
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
      loadVideo: jest.fn(),
    });

    render(<VideoPlayer videoId="abc123" startTime={5} />);
    expect(screen.getByLabelText('Play')).toBeInTheDocument();
  });

  it('renders pause button when playing', () => {
    const { useVideoPlayer } = require('../hooks/useVideoPlayer');
    useVideoPlayer.mockReturnValueOnce({
      containerRef: { current: null },
      playerState: 1,   // PLAYING
      currentTime: 5,
      duration: 120,
      isReady: true,
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(),
      loadVideo: jest.fn(),
    });

    render(<VideoPlayer videoId="abc123" startTime={5} />);
    expect(screen.getByLabelText('Pause')).toBeInTheDocument();
  });

  it('calls play when play button is clicked', () => {
    const mockPlay = jest.fn();
    const { useVideoPlayer } = require('../hooks/useVideoPlayer');
    useVideoPlayer.mockReturnValueOnce({
      containerRef: { current: null },
      playerState: 2,
      currentTime: 5,
      duration: 120,
      isReady: true,
      play: mockPlay,
      pause: jest.fn(),
      seekTo: jest.fn(),
      loadVideo: jest.fn(),
    });

    render(<VideoPlayer videoId="abc123" startTime={5} />);
    fireEvent.click(screen.getByLabelText('Play'));
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });
});

// ══════════════════════════════════════════════════════════════
//  SubtitleDisplay Tests (Task 10.2)
// ══════════════════════════════════════════════════════════════
describe('SubtitleDisplay (Task 10.2)', () => {
  it('renders the subtitle text', () => {
    render(
      <SubtitleDisplay text="Never gonna give you up" />
    );
    expect(screen.getByText(/never gonna give you up/i)).toBeInTheDocument();
  });

  it('highlights matching words', () => {
    render(
      <SubtitleDisplay
        text="Never gonna give you up"
        highlightWords={['gonna', 'give']}
      />
    );
    const marks = document.querySelectorAll('mark');
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toMatch(/gonna/i);
    expect(marks[1].textContent).toMatch(/give/i);
  });

  it('renders context before text', () => {
    render(
      <SubtitleDisplay
        text="Never gonna give you up"
        context={{ before: 'We all know the song', after: '' }}
      />
    );
    expect(screen.getByText(/we all know the song/i)).toBeInTheDocument();
  });

  it('renders context after text', () => {
    render(
      <SubtitleDisplay
        text="Never gonna give you up"
        context={{ before: '', after: 'really well by now' }}
      />
    );
    expect(screen.getByText(/really well by now/i)).toBeInTheDocument();
  });

  it('renders with role=region and aria-label', () => {
    render(<SubtitleDisplay text="test" />);
    expect(screen.getByRole('region', { name: /current subtitle/i })).toBeInTheDocument();
  });

  it('uses server-provided highlightedText when available', () => {
    render(
      <SubtitleDisplay
        text="Never gonna give you up"
        highlightedText="Never <em>gonna</em> give you up"
      />
    );
    // The em tag should be rendered as HTML
    expect(document.querySelector('em')).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════
//  usePlaybackController Tests (Task 10.3)
// ══════════════════════════════════════════════════════════════
describe('usePlaybackController (Task 10.3)', () => {
  const makeResults = (n: number): SearchResult[] =>
    Array.from({ length: n }, (_, i) => makeResult({ id: `sub-${i}`, startTime: i * 10 }));

  it('initialises at index 0', () => {
    const { result } = renderHook(() =>
      usePlaybackController({ results: makeResults(5) })
    );
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentResult?.startTime).toBe(0);
  });

  it('goToNext increments index', () => {
    const { result } = renderHook(() =>
      usePlaybackController({ results: makeResults(5) })
    );
    act(() => result.current.goToNext());
    expect(result.current.currentIndex).toBe(1);
  });

  it('goToPrevious decrements index', () => {
    const { result } = renderHook(() =>
      usePlaybackController({ results: makeResults(5) })
    );
    act(() => result.current.goToNext());
    act(() => result.current.goToPrevious());
    expect(result.current.currentIndex).toBe(0);
  });

  it('does NOT go below index 0', () => {
    const { result } = renderHook(() =>
      usePlaybackController({ results: makeResults(3) })
    );
    act(() => result.current.goToPrevious());
    expect(result.current.currentIndex).toBe(0);
  });

  it('does NOT go beyond last index', () => {
    const { result } = renderHook(() =>
      usePlaybackController({ results: makeResults(3) })
    );
    act(() => result.current.goToNext());
    act(() => result.current.goToNext());
    act(() => result.current.goToNext()); // already at last
    expect(result.current.currentIndex).toBe(2);
  });

  it('goToIndex jumps directly', () => {
    const { result } = renderHook(() =>
      usePlaybackController({ results: makeResults(5) })
    );
    act(() => result.current.goToIndex(3));
    expect(result.current.currentIndex).toBe(3);
  });

  it('handleVideoEnded advances when autoPlay=true', () => {
    const { result } = renderHook(() =>
      usePlaybackController({ results: makeResults(5), autoPlay: true })
    );
    act(() => result.current.handleVideoEnded());
    expect(result.current.currentIndex).toBe(1);
  });

  it('handleVideoEnded does NOT advance when autoPlay=false', () => {
    const { result } = renderHook(() =>
      usePlaybackController({ results: makeResults(5), autoPlay: false })
    );
    act(() => result.current.handleVideoEnded());
    expect(result.current.currentIndex).toBe(0);
  });

  it('stays at last result after handleVideoEnded', () => {
    const results = makeResults(2);
    const { result } = renderHook(() =>
      usePlaybackController({ results, autoPlay: true })
    );
    act(() => result.current.goToIndex(1));       // go to last
    act(() => result.current.handleVideoEnded()); // try to advance
    expect(result.current.currentIndex).toBe(1);  // stays at last
  });

  it('resets to index 0 when results change', () => {
    const { result, rerender } = renderHook(
      ({ results }: { results: SearchResult[] }) =>
        usePlaybackController({ results }),
      { initialProps: { results: makeResults(5) } }
    );
    act(() => result.current.goToIndex(3));
    rerender({ results: makeResults(3) });          // new results
    expect(result.current.currentIndex).toBe(0);
  });

  it('setAutoPlay toggles autoPlay state', () => {
    const { result } = renderHook(() =>
      usePlaybackController({ results: makeResults(3) })
    );
    expect(result.current.autoPlay).toBe(false);
    act(() => result.current.setAutoPlay(true));
    expect(result.current.autoPlay).toBe(true);
  });
});
