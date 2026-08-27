import { useCallback, useEffect, useRef, useState } from "react";
import { http } from "@/lib/http";
import type {
  ChatMessageDto,
  ConversationSummary,
} from "@hive/types";
import type { RealtimeClient } from "@/lib/realtime";

const TYPING_TTL_MS = 4_000;

export interface TypingState {
  /** conversationId -> userId -> last typing timestamp */
  at: Map<string, Map<string, number>>;
}

/**
 * World-map chat engine. Owns the conversation list, thread cache, unread
 * counts and typing indicators over the workspace WebSocket + REST history.
 */
export function useChat(
  workspaceId: string,
  myUserId: string,
  client: RealtimeClient | null,
  open: boolean,
) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(
    [],
  );
  const [threads, setThreads] = useState<Record<string, ChatMessageDto[]>>(
    {},
  );
  const [typing, setTyping] = useState<Record<string, Record<string, number>>>(
    {},
  );
  const activeIdRef = useRef<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const refreshList = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const list = await http.chat.list(workspaceId);
      setConversations(list);
    } catch {
      /* offline — panel shows retry on next tick */
    }
  }, [workspaceId]);

  const loadThread = useCallback(
    async (conversationId: string) => {
      try {
        const rows = await http.chat.messages(workspaceId, conversationId);
        setThreads((prev) => ({ ...prev, [conversationId]: rows }));
      } catch {
        /* ignore */
      }
    },
    [workspaceId],
  );

  const markRead = useCallback(
    async (conversationId: string) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
      );
      try {
        await http.chat.markRead(workspaceId, conversationId);
      } catch {
        /* ignore */
      }
    },
    [workspaceId],
  );

  const openThread = useCallback(
    (conversationId: string) => {
      activeIdRef.current = conversationId;
      if (!threads[conversationId]) void loadThread(conversationId);
      void markRead(conversationId);
    },
    [threads, loadThread, markRead],
  );

  const send = useCallback(
    (conversationId: string, body: string): boolean => {
      const trimmed = body.trim();
      if (!trimmed) return false;
      return (
        client?.sendChatMessage(
          conversationId,
          `${myUserId}-${Date.now()}`,
          trimmed,
        ) ?? false
      );
    },
    [client, myUserId],
  );

  const notifyTyping = useCallback(
    (conversationId: string) => {
      client?.sendTyping(conversationId);
    },
    [client],
  );

  // Initial + periodic list sync (covers missed events while socket was down).
  useEffect(() => {
    void refreshList();
    const t = setInterval(() => void refreshList(), 30_000);
    return () => clearInterval(t);
  }, [refreshList]);

  // Live events.
  useEffect(() => {
    if (!client || !workspaceId) return;

    const upsert = (conversationId: string, msg: ChatMessageDto) => {
      setThreads((prev) => {
        const existing = prev[conversationId] ?? [];
        if (existing.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [conversationId]: [...existing, msg] };
      });
    };

    const offs = [
      client.on("chat.message", (e) => {
        const dto: ChatMessageDto = {
          id: e.message.id,
          conversationId: e.conversationId,
          senderId: e.message.senderId,
          body: e.message.body,
          createdAt: e.message.createdAt,
        };
        upsert(e.conversationId, dto);

        // Clear optimistic echo marker handled by id equality above.
        const isActive =
          activeIdRef.current === e.conversationId && openRef.current;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === e.conversationId
              ? {
                  ...c,
                  lastMessage: {
                    body: dto.body,
                    senderId: dto.senderId,
                    createdAt: dto.createdAt,
                  },
                  updatedAt: dto.createdAt,
                  unreadCount:
                    dto.senderId === myUserId || isActive
                      ? c.unreadCount
                      : c.unreadCount + 1,
                }
              : c,
          ),
        );
        if (isActive) void markRead(e.conversationId);

        // A message in a conversation we don't know yet → refetch list.
        setConversations((prev) => {
          if (prev.some((c) => c.id === e.conversationId)) return prev;
          void refreshList();
          return prev;
        });
      }),
      client.on("chat.typing", (e) => {
        if (e.userId === myUserId) return;
        setTyping((prev) => ({
          ...prev,
          [e.conversationId]: {
            ...(prev[e.conversationId] ?? {}),
            [e.userId]: Date.now(),
          },
        }));
      }),
    ];
    const pruneTyping = setInterval(() => {
      const cutoff = Date.now() - TYPING_TTL_MS;
      setTyping((prev) => {
        let changed = false;
        const next: typeof prev = {};
        for (const [cid, users] of Object.entries(prev)) {
          const kept: Record<string, number> = {};
          for (const [uid, at] of Object.entries(users)) {
            if (at > cutoff) kept[uid] = at;
            else changed = true;
          }
          if (Object.keys(kept).length) next[cid] = kept;
        }
        return changed ? next : prev;
      });
    }, 2_000);

    return () => {
      offs.forEach((off) => off());
      clearInterval(pruneTyping);
    };
  }, [client, workspaceId, myUserId, refreshList, markRead]);

  const totalUnread = conversations.reduce(
    (acc, c) => acc + Math.min(c.unreadCount, 99),
    0,
  );

  return {
    conversations,
    threads,
    typing,
    totalUnread,
    refreshList,
    loadThread,
    openThread,
    send,
    notifyTyping,
  };
}
