import React from 'react';
import VideoPlayer from './VideoPlayer.js';
import SubtitleDisplay from './SubtitleDisplay.js';
import ResultNavigator from './ResultNavigator.js';
import { usePlaybackController } from '../hooks/usePlaybackController.js';
import type { SearchResult } from '../types/index.js';

interface VideoPlayerPanelProps {
  results: SearchResult[];
  query: string;
  isVisible: boolean;
}

/**
 * VideoPlayerPanel (Task 10.3 composite)
 *
 * Wires together:
 *  - usePlaybackController  → navigation, auto-play, keyboard
 *  - VideoPlayer            → YouTube IFrame embed
 *  - SubtitleDisplay        → highlighted text + context
 *  - ResultNavigator        → prev/next + autoplay toggle
 */
const VideoPlayerPanel: React.FC<VideoPlayerPanelProps> = ({
  results,
  query,
  isVisible,
}) => {
  const {
    currentIndex,
    currentResult,
    autoPlay,
    setAutoPlay,
    goToNext,
    goToPrevious,
    handleVideoEnded,
  } = usePlaybackController({
    results,
    autoPlay: false,
  });

  if (!isVisible || results.length === 0 || !currentResult) {
    return null;
  }

  const highlightWords = query.trim().split(/\s+/).filter(Boolean);

  return (
    <div
      className="flex flex-col gap-4 w-full"
      id="video-player-panel"
      aria-label="Video player panel"
    >
      {/* ── Video embed ──────────────────────────────────────── */}
      <VideoPlayer
        videoId={currentResult.videoId}
        startTime={currentResult.startTime}
        endTime={currentResult.endTime}
        autoPlay={autoPlay}
        onEnded={handleVideoEnded}
      />

      {/* ── Subtitle display ─────────────────────────────────── */}
      <SubtitleDisplay
        text={currentResult.text}
        highlightedText={currentResult.highlightedText}
        highlightWords={highlightWords}
        context={currentResult.context}
      />

      {/* ── Navigation ───────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <ResultNavigator
          currentIndex={currentIndex}
          totalResults={results.length}
          onPrevious={goToPrevious}
          onNext={goToNext}
          autoPlay={autoPlay}
          onAutoPlayToggle={setAutoPlay}
        />

        {/* Accent + relevance badge */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="px-2 py-1 bg-gray-100 rounded-lg font-mono">
            {currentResult.accent}
          </span>
          {currentResult.relevanceScore !== undefined && (
            <span className="opacity-60">
              Score: {(currentResult.relevanceScore * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerPanel;
