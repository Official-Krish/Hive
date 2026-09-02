import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState, Room, RoomEvent } from "livekit-client";
import { ApiError, http } from "@/lib/http";

export interface LiveKitCallOptions {
  /** Dev ids whose remote audio stays audible while `muteRemote` is on. */
  volumePeers?: ReadonlySet<string>;
  /** Mute every remote participant except those in `volumePeers` (focus rooms). */
  muteRemote?: boolean;
  /** Suppress my published mic/camera (focus until a partner accepts). */
  suppressPublish?: boolean;
  /** Force-publish my tracks regardless of proximity (active pair session). */
  forcePublish?: boolean;
}

export interface LiveKitCallState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  mediaError: string | null;
  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleShare: () => void;
  room: Room | null;
  visibleIds: ReadonlySet<string>;
}

/* Token TTL is 6h; refresh ~10 min before expiry so long calls don't drop. */
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const TOKEN_REFRESH_MS = TOKEN_TTL_MS - 10 * 60 * 1000;
/* Exit grace before muting camera/mic after a peer leaves proximity, so a
   boundary blip or quick depart-and-return can't flip the indicators. */
const EXIT_GRACE_MS = 1200;

const safe = (p: Promise<unknown>): void => {
  p.catch(() => {});
};

export function useLiveKitCall(
  workspaceId: string,
  myUserId: string,
  nearIds: ReadonlySet<string>,
  onlineCount: number,
  options: LiveKitCallOptions = {},
): LiveKitCallState {
  const { volumePeers, muteRemote, suppressPublish, forcePublish } = options;
  const mute = Boolean(muteRemote);
  const suppress = Boolean(suppressPublish);
  const force = Boolean(forcePublish);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);

  const roomRef = useRef<Room | null>(null);
  const micIntent = useRef(true);
  const cameraIntent = useRef(true);
  const screenIntent = useRef(false);
  const sharingRef = useRef(false);
  const volumePeersRef = useRef(volumePeers);
  volumePeersRef.current = volumePeers;
  const muteRemoteRef = useRef(mute);
  muteRemoteRef.current = mute;
  const suppressRef = useRef(suppress);
  suppressRef.current = suppress;
  const forceRef = useRef(force);
  forceRef.current = force;
  const nearKeyRef = useRef("");

  const nearKey = [...nearIds].sort().join(",");
  nearKeyRef.current = nearKey;
  const nearRef = useRef(false);
  nearRef.current = nearKey !== "";

  // Only connect when at least two members are online, and only flip the
  // "should connect" intent when that threshold is crossed — not on every
  // online-count change — so a join/leave while already in-call doesn't tear
  // the room down and reconnect (which would drop media).
  const [shouldConnect, setShouldConnect] = useState(false);
  const prevEnough = useRef(false);
  useEffect(() => {
    const enough = onlineCount >= 2;
    if (enough !== prevEnough.current) {
      prevEnough.current = enough;
      setShouldConnect(enough);
      if (!enough) {
        const r = roomRef.current;
        if (r) void r.disconnect();
      }
    }
  }, [onlineCount]);

  useEffect(() => {
    if (!shouldConnect) return;
    let cancelled = false;
    const r = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = r;
    setRoom(r);

    const onState = (state: ConnectionState) => {
      if (cancelled) return;
      setConnected(state === ConnectionState.Connected);
      setConnecting(
        state === ConnectionState.Connecting ||
          state === ConnectionState.Reconnecting,
      );
    };
    const onDisconnected = () => {
      if (!cancelled) setConnected(false);
    };
    r.on(RoomEvent.ConnectionStateChanged, onState);
    r.on(RoomEvent.Disconnected, onDisconnected);

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      refreshTimer = setTimeout(async () => {
        if (cancelled || r.state !== ConnectionState.Connected) return;
        try {
          const { url, token } = await http.livekit.token(workspaceId);
          await r.connect(url, token);
          scheduleRefresh();
        } catch {
          /* ignored — livekit-client reconnect will retry on next drop */
        }
      }, TOKEN_REFRESH_MS);
    };

    (async () => {
      let attempts = 0;
      while (!cancelled) {
        try {
          if (cancelled) return;
          setConnecting(true);
          const { url, token } = await http.livekit.token(workspaceId);
          if (cancelled) return;
          await r.connect(url, token);
          if (cancelled) return;
          setError(null);
          scheduleRefresh();
          break;
        } catch (e) {
          if (cancelled) return;
          const notReady = e instanceof ApiError && e.code === "ROOM_NOT_READY";
          // Transient "not enough peers" — back off and retry, then wait
          // silently rather than surfacing a false error.
          if (notReady && attempts < 5) {
            attempts++;
            await new Promise((res) => setTimeout(res, 1500 * attempts));
            continue;
          }
          setError(
            notReady
              ? null
              : e instanceof Error
                ? e.message
                : "Could not connect to voice chat",
          );
          break;
        } finally {
          if (!cancelled) setConnecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      r.off(RoomEvent.ConnectionStateChanged, onState);
      r.off(RoomEvent.Disconnected, onDisconnected);
      void r.disconnect();
      roomRef.current = null;
    };
  }, [shouldConnect, workspaceId, myUserId]);

  // Publishing, driven by proximity. Track receive is default (auto-subscribe),
  // so there is no SFU permission gate that could silently black out a remote.
  // Enter is instant; exit is deferred by a short grace window so a momentary
  // presence blip at the boundary (or a quick depart-and-return) can't flip
  // the camera/mic and their indicators.
  useEffect(() => {
    const r = roomRef.current;
    if (!r || r.state !== ConnectionState.Connected) return;

    const near = nearKey !== "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const apply = () => {
      const shouldPublish =
        (nearRef.current || forceRef.current) && !suppressRef.current;
      const cam = shouldPublish && cameraIntent.current;
      const mic = shouldPublish && micIntent.current;
      safe(
        r.localParticipant
          .setCameraEnabled(cam)
          .then(() => setMediaError(null))
          .catch(() => setMediaError("Allow camera/microphone to talk")),
      );
      safe(
        r.localParticipant
          .setMicrophoneEnabled(mic)
          .then(() => setMediaError(null))
          .catch(() => setMediaError("Allow camera/microphone to talk")),
      );
      setCameraOn(cam);
      setMicOn(mic);
    };

    if (near) {
      apply();
    } else {
      timer = setTimeout(() => {
        if (!nearRef.current) apply();
      }, EXIT_GRACE_MS);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [nearKey, room, connected]);

  // Focus rooms: any peer standing inside a focus pod stays muted on my side
  // unless they're my accepted focus partner. Set per-participant volume based
  // on the current mute policy so only `volumePeers` are audible.
  useEffect(() => {
    const r = roomRef.current;
    if (!r || r.state !== ConnectionState.Connected) return;
    r.remoteParticipants.forEach((p) => {
      const audible =
        !muteRemoteRef.current || volumePeersRef.current?.has(p.identity);
      p.setVolume(audible ? 1 : 0);
    });
  }, [room, connected, mute, volumePeers]);

  const toggleMic = useCallback(() => {
    micIntent.current = !micIntent.current;
    const near =
      (nearKeyRef.current !== "" || forceRef.current) && !suppressRef.current;
    setMicOn(micIntent.current && near);
    const r = roomRef.current;
    if (r && r.state === ConnectionState.Connected && near) {
      safe(
        r.localParticipant
          .setMicrophoneEnabled(micIntent.current)
          .then(() => setMediaError(null))
          .catch(() => setMediaError("Allow camera/microphone to talk")),
      );
    }
  }, []);

  const toggleCamera = useCallback(() => {
    cameraIntent.current = !cameraIntent.current;
    const near =
      (nearKeyRef.current !== "" || forceRef.current) && !suppressRef.current;
    setCameraOn(cameraIntent.current && near);
    const r = roomRef.current;
    if (r && r.state === ConnectionState.Connected && near) {
      safe(
        r.localParticipant
          .setCameraEnabled(cameraIntent.current)
          .then(() => setMediaError(null))
          .catch(() => setMediaError("Allow camera/microphone to talk")),
      );
    }
  }, []);

  const toggleShare = useCallback(() => {
    const next = !sharingRef.current;
    sharingRef.current = next;
    screenIntent.current = next;
    setSharing(next);
    const r = roomRef.current;
    if (r && r.state === ConnectionState.Connected) {
      safe(r.localParticipant.setScreenShareEnabled(next).catch(() => {}));
    }
  }, []);

  return {
    connected,
    connecting,
    error,
    mediaError,
    micOn,
    cameraOn,
    sharing,
    toggleMic,
    toggleCamera,
    toggleShare,
    room,
    visibleIds: nearIds,
  };
}
