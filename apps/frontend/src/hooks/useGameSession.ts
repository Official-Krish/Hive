import { useCallback, useEffect, useState } from "react";
import { ApiError, http } from "@/lib/http";
import type { RealtimeClient } from "@/lib/realtime";
import type { GameKind, GameMove, GameSession } from "@hive/types";

interface UseGameSessionOptions {
  workspaceId: string;
  myUserId: string;
  client: RealtimeClient | null;
}

export interface UseGameSessionResult {
  /** Live matches in the workspace (the arcade lobby list). */
  sessions: GameSession[];
  /** My active match, if any. */
  active: GameSession | null;
  /** Pending invite where I hold the second seat. */
  pendingInvite: GameSession | null;
  /** All pending invites where I hold the second seat (the inbox list). */
  pendingInvites: GameSession[];
  /** Currently opened match id (board view), null on the lobby list. */
  openId: string | null;
  /** Last server rejection reason (cleared on next move). */
  rejected: string | null;
  /** Last lobby action failure (create/accept/decline/resign). */
  actionError: string | null;
  refresh: () => Promise<void>;
  open: (id: string | null) => void;
  create: (kind: GameKind, opponentId: string) => Promise<GameSession | null>;
  accept: (id: string) => Promise<void>;
  decline: (id: string) => Promise<void>;
  resign: (id: string) => Promise<void>;
  sendMove: (id: string, move: GameMove) => void;
}

/**
 * Arcade matches: lobby list + server-authoritative moves. The backend owns
 * turn order, legality, and results; this hook mirrors `game.state` events
 * into local state and forwards intents over `game.move`.
 */
export function useGameSession({
  workspaceId,
  myUserId,
  client,
}: UseGameSessionOptions): UseGameSessionResult {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fail = (e: unknown, fallback: string): null => {
    setActionError(e instanceof ApiError ? e.message : fallback);
    return null;
  };

  const active =
    sessions.find(
      (s) =>
        s.status === "active" && s.members.some((m) => m.userId === myUserId),
    ) ?? null;

  const pendingInvite =
    sessions.find(
      (s) =>
        s.status === "pending" &&
        s.members.some((m) => m.userId === myUserId && m.seat === "second"),
    ) ?? null;

  const pendingInvites = sessions.filter(
    (s) =>
      s.status === "pending" &&
      s.members.some((m) => m.userId === myUserId && m.seat === "second"),
  );

  const refresh = useCallback(async () => {
    try {
      const { sessions } = await http.games.list(workspaceId);
      setSessions(sessions);
    } catch {
      /* transient — game.state events resync */
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!client) return;
    const offState = client.on("game.state", (e) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== e.session.id);
        if (e.session.status !== "finished") {
          // Pending invites and live games always join the list in real time.
          next.unshift(e.session);
        } else {
          // Finished matches stay visible with their result if already open.
          const known = prev.some((s) => s.id === e.session.id);
          if (known) next.unshift(e.session);
        }
        return next;
      });
    });
    const offRejected = client.on("game.move.rejected", (e) => {
      setRejected(e.reason);
    });
    return () => {
      offState();
      offRejected();
    };
  }, [client]);

  const open = useCallback((id: string | null) => {
    setRejected(null);
    setOpenId(id);
  }, []);

  const create = useCallback(
    async (kind: GameKind, opponentId: string): Promise<GameSession | null> => {
      setActionError(null);
      try {
        const { session } = await http.games.create(workspaceId, {
          kind,
          opponentId,
        });
        setSessions((prev) => [
          session,
          ...prev.filter((s) => s.id !== session.id),
        ]);
        setOpenId(session.id);
        return session;
      } catch (e) {
        await refresh();
        return fail(e, "Could not send the invite");
      }
    },
    [workspaceId, refresh],
  );

  const resign = useCallback(
    async (id: string) => {
      setActionError(null);
      try {
        await http.games.resign(workspaceId, id);
      } catch (e) {
        fail(e, "Could not resign the match");
        await refresh();
      }
    },
    [workspaceId, refresh],
  );

  const accept = useCallback(
    async (id: string) => {
      setActionError(null);
      try {
        const { session } = await http.games.accept(workspaceId, id);
        setSessions((prev) => [
          session,
          ...prev.filter((s) => s.id !== session.id),
        ]);
        setOpenId(session.id);
      } catch (e) {
        fail(e, "Could not accept the invite");
        await refresh();
      }
    },
    [workspaceId, refresh],
  );

  const decline = useCallback(
    async (id: string) => {
      setActionError(null);
      try {
        await http.games.decline(workspaceId, id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } catch (e) {
        fail(e, "Could not decline the invite");
        await refresh();
      }
    },
    [workspaceId, refresh],
  );

  const sendMove = useCallback(
    (id: string, move: GameMove) => {
      setRejected(null);
      client?.sendGameMove(id, move);
    },
    [client],
  );

  return {
    sessions,
    active,
    pendingInvite,
    pendingInvites,
    openId,
    rejected,
    actionError,
    refresh,
    open,
    create,
    accept,
    decline,
    resign,
    sendMove,
  };
}
