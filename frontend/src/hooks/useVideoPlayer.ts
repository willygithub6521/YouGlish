import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlayerState } from '../types/index.js';

// ── API loader (singleton) ───────────────────────────────────────
let apiReady = false;
let pendingCallbacks: Array<() => void> = [];

function loadYouTubeApi(): void {
  if (typeof window === 'undefined') return;
  if (apiReady) return;
  if (document.getElementById('youtube-iframe-api')) return; // already loading

  const script = document.createElement('script');
  script.id = 'youtube-iframe-api';
  script.src = 'https://www.youtube.com/iframe_api';
  script.async = true;
  document.head.appendChild(script);

  const existing = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    apiReady = true;
    pendingCallbacks.forEach((cb) => cb());
    pendingCallbacks = [];
    existing?.();
  };
}

function whenApiReady(cb: () => void): void {
  if (apiReady) { cb(); return; }
  pendingCallbacks.push(cb);
  loadYouTubeApi();
}

// ── Hook types ───────────────────────────────────────────────────
export interface UseVideoPlayerOptions {
  videoId: string | null;
  startTime?: number;
  endTime?: number;
  autoPlay?: boolean;
  onReady?: () => void;
  onStateChange?: (state: number) => void;
  onEnded?: () => void;
  onTimeUpdate?: (time: number) => void;
}

export interface UseVideoPlayerReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  playerState: number;
  currentTime: number;
  duration: number;
  isReady: boolean;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  loadVideo: (videoId: string, startTime?: number) => void;
}

// ── Hook ─────────────────────────────────────────────────────────
export function useVideoPlayer(options: UseVideoPlayerOptions): UseVideoPlayerReturn {
  const {
    videoId,
    startTime = 0,
    endTime,
    autoPlay = false,
    onReady,
    onStateChange,
    onEnded,
    onTimeUpdate,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const pollingRef = useRef<number | null>(null);
  const endTimeRef = useRef<number | undefined>(endTime);

  const [playerState, setPlayerState] = useState<number>(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Keep endTime ref current without recreating the player
  useEffect(() => { endTimeRef.current = endTime; }, [endTime]);

  // ── Cleanup polling ──────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // ── Start polling for time updates ───────────────────────────
  const startPolling = useCallback(() => {
    stopPolling();
    pollingRef.current = window.setInterval(() => {
      if (!playerRef.current) return;
      const t = playerRef.current.getCurrentTime();
      setCurrentTime(t);
      onTimeUpdate?.(t);

      // Auto-stop at endTime
      if (endTimeRef.current !== undefined && t >= endTimeRef.current) {
        playerRef.current.pauseVideo();
        stopPolling();
        onEnded?.();
      }
    }, 250);
  }, [stopPolling, onTimeUpdate, onEnded]);

  // ── Create / destroy player ──────────────────────────────────
  useEffect(() => {
    if (!videoId || !containerRef.current) return;

    let destroyed = false;

    whenApiReady(() => {
      if (destroyed || !containerRef.current) return;

      // Ensure a host element exists
      const hostId = `yt-player-${Math.random().toString(36).slice(2)}`;
      const host = document.createElement('div');
      host.id = hostId;
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(host);

      const player = new window.YT.Player(hostId, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          start: Math.floor(startTime),
          controls: 1,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (destroyed) return;
            setIsReady(true);
            setDuration(player.getDuration());
            onReady?.();
            if (autoPlay) startPolling();
          },
          onStateChange: (e) => {
            if (destroyed) return;
            setPlayerState(e.data);
            onStateChange?.(e.data);
            if (e.data === 1) {          // PLAYING
              startPolling();
            } else if (e.data === 0) {   // ENDED
              stopPolling();
              onEnded?.();
            } else if (e.data === 2) {   // PAUSED
              stopPolling();
            }
          },
        },
      });

      playerRef.current = player;
    });

    return () => {
      destroyed = true;
      stopPolling();
      try { playerRef.current?.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
      setIsReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, startTime]);

  // ── Controls ─────────────────────────────────────────────────
  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
    stopPolling();
  }, [stopPolling]);
  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
  }, []);

  const loadVideo = useCallback((vid: string, start = 0) => {
    stopPolling();
    setIsReady(false);
    if (playerRef.current) {
      playerRef.current.loadVideoById(vid, start);
    }
  }, [stopPolling]);

  // ── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => () => { stopPolling(); }, [stopPolling]);

  return { containerRef, playerState, currentTime, duration, isReady, play, pause, seekTo, loadVideo };
}
