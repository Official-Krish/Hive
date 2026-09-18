import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { http, type AgentSessionSummary } from "@/lib/http";
import type { RealtimeClient } from "@/lib/realtime";
import { DCard, DError, DLoading, DModal, timeAgo } from "./chrome";

interface FleetModalProps {
  workspaceId: string;
  client: RealtimeClient | null;
  onClose: () => void;
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
    <DCard className="px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${STATUS_TONE[status] ?? "bg-neutral-400"} ${status === "running" ? "animate-pulse motion-reduce:animate-none" : ""}`}
        />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-neutral-900">
          {s.title || `${s.agent.name} session`}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-neutral-500">
          {timeAgo(s.startedAt)}
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
    </DCard>
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

  const sessions: AgentSessionSummary[] = live.data ?? [];

  return (
    <DModal
      eyebrow="AI Lab · live"
      title="Agent fleet"
      onClose={onClose}
      closeLabel="Close agent fleet"
    >
      <div className="flex-1 overflow-y-auto p-4">
        {live.isLoading ? (
          <DLoading>Scanning the lab…</DLoading>
        ) : live.isError ? (
          <DError retry={() => void live.refetch()}>
            Couldn&apos;t load the fleet board.
          </DError>
        ) : sessions.length === 0 ? (
          <DCard className="px-4 py-8 text-center">
            <div className="text-[14px] font-semibold text-neutral-900">
              Fleet idle
            </div>
            <p className="mx-auto mt-1 max-w-[280px] text-[12.5px] text-neutral-500">
              No running, blocked, or waiting sessions right now.
            </p>
          </DCard>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </div>
        )}
      </div>
    </DModal>
  );
}
