import { useState, useMemo, useEffect, type ReactNode } from "react";
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
import { DIconBtn, EYEBROW, useDismiss } from "./chrome";

const TYPE_ICONS: Record<string, ReactNode> = {
  ISSUE_MENTION: <FiAtSign className="size-3.5" />,
  ISSUE_ASSIGNED: <FiBookOpen className="size-3.5" />,
  ISSUE_COMMENT: <FiMessageSquare className="size-3.5" />,
  ISSUE_CLOSED: <FiCheckCircle className="size-3.5" />,
  PR_OPENED: <FiGitPullRequest className="size-3.5" />,
  PR_REVIEW_REQUESTED: <FiEye className="size-3.5" />,
  PR_REVIEW_SUBMITTED: <FiCheckCircle className="size-3.5" />,
  PR_REVIEW_COMMENT: <FiMessageSquare className="size-3.5" />,
  PR_MERGED: <FiGitMerge className="size-3.5" />,
  PR_CLOSED: <FiXCircle className="size-3.5" />,
  PR_COMMENT: <FiMessageSquare className="size-3.5" />,
  RELEASE_PUBLISHED: <FiTag className="size-3.5" />,
};

function groupOf(type: string): string {
  if (type === "ISSUE_MENTION") return "Mentions";
  if (type.startsWith("ISSUE")) return "Issues";
  if (type.startsWith("PR_") && type.includes("REVIEW")) return "Reviews";
  if (type.startsWith("PR_")) return "Pull Requests";
  return "Other";
}

function timeLabel(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  try {
    return formatDistanceToNow(new Date(d), { addSuffix: true });
  } catch {
    return "";
  }
}

interface GitHubNotificationBellProps {
  workspaceId: string;
  client: RealtimeClient | null;
  onClose?: () => void;
  /** Fires whenever the dropdown opens/closes so the host can dodge it. */
  onOpenChange?: (open: boolean) => void;
}

export function GitHubNotificationBell({
  workspaceId,
  client,
  onClose,
  onOpenChange,
}: GitHubNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useDismiss<HTMLDivElement>(() => setOpen(false));

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

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
    if (url) window.open(url, "_blank", "noopener");
    if (!notification.readAt) {
      void markAsRead(notification.id);
    }
    if (onClose) onClose();
  };

  const grouped = useMemo(() => {
    const groups: Record<string, typeof notifications> = {
      Issues: [],
      "Pull Requests": [],
      Reviews: [],
      Mentions: [],
      Other: [],
    };
    for (const n of notifications) groups[groupOf(n.type)]!.push(n);
    return Object.entries(groups)
      .filter(([, items]) => items.length > 0)
      .map(([label, items]) => ({ label, items }));
  }, [notifications]);

  return (
    <div className="relative">
      <DIconBtn
        label="GitHub notifications"
        onClick={() => setOpen((v) => !v)}
        active={open}
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9.5px] font-bold text-white ring-2 ring-[#faf9f6]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DIconBtn>

      {open && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-label="GitHub notifications"
            className="fixed top-16 right-4 z-30 flex max-h-[500px] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-[#f4f2ed]/98 ring-1 ring-black/[0.09] backdrop-blur-md"
          >
            <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-2.5">
              <span className={EYEBROW}>GitHub notifications</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="flex size-7 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-900"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {grouped.length === 0 ? (
                <div className="p-6 text-center text-sm text-neutral-500">
                  No notifications yet
                </div>
              ) : (
                <div className="divide-y divide-black/[0.05]">
                  {grouped.map(({ label, items }) => (
                    <div key={label}>
                      <div className="px-4 pb-1 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                        {label}
                      </div>
                      <ul className="divide-y divide-black/[0.04]">
                        {items.map((n) => (
                          <li key={n.id} className="relative">
                            <button
                              type="button"
                              onClick={() => handleNotificationClick(n)}
                              className={cn(
                                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.03]",
                                !n.readAt && "bg-amber-50/60",
                              )}
                            >
                              <span className="mt-0.5 shrink-0 text-neutral-500">
                                {TYPE_ICONS[n.type] ?? (
                                  <FiAlertTriangle className="size-3.5" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium text-neutral-900">
                                  {n.title}
                                </span>
                                <span className="block truncate text-[12px] text-neutral-500">
                                  {n.body}
                                </span>
                              </span>
                              <span className="flex-shrink-0 whitespace-nowrap text-[10px] tabular-nums text-neutral-400">
                                {timeLabel(n.createdAt)}
                              </span>
                            </button>
                            {!n.readAt && (
                              <span
                                aria-hidden
                                className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-emerald-500"
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-black/[0.07] px-4 py-2.5">
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                disabled={unreadCount === 0}
                className="text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900 disabled:opacity-40"
              >
                Mark all as read
              </button>
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {notifications.length} total
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
