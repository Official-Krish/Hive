import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { http, type AgentSessionSummary } from "@/lib/http";
import type { RealtimeClient } from "@/lib/realtime";

interface FleetModalProps {
  workspaceId: string;
  client: RealtimeClient | null;
  onClose: () => void;
}

function ago(iso: string): string {
  const s = Math.max(
    1,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function fmtMoney(cents: number | null): string {
  return cents === null ? "—" : `$${(cents / 100).toFixed(2)}`;
}

const STATUS_TONE: Record<string, string> = {
  running: "bg-emerald-500",
  blocked: "bg-amber-500",
  waiting_approval: "bg-rose-500",
};

function SessionRow({ s }: { s: AgentSessionSummary }) {
  const status = (s.status ?? "running").toLowerCase();
  return (
    <div className="rounded-2xl bg-white px-3.5 py-3 ring-1 ring-black/[0.07]">
      <div className="flex items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${STATUS_TONE[status] ?? "bg-neutral-400"} ${status === "running" ? "animate-pulse" : ""}`}
        />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-neutral-900">
          {s.title || `${s.agent.name} session`}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-neutral-400">
          {ago(s.startedAt)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] font-medium text-neutral-500">
        <span>{s.developer.name}</span>
        <span aria-hidden>·</span>
        <span>
          {s.agent.name}
          {s.agent.model ? ` · ${s.agent.model}` : ""}
        </span>
        <span aria-hidden>·</span>
        <span className="font-mono">{fmtMoney(s.costCents)}</span>
        {s.branch && (
          <>
            <span aria-hidden>·</span>
            <span className="font-mono">{s.branch}</span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * AI Lab fleet board: live agent sessions across the workspace, grouped by
 * status. Stuck sessions (blocked / waiting approval) surface first.
 */
export function FleetModal({ workspaceId, client, onClose }: FleetModalProps) {
  const live = useQuery({
    queryKey: ["fleet", workspaceId],
    queryFn: async () => {
      const [running, blocked, waiting] = await Promise.all([
        http.reads.sessions(workspaceId, { status: "running", pageSize: 20 }),
        http.reads.sessions(workspaceId, { status: "blocked", pageSize: 20 }),
        http.reads.sessions(workspaceId, {
          status: "waiting_approval",
          pageSize: 20,
        }),
      ]);
      return [...waiting.items, ...blocked.items, ...running.items];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!client) return;
    const refetch = (): void => {
      void live.refetch();
    };
    const offs = [
      client.on("agent.started", refetch),
      client.on("agent.stopped", refetch),
      client.on("agent.status", refetch),
    ];
    return () => offs.forEach((off) => off());
  }, [client, live.refetch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sessions: AgentSessionSummary[] = live.data ?? [];

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[min(86vh,620px)] w-[min(480px,96vw)] flex-col overflow-hidden rounded-2xl bg-[#f4f2ed] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.09]">
        <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              AI Lab · live
            </div>
            <div className="text-[15px] font-semibold tracking-tight text-neutral-900">
              Agent fleet
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close agent fleet"
            className="rounded-lg px-2 py-1 text-[13px] font-semibold text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-900"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {live.isLoading ? (
            <div className="py-6 text-center text-[13px] text-neutral-500">
              Scanning the lab…
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl bg-white px-4 py-8 text-center ring-1 ring-black/[0.07]">
              <div className="text-[14px] font-semibold text-neutral-900">
                Fleet idle
              </div>
              <p className="mx-auto mt-1 max-w-[280px] text-[12.5px] text-neutral-500">
                No running, blocked, or waiting sessions right now.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map((s) => (
                <SessionRow key={s.id} s={s} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
