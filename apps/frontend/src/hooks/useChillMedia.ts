import { useCallback, useEffect, useRef, useState } from "react";
import { loadYouTubeApi } from "@/lib/youtube";
import type { RealtimeClient } from "@/lib/realtime";
import type { ChillQueueItem } from "@hive/types";
import { chillScreenOverlay } from "@/components/world/ChillScreenProjection";

export interface ChillMediaState {
  videoUrl: string | null;
  videoId: string | null;
  title: string | null;
  isPlaying: boolean;
  playheadMs: number;
  at: number;
  setByName?: string | null;
  queueItemId?: string | null;
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
 * `chill.queue.state` carries the ordered YouTube-like queue; when the player
 * reports ENDED we emit `chill.queue.ended` so the server auto-advances.
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
    queueItemId: null,
  });
  const [queue, setQueue] = useState<ChillQueueItem[]>([]);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
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
  const clientRef = useRef(client);
  clientRef.current = client;
  // Guards duplicate ENDED reports for the same item (all peers report it).
  const endedSentForRef = useRef<string | null>(null);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    localStorage.setItem(VOLUME_KEY, String(v));
    const p = playerRef.current;
    if (p) {
      p.setVolume(Math.round(v * 100));
      applyMuted(p, v === 0);
    }
  }, []);

  // Subscribe to server media + queue state.
  useEffect(() => {
    if (!client) return;
    const offMedia = client.on("chill.media.state", (e) => {
      if (e.videoId !== stateRef.current.videoId) {
        endedSentForRef.current = null;
      }
      setState({
        videoUrl: e.videoUrl,
        videoId: e.videoId,
        title: e.title,
        isPlaying: e.isPlaying,
        playheadMs: e.playheadMs,
        at: e.at,
        setByName: e.setByName,
        queueItemId: e.queueItemId ?? null,
      });
    });
    const offQueue = client.on("chill.queue.state", (e) => {
      setQueue(e.items);
      setCurrentItemId(e.currentItemId ?? null);
    });
    return () => {
      offMedia();
      offQueue();
    };
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
          onStateChange: (ev) => {
            if (ev.data === YT.PlayerState.PLAYING) {
              // Autoplay starts muted (browser policy blocks unmuted starts
              // with no gesture left after the server round-trip). Go audible
              // as soon as playback actually runs, if this client should
              // hear it — unmuting a running player needs no gesture.
              if (inChillRef.current && volumeRef.current > 0) {
                try {
                  p.unMute();
                } catch {
                  /* player torn down mid-callback */
                }
              }
              return;
            }
            if (ev.data !== YT.PlayerState.ENDED) return;
            const current = stateRef.current;
            const itemId = current.queueItemId;
            if (!itemId || endedSentForRef.current === itemId) return;
            endedSentForRef.current = itemId;
            clientRef.current?.sendChillQueueEnded(itemId);
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

  // Reconcile the player with the latest server state. Every player call is
  // guarded individually: on a fresh/not-yet-ready iframe any single getter
  // can throw, and one throw must never abort the load itself (that silent
  // death is what left late joiners staring at a blank screen until the next
  // broadcast). Unknown state is treated as "needs load/play".
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !playerMounted || !state.videoId) return;
    const targetVideo = state.videoId;
    let cancelled = false;
    let timer: number | undefined;
    let retries = 0;

    const attempt = () => {
      if (cancelled) return;
      const player = playerRef.current;
      if (!player) return;
      const snap = stateRef.current;
      // Superseded by a newer broadcast — let that run handle it.
      if (!snap.videoId || snap.videoId !== targetVideo) return;
      const wantPlaying = snap.isPlaying && !!snap.videoId;
      const fail = () => {
        // Bounded retry for the narrow window where the player object
        // exists but the iframe isn't callable yet.
        if (!cancelled && retries++ < 4) {
          window.clearTimeout(timer);
          timer = window.setTimeout(attempt, 1500);
        }
      };
      let loadedId: string | null = null;
      try {
        loadedId = player.getVideoData()?.video_id ?? null;
      } catch {
        // Unreadable (fresh iframe) — null already means "needs load".
      }
      try {
        if (loadedId !== targetVideo) {
          endedSentForRef.current = null;
          const video = {
            videoId: targetVideo,
            startSeconds: snap.playheadMs / 1000,
            suggestedQuality: "large" as const,
          };
          // loadVideoById starts playback immediately. Mute first: the
          // server event arrives with no click gesture in context, so an
          // unmuted start is blocked and the UI would show "playing" over a
          // silent, stalled player. The PLAYING handler above unmutes once
          // audible. Cue a paused shared video so the iframe cannot report
          // an unintended play event back to peers.
          if (wantPlaying) {
            player.mute();
            player.loadVideoById(video);
          } else player.cueVideoById(video);
        } else {
          const expected = snap.isPlaying
            ? snap.playheadMs + (Date.now() - snap.at)
            : snap.playheadMs;
          let currentMs = Number.NaN;
          try {
            currentMs = player.getCurrentTime() * 1000;
          } catch {
            /* not readable yet — skip the drift check, not the sync */
          }
          if (
            Number.isFinite(currentMs) &&
            Math.abs(currentMs - expected) > 120
          ) {
            try {
              player.seekTo(expected / 1000, true);
            } catch {
              /* seek on a loading player — drift check retries next run */
            }
          }
        }

        let actual = -2;
        try {
          actual = player.getPlayerState();
        } catch {
          actual = -2;
        }
        if (wantPlaying && actual !== YT.PlayerState.PLAYING) {
          try {
            player.playVideo();
          } catch {
            fail();
          }
        } else if (!wantPlaying && actual === YT.PlayerState.PLAYING) {
          try {
            player.pauseVideo();
          } catch {
            fail();
          }
        }
      } catch {
        fail();
      }
    };

    attempt();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Depend on media identity + play flag + player readiness: state can
    // arrive (e.g. hello snapshot for a late joiner) before the YT player
    // is ready, and the player can become ready after state arrived — both
    // orders must converge on the next run.
  }, [
    state.videoId,
    state.isPlaying,
    state.playheadMs,
    state.at,
    playerMounted,
  ]);

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

  const enqueue = useCallback(
    (url: string) => client?.sendChillQueueAdd(url),
    [client],
  );
  const playItem = useCallback(
    (itemId: string) => client?.sendChillQueuePlay(itemId),
    [client],
  );
  const next = useCallback(() => client?.sendChillQueueNext(), [client]);
  const prev = useCallback(() => client?.sendChillQueuePrev(), [client]);
  const removeItem = useCallback(
    (itemId: string) => client?.sendChillQueueRemove(itemId),
    [client],
  );
  const reorder = useCallback(
    (itemId: string, toIndex: number) =>
      client?.sendChillQueueReorder(itemId, toIndex),
    [client],
  );
  const clearQueue = useCallback(() => client?.sendChillQueueClear(), [client]);

  return {
    state,
    queue,
    currentItemId: currentItemId ?? state.queueItemId ?? null,
    volume,
    setVolume,
    playerMounted,
    seek,
    containerRef,
    enqueue,
    playItem,
    next,
    prev,
    removeItem,
    reorder,
    clearQueue,
  };
}
