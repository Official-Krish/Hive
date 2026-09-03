import { useCallback, useEffect, useRef, useState } from "react";
import { loadYouTubeApi } from "@/lib/youtube";
import type { RealtimeClient } from "@/lib/realtime";
import { chillScreenOverlay } from "@/components/world/ChillScreenProjection";

export interface ChillMediaState {
  videoUrl: string | null;
  videoId: string | null;
  title: string | null;
  isPlaying: boolean;
  playheadMs: number;
  at: number;
  setByName?: string | null;
}

const VOLUME_KEY = "chill.volume";

/** The IFrame API has no setMute; mute/unMute are separate calls. */
function applyMuted(p: YT.Player, muted: boolean) {
  if (muted) p.mute();
  else p.unMute();
}

/**
 * Shared, server-authoritative video playback for the Chill Space screen.
 *
 * One YouTube iframe player is mounted in a fixed DOM overlay and projected
 * onto the 3D chill-screen mesh by `ChillScreenProjection`. The server is the
 * source of truth: on `chill.media.state` we set the video id, seek to the
 * broadcast playhead, and reconcile play/pause with broadcast drift correction.
 *
 * Audio is a per-client responsibility: it is audible only while the local user
 * is inside the Chill Space, and scaled by that user's local volume. Leaving the
 * room keeps the player mounted (so it's already in sync on return) but mutes it.
 */
export function useChillMedia(
  client: RealtimeClient | null,
  inChillSpace: boolean,
) {
  const [state, setState] = useState<ChillMediaState>({
    videoUrl: null,
    videoId: null,
    title: null,
    isPlaying: false,
    playheadMs: 0,
    at: 0,
  });
  const [volume, setVolumeState] = useState<number>(() =>
    Number(localStorage.getItem(VOLUME_KEY) ?? 1),
  );
  const [playerMounted, setPlayerMounted] = useState(false);

  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const inChillRef = useRef(inChillSpace);
  inChillRef.current = inChillSpace;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    localStorage.setItem(VOLUME_KEY, String(v));
    const p = playerRef.current;
    if (p) {
      p.setVolume(Math.round(v * 100));
      applyMuted(p, v === 0);
    }
  }, []);

  // Subscribe to server media state.
  useEffect(() => {
    if (!client) return;
    const off = client.on("chill.media.state", (e) => {
      setState({
        videoUrl: e.videoUrl,
        videoId: e.videoId,
        title: e.title,
        isPlaying: e.isPlaying,
        playheadMs: e.playheadMs,
        at: e.at,
        setByName: e.setByName,
      });
    });
    return off;
  }, [client]);

  // Mount the single YouTube player container + API once. The container is
  // appended directly to <body> so the projection (which reads
  // `chillScreenOverlay.node`) and the player host share the same element —
  // no ref-timing fragility between the hook and the caller's JSX.
  useEffect(() => {
    const container = document.createElement("div");
    container.id = "chill-player-overlay";
    Object.assign(container.style, {
      position: "fixed",
      display: "none",
      overflow: "hidden",
      pointerEvents: "none",
      transformOrigin: "0 0",
      zIndex: "5",
    });
    const host = document.createElement("div");
    host.id = "chill-player-host";
    Object.assign(host.style, { width: "100%", height: "100%" });
    container.appendChild(host);
    containerRef.current = container;
    chillScreenOverlay.node = container;
    document.body.appendChild(container);
    let cancelled = false;

    void loadYouTubeApi().then((YT) => {
      if (cancelled || playerRef.current) return;
      const p = new YT.Player(host, {
        width: "100%",
        height: "100%",
        playerVars: {
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            playerRef.current = p;
            p.setVolume(Math.round(volumeRef.current * 100));
            applyMuted(p, volumeRef.current === 0);
            setPlayerMounted(true);
          },
        },
      });
      playerRef.current = p;
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      chillScreenOverlay.node = null;
      container.remove();
    };
  }, []);

  // Reconcile the player with the latest server state.
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !state.videoId) return;
    const targetVideo = state.videoId;
    void loadYouTubeApi().then(() => {
      const player = playerRef.current;
      if (!player) return;
      const wantPlaying =
        stateRef.current.isPlaying && !!stateRef.current.videoId;
      try {
        const actual = player.getPlayerState();
        const videoChanged = player.getVideoData()?.video_id !== targetVideo;

        if (videoChanged) {
          const video = {
            videoId: targetVideo,
            startSeconds: stateRef.current.playheadMs / 1000,
            suggestedQuality: "large" as const,
          };
          // Loading starts playback immediately. Cue a paused shared video so
          // the iframe cannot report an unintended play event back to peers.
          if (wantPlaying) player.loadVideoById(video);
          else player.cueVideoById(video);
        } else {
          const expected = stateRef.current.isPlaying
            ? stateRef.current.playheadMs + (Date.now() - stateRef.current.at)
            : stateRef.current.playheadMs;
          const currentMs = player.getCurrentTime() * 1000;
          if (Math.abs(currentMs - expected) > 120 && !videoChanged) {
            player.seekTo(expected / 1000, true);
          }
        }

        if (wantPlaying && actual !== YT.PlayerState.PLAYING) {
          player.playVideo();
        } else if (!wantPlaying && actual === YT.PlayerState.PLAYING) {
          player.pauseVideo();
        }
      } catch {
        /* player not ready yet */
      }
    });
    // Depend only on the media identity + play flag; run when synced by events.
  }, [state.videoId, state.isPlaying, state.playheadMs, state.at]);

  // Audio gate: audible only inside the Chill Space.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    if (inChillSpace) {
      p.setVolume(Math.round(volumeRef.current * 100));
      applyMuted(p, volumeRef.current === 0);
    } else {
      applyMuted(p, true);
    }
  }, [inChillSpace, playerMounted]);

  const seek = useCallback(
    (playheadMs: number) => {
      client?.sendChillSeek(playheadMs);
    },
    [client],
  );

  return { state, volume, setVolume, playerMounted, seek, containerRef };
}
