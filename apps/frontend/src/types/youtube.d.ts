interface YTPlayerState {
  UNSTARTED: number;
  ENDED: number;
  PLAYING: number;
  PAUSED: number;
  BUFFERING: number;
  CUED: number;
}

interface YTVideoData {
  video_id: string;
  author: string;
  title: string;
}

interface YTOnReadyEvent {
  target: unknown;
}

interface YTOnStateChangeEvent {
  data: number;
  target: unknown;
}

interface YTPlayerVars {
  controls?: number;
  disablekb?: number;
  fs?: number;
  modestbranding?: number;
  playsinline?: number;
  rel?: number;
}

interface YTPlayerOptions {
  width?: string | number;
  height?: string | number;
  videoId?: string;
  playerVars?: YTPlayerVars;
  events?: {
    onReady?: (event: YTOnReadyEvent) => void;
    onStateChange?: (event: YTOnStateChangeEvent) => void;
  };
}

interface YTPlayer {
  loadVideoById(opts: { videoId: string; suggestedQuality?: string }): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  getVideoData(): YTVideoData;
  destroy(): void;
}

declare namespace YT {
  const PlayerState: YTPlayerState;
  class Player {
    constructor(element: HTMLElement, options: YTPlayerOptions);
    loadVideoById(opts: { videoId: string; suggestedQuality?: string }): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    playVideo(): void;
    pauseVideo(): void;
    getPlayerState(): number;
    getCurrentTime(): number;
    setVolume(volume: number): void;
    mute(): void;
    unMute(): void;
    getVideoData(): YTVideoData;
    destroy(): void;
  }
}

interface Window {
  onYouTubeIframeAPIReady?: () => void;
  YT?: typeof YT;
}
