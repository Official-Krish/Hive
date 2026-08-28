import { useState, useMemo, useRef, type ReactNode } from "react";
import {
  FiAlertTriangle,
  FiAtSign,
  FiBookOpen,
  FiCheckCircle,
  FiEye,
  FiGitMerge,
  FiGitPullRequest,
  FiMessageSquare,
  FiTag,
  FiXCircle,
} from "react-icons/fi";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGitHubNotifications } from "@/hooks/useGitHubNotifications";
import type { RealtimeClient } from "@/lib/realtime";
import { formatDistanceToNow } from "date-fns";

const PANEL =
  "absolute right-0 top-full mt-2 z-30 w-96 max-h-[500px] overflow-hidden " +
  "rounded-2xl bg-[#faf9f6] ring-1 ring-black/[0.08] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_24px_48px_-16px_rgba(28,25,18,0.4)] " +
  "backdrop-blur-sm";

const HEADER =
  "flex items-center justify-between border-b border-black/[0.07] px-4 py-2.5 " +
  "text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500";

const TYPE_ICONS: Record<string, ReactNode> = {
  ISSUE_ASSIGNED: <FiBookOpen className="size-3.5" />,
  ISSUE_COMMENT: <FiMessageSquare className="size-3.5" />,
  ISSUE_CLOSED: <FiCheckCircle className="size-3.5" />,
  PR_OPENED: <FiGitPullRequest className="size-3.5" />,
  PR_REVIEW_REQUESTED: <FiEye className="size-3.5" />,
  PR_REVIEW_SUBMITTED: <FiCheckCircle className="size-3.5" />,
  PR_MERGED: <FiGitMerge className="size-3.5" />,
  PR_CLOSED: <FiXCircle className="size-3.5" />,
  PR_COMMENT: <FiMessageSquare className="size-3.5" />,
  ISSUE_MENTION: <FiAtSign className="size-3.5" />,
  PR_REVIEW_COMMENT: <FiMessageSquare className="size-3.5" />,
  RELEASE_PUBLISHED: <FiTag className="size-3.5" />,
};

interface GitHubNotificationBellProps {
  workspaceId: string;
  client: RealtimeClient | null;
  onClose?: () => void;
}

export function GitHubNotificationBell({
  workspaceId,
  client,
  onClose,
}: GitHubNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useGitHubNotifications({
      workspaceId,
      client,
      enabled: true,
    });

  const handleNotificationClick = (notification: {
    id: string;
    payload: unknown;
    readAt: string | null;
  }) => {
    const payload = notification.payload as
      { url?: string; repository?: string } | undefined;
    const url =
      payload?.url ||
      (payload?.repository
        ? `https://github.com/${payload.repository}`
        : undefined);
    if (url) window.open(url, "_blank");
    if (!notification.readAt) {
      void markAsRead(notification.id);
    }
    if (onClose) onClose();
  };

  const grouped = useMemo(() => {
    const groups: Record<
      "Issues" | "Pull Requests" | "Reviews" | "Mentions" | "Other",
      typeof notifications
    > = {
      Issues: [],
      "Pull Requests": [],
      Reviews: [],
      Mentions: [],
      Other: [],
    };

    notifications.forEach((n) => {
      const type = n.type;
      if (type.startsWith("ISSUE")) groups["Issues"].push(n);
      else if (type.startsWith("PR_") && type.includes("REVIEW"))
        groups["Reviews"].push(n);
      else if (type.startsWith("PR_")) groups["Pull Requests"].push(n);
      else if (type === "ISSUE_MENTION") groups["Mentions"].push(n);
      else groups["Other"].push(n);
    });

    return Object.entries(groups)
      .filter(([, items]) => items.length > 0)
      .map(([label, items]) => ({ label, items }));
  }, [notifications]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative ${PANEL} px-3 py-2 transition-colors hover:bg-white/70`}
        aria-label="GitHub notifications"
      >
        <Bell className="size-5 text-neutral-700" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9.5px] font-bold text-white ring-2 ring-[#faf9f6]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="fixed top-16 right-4 z-30 w-96 max-h-[500px] overflow-hidden rounded-2xl bg-[#faf9f6] ring-1 ring-black/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_24px_40px_-16px_rgba(28,25,18,0.4)]">
            <div className={HEADER}>
              <span className="font-serif text-[11px] text-neutral-900">
                GitHub Notifications
              </span>
              <button
                onClick={() => setOpen(false)}
                className="flex size-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:text-neutral-900"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {grouped.length === 0 ? (
                <div className="p-6 text-center text-neutral-500 text-sm">
                  No notifications yet
                </div>
              ) : (
                <div className="divide-y divide-black/[0.05]">
                  {grouped.map(({ label, items }) => (
                    <div key={label} className="border-t border-black/[0.05]">
                      <div className="px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                        {label}
                      </div>
                      <ul className="divide-y divide-black/[0.04]">
                        {items.map((n) => (
                          <li
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={cn(
                              "px-4 py-3 hover:bg-neutral-50 transition-colors",
                              !n.readAt && "bg-amber-50/50",
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <span className="flex items-center gap-1.5">
                                <span className="size-4">
                                  {TYPE_ICONS[n.type] ?? (
                                    <FiAlertTriangle className="size-4" />
                                  )}
                                </span>
                                <div>
                                  <p className="truncate text-[13px] font-medium text-neutral-900">
                                    {n.title}
                                  </p>
                                  <p className="truncate text-[12px] text-neutral-500">
                                    {n.body}
                                  </p>
                                </div>
                              </span>
                              <span className="text-[10px] text-neutral-400 whitespace-nowrap">
                                {formatDistanceToNow(new Date(n.createdAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            {!n.readAt && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-black/[0.07] px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => void markAllAsRead()}
                    className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
                  >
                    Mark all as read
                  </button>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                    {notifications.length} total
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
