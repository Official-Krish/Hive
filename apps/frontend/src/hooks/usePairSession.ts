import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, http } from "@/lib/http";
import type { RealtimeClient } from "@/lib/realtime";
import type { MapAvatar } from "@/hooks/useRealtimeMap";
import type { PairSession } from "@hive/types";
import { ROOM_KIND } from "@/components/world/office/layout";

interface UsePairSessionOptions {
  workspaceId: string;
  myUserId: string;
  /** My current room name — inactivity in pair rooms is the session lifecycle. */
  currentRoom: string;
  client: RealtimeClient | null;
  avatars: ReadonlyMap<string, MapAvatar>;
}

interface PairCursorEntry {
  x: number;
  y: number;
  at: number;
}

interface UsePairSessionResult {
  /** The active session I'm part of (null when none). */
  active: PairSession | null;
  /** True while the "start a pair session" modal should be open. */
  open: boolean;
  /** Someone else physically in my pair room I could pair with. */
  suggestedPartnerId: string | null;
  /** The modal is open because exactly two people are in this room. */
  canStart: boolean;
  begin: () => void;
  close: () => void;
  start: (repositoryId: string | null) => Promise<void>;
  end: () => Promise<void>;
  /** Live remote cursors keyed by developer id, within the active session. */
  peerCursors: ReadonlyMap<string, PairCursorEntry>;
  /** Report my pointer position to the active session (throttled ~20/s). */
  sendCursor: (x: number, y: number) => void;
}

const CURSOR_THROTTLE_MS = 50;

/**
 * Pair-programming rooms: when exactly two members stand inside a pair pod
 * (`ROOM_KIND === "pair"`) we offer a session that links a repository to the
 * room. Creating/ending is persisted via the sessions API and mirrored to the
 * workspace over `pair.session`; cursor positions flow over `pair.cursor`.
 */
export function usePairSession({
  workspaceId,
  myUserId,
  currentRoom,
  client,
  avatars,
}: UsePairSessionOptions): UsePairSessionResult {
  const inPairRoom = ROOM_KIND[currentRoom] === "pair";
  const [active, setActive] = useState<PairSession | null>(null);
  const [open, setOpen] = useState(false);

  const activeRef = useRef<PairSession | null>(null);
  activeRef.current = active;
  const currentRoomRef = useRef(currentRoom);
  currentRoomRef.current = currentRoom;
  const lastCursorSent = useRef(0);

  const suggestedPartnerId = useMemo(() => {
    if (!inPairRoom) return null;
    const inRoom: string[] = [];
    for (const [id, a] of avatars) {
      if (a.roomId === currentRoom) inRoom.push(id);
    }
    if (inRoom.length !== 2 || !inRoom.includes(myUserId)) return null;
    return inRoom.find((id) => id !== myUserId) ?? null;
  }, [inPairRoom, avatars, currentRoom, myUserId]);

  const canStart = !!suggestedPartnerId && !active && !open;

  /** Close the modal and any active session state I hold. */
  const close = useCallback(() => setOpen(false), []);

  const refreshActive = useCallback(async () => {
    try {
      const { session } = await http.pairSessions.active(workspaceId);
      if (session?.members.some((m) => m.userId === myUserId)) {
        setActive(session);
        setOpen(false);
      } else {
        setActive(null);
        if (session) setOpen(false);
      }
    } catch {
      /* transient — the realtime pair.session event resyncs */
    }
  }, [workspaceId, myUserId]);

  // Resync on reconnect/join and whenever my room changes.
  useEffect(() => {
    void refreshActive();
  }, [refreshActive, currentRoom]);

  // Auto-open the modal when two people occupy a pair room without a session.
  useEffect(() => {
    if (canStart && !currentRoomRef.current) return;
    if (canStart) setOpen(true);
  }, [canStart]);

  // Mirror session lifecycles broadcast by the backend (any tab, including the
  // pair partner's). Auto-join when the partner starts the session.
  useEffect(() => {
    if (!client) return;
    return client.on("pair.session", (e) => {
      const s = e.session;
      if (
        s.status === "active" &&
        s.members.some((m) => m.userId === myUserId)
      ) {
        setActive(s);
        setOpen(false);
      } else if (s.status === "ended") {
        setActive((prev) => (prev?.id === s.id ? null : prev));
      }
    });
  }, [client, myUserId]);

  // When I leave a pair room while an active session I started is running, end
  // it so the partner isn't stuck in a dead session.
  const prevRoomRef = useRef(currentRoom);
  useEffect(() => {
    const prev = prevRoomRef.current;
    prevRoomRef.current = currentRoom;
    if (!prev || prev === currentRoom) return;
    const session = activeRef.current;
    if (
      prev &&
      ROOM_KIND[prev] === "pair" &&
      session &&
      session.status === "active" &&
      session.members.some((m) => m.userId === myUserId)
    ) {
      void http.pairSessions
        .end(workspaceId, session.id)
        .then(() => setActive(null))
        .catch(() => setActive(null));
    }
  }, [currentRoom, workspaceId, myUserId]);

  const start = useCallback(
    async (repositoryId: string | null) => {
      const partner = suggestedPartnerId;
      if (!partner || activeRef.current) return;
      setOpen(false);
      try {
        const { session } = await http.pairSessions.create(workspaceId, {
          roomId: currentRoomRef.current,
          repositoryId,
          members: [myUserId, partner],
        });
        setActive(session);
      } catch (e) {
        if (e instanceof ApiError && e.code === "CONFLICT") {
          void refreshActive();
        }
      }
    },
    [workspaceId, myUserId, suggestedPartnerId, refreshActive],
  );

  const end = useCallback(async () => {
    const session = activeRef.current;
    if (!session || session.status !== "active") return;
    setActive(null);
    if (session.members.some((m) => m.userId === myUserId)) {
      await http.pairSessions
        .end(workspaceId, session.id)
        .catch(() => setActive(null));
    }
  }, [workspaceId, myUserId]);

  const sendCursor = useCallback(
    (x: number, y: number) => {
      const session = activeRef.current;
      if (!session || session.status !== "active") return;
      const now = Date.now();
      if (!client || now - lastCursorSent.current < CURSOR_THROTTLE_MS) return;
      lastCursorSent.current = now;
      client.sendPairCursor(session.id, x, y);
    },
    [client],
  );

  const [peerCursors, setPeerCursors] = useState<
    ReadonlyMap<string, PairCursorEntry>
  >(new Map());

  useEffect(() => {
    if (!client) return;
    return client.on("pair.cursor", (e) => {
      const session = activeRef.current;
      if (!session || session.id !== e.sessionId) return;
      if (e.developerId === myUserId) return;
      setPeerCursors((prev) => {
        const next = new Map(prev);
        next.set(e.developerId, { x: e.x, y: e.y, at: Date.now() });
        return next;
      });
    });
  }, [client, myUserId]);

  // Stop tracking cursors once the session is gone.
  useEffect(() => {
    if (!active) setPeerCursors(new Map());
  }, [active]);

  const begin = useCallback(() => setOpen(true), []);

  return {
    active,
    open,
    suggestedPartnerId,
    canStart,
    begin,
    close,
    start,
    end,
    peerCursors,
    sendCursor,
  };
}
