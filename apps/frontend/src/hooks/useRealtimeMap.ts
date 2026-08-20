import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimeMember } from "@hive/types";
import { http } from "@/lib/http";
import { RealtimeClient } from "@/lib/realtime";

export interface MapAvatar {
  developerId: string;
  name: string;
  avatarUrl: string | null;
  status: RealtimeMember["status"];
  x: number;
  y: number;
  roomId: string | null;
}

export interface MapPosition {
  x: number;
  y: number;
  roomId: string | null;
}

const DEFAULT_RADIUS = 80;
const MOVE_THROTTLE_MS = 50;

export interface UseRealtimeMapOptions {
  radius?: number;
  url?: string;
}

/**
 * Owns the workspace WebSocket connection, keeps a live avatar map from
 * realtime events, and tracks which other developers' avatars are within
 * `radius` of the current user's position.
 */
export function useRealtimeMap(
  workspaceId: string,
  myUserId: string,
  options: UseRealtimeMapOptions = {},
): {
  client: RealtimeClient | null;
  avatars: ReadonlyMap<string, MapAvatar>;
  nearIds: ReadonlySet<string>;
  connectionStatus: string;
  myPosition: MapPosition;
  setMyPosition: (x: number, y: number, roomId: string | null) => void;
  setMyPresence: (status: "online" | "away") => void;
} {
  const [client, setClient] = useState<RealtimeClient | null>(null);
  const [avatars, setAvatars] = useState<ReadonlyMap<string, MapAvatar>>(
    new Map(),
  );
  const [nearIds, setNearIds] = useState<ReadonlySet<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState("closed");
  const [myPosition, setMyPositionState] = useState<MapPosition>({
    x: 0,
    y: 0,
    roomId: null,
  });

  const clientRef = useRef<RealtimeClient | null>(null);
  const avatarsRef = useRef<Map<string, MapAvatar>>(new Map());
  const myPosRef = useRef<MapPosition>({ x: 0, y: 0, roomId: null });
  const radiusRef = useRef(options.radius ?? DEFAULT_RADIUS);
  const myIdRef = useRef(myUserId);
  const lastSendRef = useRef(0);

  radiusRef.current = options.radius ?? DEFAULT_RADIUS;
  myIdRef.current = myUserId;

  const recomputeNear = useCallback(() => {
    const me = myPosRef.current;
    const near = new Set<string>();
    for (const [id, avatar] of avatarsRef.current) {
      if (id === myIdRef.current) continue;
      const dx = avatar.x - me.x;
      const dy = avatar.y - me.y;
      if (Math.hypot(dx, dy) <= radiusRef.current) near.add(id);
    }
    setNearIds(near);
  }, []);

  const setMyPosition = useCallback(
    (x: number, y: number, roomId: string | null) => {
      myPosRef.current = { x, y, roomId };
      setMyPositionState({ x, y, roomId });

      const selfId = myIdRef.current;
      const mine = avatarsRef.current.get(selfId);
      if (mine) {
        const next = new Map(avatarsRef.current);
        next.set(selfId, { ...mine, x, y, roomId });
        avatarsRef.current = next;
        setAvatars(next);
      }

      const socket = clientRef.current;
      if (socket) {
        const now = Date.now();
        if (now - lastSendRef.current >= MOVE_THROTTLE_MS) {
          lastSendRef.current = now;
          socket.sendAvatarMove(x, y, roomId);
        }
      }
      recomputeNear();
    },
    [recomputeNear],
  );

  const setMyPresence = useCallback((status: "online" | "away") => {
    clientRef.current?.sendPresence(status);
  }, []);

  useEffect(() => {
    const socket = new RealtimeClient(workspaceId, options.url);
    clientRef.current = socket;
    setClient(socket);

    const unsubscribe = [
      socket.onStatusChange((status) => setConnectionStatus(status)),
      socket.on("hello", (event) => {
        const next = new Map(avatarsRef.current);
        for (const member of event.members) {
          next.set(member.userId, {
            developerId: member.userId,
            name: member.name,
            avatarUrl: member.avatarUrl,
            status: member.status,
            x: member.position?.x ?? 0,
            y: member.position?.y ?? 0,
            roomId: member.position?.roomId ?? null,
          });
        }
        avatarsRef.current = next;
        setAvatars(next);
        recomputeNear();
      }),
      socket.on("presence.changed", (event) => {
        const current = avatarsRef.current.get(event.developerId);
        if (!current) return;
        const next = new Map(avatarsRef.current);
        next.set(event.developerId, { ...current, status: event.status });
        avatarsRef.current = next;
        setAvatars(next);
      }),
      socket.on("avatar.moved", (event) => {
        const current = avatarsRef.current.get(event.developerId);
        const next = new Map(avatarsRef.current);
        next.set(event.developerId, {
          developerId: event.developerId,
          name: current?.name ?? "",
          avatarUrl: current?.avatarUrl ?? null,
          status: current?.status ?? "online",
          x: event.x,
          y: event.y,
          roomId: event.roomId,
        });
        avatarsRef.current = next;
        setAvatars(next);
        recomputeNear();
      }),
    ];

    socket.connect();

    return () => {
      unsubscribe.forEach((off) => off());
      socket.disconnect();
      clientRef.current = null;
      setClient(null);
    };
  }, [workspaceId, options.url]);

  return {
    client,
    avatars,
    nearIds,
    connectionStatus,
    myPosition,
    setMyPosition,
    setMyPresence,
  };
}

/**
 * Fetches a developer's live overlay (current session, linked issue, token
 * rollup) and refetches it whenever realtime events for that developer fire.
 * Pass the same `RealtimeClient` instance returned by `useRealtimeMap`.
 */
export function useMapOverlay(
  workspaceId: string,
  developerId: string,
  client: RealtimeClient | null,
  enabled = true,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["mapOverlay", workspaceId, developerId],
    queryFn: () => http.reads.mapOverlay(workspaceId, developerId),
    enabled: enabled && client !== null,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!client) return;
    const invalidate = () =>
      queryClient.invalidateQueries({
        queryKey: ["mapOverlay", workspaceId, developerId],
      });
    const unsubscribe = [
      client.on("agent.started", (event) => {
        if (event.developerId === developerId) invalidate();
      }),
      client.on("agent.stopped", (event) => {
        if (event.developerId === developerId) invalidate();
      }),
      client.on("activity.updated", (event) => {
        if (event.developerId === developerId) invalidate();
      }),
    ];
    return () => unsubscribe.forEach((off) => off());
  }, [client, workspaceId, developerId, queryClient]);

  return query;
}
