import { useCallback, useEffect, useState } from "react";
import { http } from "@/lib/http";
import type { RealtimeClient } from "@/lib/realtime";

interface GitHubNotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
}

interface UseGitHubNotificationsOptions {
  workspaceId: string;
  client: RealtimeClient | null;
  enabled?: boolean;
}

interface UseGitHubNotificationsReturn {
  notifications: GitHubNotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const REFRESH_INTERVAL_MS = 30_000;

export function useGitHubNotifications({
  workspaceId,
  client,
  enabled = true,
}: UseGitHubNotificationsOptions): UseGitHubNotificationsReturn {
  const [notifications, setNotifications] = useState<GitHubNotificationItem[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const data = await http.github.notifications({
        unreadOnly: false,
        limit: 50,
      });
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, fetchNotifications]);

  // Set up realtime listeners — a workspace-wide nudge that triggers a refetch
  // so each viewer sees only their own (per-user) notification rows.
  useEffect(() => {
    if (!client || !workspaceId) return;

    const offs = [
      client.on("github.notification", () => {
        void fetchNotifications();
      }),
    ];

    return () => {
      offs.forEach((off) => off());
    };
  }, [client, workspaceId, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await http.github.markRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, readAt: new Date().toISOString() }
            : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore errors
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await http.github.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readAt: new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch {
      // Ignore errors
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh: fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
