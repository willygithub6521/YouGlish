import React, { useEffect } from 'react';
import { useVideoPlayer } from '../hooks/useVideoPlayer.js';
import type { VideoPlayerProps, PlayerState } from '../types/index.js';

// Player state constants
const STATE_LABELS: Record<number, string> = {
  [-1]: 'Unstarted',
  [0]: 'Ended',
  [1]: 'Playing',
  [2]: 'Paused',
  [3]: 'Buffering',
  [5]: 'Cued',
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  startTime,
  endTime,
  autoPlay = false,
  onReady,
  onStateChange,
  onTimeUpdate,
}) => {
  const {
    containerRef,
    playerState,
    currentTime,
    duration,
    isReady,
    play,
    pause,
  } = useVideoPlayer({
    videoId,
    startTime,
    endTime,
    autoPlay,
    onReady,
    onStateChange: onStateChange
      ? (s) => onStateChange(s as unknown as PlayerState)
      : undefined,
    onTimeUpdate,
  });

  const isPlaying = playerState === 1;

  // Format seconds → m:ss
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-black shadow-xl group">
      {/* Embed container */}
      <div
        ref={containerRef}
        className="aspect-video w-full"
        style={{ minHeight: 200 }}
        aria-label={`YouTube video player for video ${videoId}`}
        role="region"
      />

      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-red-300 border-t-red-500 rounded-full animate-spin" />
            <p className="text-white text-sm opacity-80">Loading video…</p>
          </div>
        </div>
      )}

      {/* Minimal status bar – only show when ready */}
      {isReady && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-between
                     px-3 py-1.5 bg-gradient-to-t from-black/70 to-transparent
                     opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20"
        >
          {/* Play / Pause button */}
          <button
            id="player-play-pause"
            type="button"
            onClick={isPlaying ? pause : play}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="text-white hover:text-red-400 transition-colors"
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Time display */}
          <span className="text-white text-xs font-mono tabular-nums">
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          {/* State label */}
          <span className="text-white/60 text-xs">
            {STATE_LABELS[playerState] ?? ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
