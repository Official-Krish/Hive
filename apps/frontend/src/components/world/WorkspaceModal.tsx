import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiGithub, FiGrid, FiActivity, FiX } from "react-icons/fi";
import { http, type MapOverlay } from "@/lib/http";
import { useGitHubNotifications } from "@/hooks/useGitHubNotifications";
import type { RealtimeClient } from "@/lib/realtime";
import { formatTokens } from "./MapHud";
import { cn } from "@/lib/utils";

const EYEBROW =
  "text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-400";
const PILL =
  "rounded-lg bg-white px-3 py-2 ring-1 ring-black/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";

type TabId = "github" | "workspace" | "activity";

interface WorkspaceModalProps {
  workspaceId: string;
  myUserId: string;
  client: RealtimeClient | null;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function WorkspaceModal({
  workspaceId,
  myUserId,
  client,
  onClose,
}: WorkspaceModalProps) {
  const [tab, setTab] = useState<TabId>("github");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div className="flex h-[min(72vh,680px)] w-[min(620px,94vw)] flex-col overflow-hidden rounded-2xl bg-[#f4f2ed]/97 ring-1 ring-black/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_28px_60px_-24px_rgba(28,25,18,0.5)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-3">
          <div>
            <div className={EYEBROW}>Workspace</div>
            <div className="font-serif text-[15px] leading-tight text-neutral-900">
              Your desk
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close workspace"
            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-900"
          >
            <FiX className="size-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-black/[0.06] px-3 py-2">
          {(
            [
              ["github", "GitHub", FiGithub],
              ["workspace", "My workspace", FiGrid],
              ["activity", "Activity", FiActivity],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors",
                tab === id
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-600 hover:bg-black/[0.05]",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "github" && (
            <GitHubTab workspaceId={workspaceId} client={client} />
          )}
          {tab === "workspace" && (
            <WorkspaceTab workspaceId={workspaceId} myUserId={myUserId} />
          )}
          {tab === "activity" && <ActivityTab workspaceId={workspaceId} />}
        </div>
      </div>
    </div>
  );
}

function GitHubTab({
  workspaceId,
  client,
}: {
  workspaceId: string;
  client: RealtimeClient | null;
}) {
  const { notifications, isLoading, error, markAsRead } =
    useGitHubNotifications({ workspaceId, client });

  if (isLoading && notifications.length === 0) {
    return (
      <div className="py-10 text-center text-[12px] text-neutral-400">
        Loading GitHub notifications…
      </div>
    );
  }
  if (error && notifications.length === 0) {
    return (
      <div className="py-10 text-center text-[12px] text-rose-600">
        GitHub isn&apos;t connected yet.
      </div>
    );
  }
  if (notifications.length === 0) {
    return (
      <div className="py-10 text-center text-[12px] text-neutral-400">
        All caught up — no GitHub notifications.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {notifications.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => void markAsRead(n.id)}
          className={cn(
            "flex items-start gap-2.5 rounded-xl bg-white px-3 py-2 text-left ring-1 ring-black/[0.08] transition-colors hover:ring-black/[0.18]",
            !n.readAt && "bg-sky-50/70",
          )}
        >
          <span
            className={cn(
              "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
              n.readAt ? "bg-neutral-200" : "bg-sky-500",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-neutral-900">
              {n.title}
            </span>
            <span className="block truncate text-[11px] text-neutral-500">
              {n.type} · {timeAgo(n.createdAt)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function WorkspaceTab({
  workspaceId,
  myUserId,
}: {
  workspaceId: string;
  myUserId: string;
}) {
  const overlay = useQuery({
    queryKey: ["map-overlay-me", workspaceId, myUserId],
    queryFn: (): Promise<MapOverlay> =>
      http.reads.mapOverlay(workspaceId, myUserId),
    enabled: !!myUserId,
  });
  const data = overlay.data;

  if (overlay.isLoading && !data) {
    return (
      <div className="py-10 text-center text-[12px] text-neutral-400">
        Reading your workspace…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="py-10 text-center text-[12px] text-neutral-400">
        Nothing here yet.
      </div>
    );
  }

  const session = data.currentSession;
  const s = data.stats;
  return (
    <div className="flex flex-col gap-2">
      <div className={PILL}>
        <div className={EYEBROW}>Active session</div>
        {session ? (
          <div className="mt-1">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-neutral-900">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  session.status === "running"
                    ? "bg-emerald-500 animate-pulse"
                    : session.status === "blocked"
                      ? "bg-amber-500"
                      : "bg-neutral-300",
                )}
              />
              {session.title ?? "Agent session"}
            </div>
            <div className="mt-0.5 text-[11.5px] text-neutral-500">
              {session.agent.name} · {session.status}
              {session.branch ? ` · ${session.branch}` : ""}
            </div>
          </div>
        ) : (
          <div className="mt-1 text-[12.5px] text-neutral-500">
            No active session — chat with an agent to start one.
          </div>
        )}
      </div>

      <div className={PILL}>
        <div className={EYEBROW}>This session</div>
        <div className="mt-1 flex items-center gap-4 text-[12.5px] text-neutral-700">
          <span>
            <span className="font-semibold text-neutral-900">
              {formatTokens(data.inputTokens)}
            </span>{" "}
            in
          </span>
          <span>
            <span className="font-semibold text-neutral-900">
              {formatTokens(data.outputTokens)}
            </span>{" "}
            out
          </span>
          <span>
            <span className="font-semibold text-neutral-900">
              {data.costCents != null
                ? `$${(data.costCents / 100).toFixed(2)}`
                : "—"}
            </span>{" "}
            cost
          </span>
        </div>
      </div>

      {s && (
        <div className={PILL}>
          <div className={EYEBROW}>Today</div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[12.5px] text-neutral-700">
            <span>
              <span className="font-semibold text-neutral-900">
                {s.sessionsToday}
              </span>{" "}
              sessions
            </span>
            <span>
              <span className="font-semibold text-neutral-900">
                {Math.round(s.activeMinutesToday)}m
              </span>{" "}
              active
            </span>
            <span>
              <span className="font-semibold text-neutral-900">
                {s.testsPassedToday}
              </span>{" "}
              passed
            </span>
            <span>
              <span className="font-semibold text-neutral-900">
                {s.testsFailedToday}
              </span>{" "}
              failed
            </span>
            <span>
              <span className="font-semibold text-neutral-900">
                {s.costCentsToday != null
                  ? `$${(s.costCentsToday / 100).toFixed(2)}`
                  : "—"}
              </span>{" "}
              cost
            </span>
          </div>
          {s.modelMix && s.modelMix.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.modelMix.map((m) => (
                <span
                  key={m.model}
                  className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10.5px] text-neutral-600 ring-1 ring-black/[0.06]"
                >
                  {m.model} {Math.round(m.share * 100)}%
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityTab({ workspaceId }: { workspaceId: string }) {
  const activities = useQuery({
    queryKey: ["activities", workspaceId],
    queryFn: () => http.reads.activities(workspaceId, { pageSize: 10 }),
  });
  const items = activities.data?.items ?? [];

  if (activities.isLoading && items.length === 0) {
    return (
      <div className="py-10 text-center text-[12px] text-neutral-400">
        Loading activity…
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-[12px] text-neutral-400">
        No recent activity across the workspace.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((a) => (
        <div
          key={a.id}
          className="rounded-xl bg-white px-3 py-2 ring-1 ring-black/[0.08]"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-[13px] font-medium text-neutral-900">
              {a.title ?? a.activityType}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                a.status === "completed"
                  ? "bg-emerald-100 text-emerald-800"
                  : a.status === "in_progress"
                    ? "bg-sky-100 text-sky-800"
                    : "bg-neutral-100 text-neutral-600",
              )}
            >
              {a.status}
            </span>
          </div>
          {a.summary && (
            <div className="mt-0.5 line-clamp-2 text-[11.5px] text-neutral-500">
              {a.summary}
            </div>
          )}
          <div className="mt-1 text-[10.5px] text-neutral-400">
            {a.repository?.name ?? "Workspace"} · {timeAgo(a.startedAt)} ·{" "}
            {formatTokens(a.inputTokens)} in
          </div>
        </div>
      ))}
    </div>
  );
}
