import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState, Room, RoomEvent } from "livekit-client";
import { ApiError, http } from "@/lib/http";

export interface LiveKitCallState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  mediaError: string | null;
  micOn: boolean;
  cameraOn: boolean;
  toggleMic: () => void;
  toggleCamera: () => void;
  room: Room | null;
  visibleIds: ReadonlySet<string>;
}

/* Token TTL is 6h; refresh ~10 min before expiry so long calls don't drop. */
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const TOKEN_REFRESH_MS = TOKEN_TTL_MS - 10 * 60 * 1000;

const safe = (p: Promise<unknown>): void => {
  p.catch(() => {});
};

export function useLiveKitCall(
  workspaceId: string,
  myUserId: string,
  nearIds: ReadonlySet<string>,
  onlineCount: number,
): LiveKitCallState {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);

  const roomRef = useRef<Room | null>(null);
  const micIntent = useRef(true);
  const cameraIntent = useRef(true);
  const nearKeyRef = useRef("");

  const nearKey = [...nearIds].sort().join(",");
  nearKeyRef.current = nearKey;

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
  useEffect(() => {
    const r = roomRef.current;
    if (!r || r.state !== ConnectionState.Connected) return;

    const ids = nearKey ? nearKey.split(",") : [];

    const near = ids.length > 0;
    const cam = near && cameraIntent.current;
    const mic = near && micIntent.current;
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
  }, [nearKey, room, connected]);

  const toggleMic = useCallback(() => {
    micIntent.current = !micIntent.current;
    const near = nearKeyRef.current !== "";
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
    const near = nearKeyRef.current !== "";
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

  return {
    connected,
    connecting,
    error,
    mediaError,
    micOn,
    cameraOn,
    toggleMic,
    toggleCamera,
    room,
    visibleIds: nearIds,
  };
}
