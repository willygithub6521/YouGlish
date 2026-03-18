/**
 * YouTube IFrame Player API type declarations
 * (subset used by the application)
 */
declare namespace YT {
  type PlayerState = -1 | 0 | 1 | 2 | 3 | 5;

  interface PlayerStateChangeEvent {
    data: PlayerState;
    target: Player;
  }

  interface PlayerEvent {
    target: Player;
  }

  interface PlayerVars {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    start?: number;
    end?: number;
    modestbranding?: 0 | 1;
    rel?: 0 | 1;
    showinfo?: 0 | 1;
    iv_load_policy?: 1 | 3;
    cc_load_policy?: 0 | 1;
    origin?: string;
    enablejsapi?: 0 | 1;
    fs?: 0 | 1;
  }

  interface PlayerOptions {
    videoId?: string;
    width?: number | string;
    height?: number | string;
    playerVars?: PlayerVars;
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: PlayerStateChangeEvent) => void;
      onError?: (event: { data: number }) => void;
    };
  }

  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions);
    loadVideoById(videoId: string, startSeconds?: number): void;
    cueVideoById(videoId: string, startSeconds?: number): void;
    seekTo(seconds: number, allowSeekAhead?: boolean): void;
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    getPlayerState(): PlayerState;
    getCurrentTime(): number;
    getDuration(): number;
    destroy(): void;
    addEventListener(event: string, listener: (event: unknown) => void): void;
  }
}

interface Window {
  YT: typeof YT;
  onYouTubeIframeAPIReady: (() => void) | undefined;
}
