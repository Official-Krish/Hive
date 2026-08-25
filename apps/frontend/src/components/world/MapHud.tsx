import { useMapOverlay, type MapAvatar } from "@/hooks/useRealtimeMap";
import { type MapOverlay } from "@/lib/http";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = {
  online: "bg-emerald-400",
  away: "bg-amber-400",
  offline: "bg-slate-500",
};

interface NearbyPanelProps {
  myUserId: string;
  avatars: ReadonlyMap<string, MapAvatar>;
  nearIds: ReadonlySet<string>;
  onPickMember: (developerId: string) => void;
}

/**
 * Floating HUD list of teammates within proximity radius. Each row shows the
 * cached avatar state; clicking opens the detail popup.
 */
export function NearbyPanel({
  myUserId,
  avatars,
  nearIds,
  onPickMember,
}: NearbyPanelProps) {
  const nearby: Array<[string, MapAvatar]> = [];
  for (const id of nearIds) {
    const a = avatars.get(id);
    if (a && id !== myUserId) nearby.push([id, a]);
  }

  if (nearby.length === 0) return null;

  return (
    <div className="pointer-events-auto absolute bottom-20 right-4 z-10 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl backdrop-blur-md">
      <div className="border-b border-white/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        Nearby
      </div>
      <ul className="divide-y divide-white/[0.05]">
        {nearby.map(([id, a]) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onPickMember(id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
            >
              <span
                className={cn(
                  "h-2 w-2 flex-shrink-0 rounded-full",
                  STATUS_COLOR[a.status ?? "online"] ?? "bg-sky-500",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-white">
                  {a.name || "Member"}
                </div>
                <div className="truncate text-[11.5px] text-slate-500">
                  {a.status === "away"
                    ? "Away"
                    : a.status === "offline"
                      ? "Offline"
                      : "Online"}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface MemberDetailPopupProps {
  workspaceId: string;
  myUserId: string;
  client: import("@/lib/realtime").RealtimeClient | null;
  developerId: string | null;
  onClose: () => void;
}

export function MemberDetailPopup({
  workspaceId,
  myUserId,
  client,
  developerId,
  onClose,
}: MemberDetailPopupProps) {
  if (!developerId) return null;
  return (
    <MemberDetailPopupInner
      workspaceId={workspaceId}
      myUserId={myUserId}
      client={client}
      developerId={developerId}
      onClose={onClose}
    />
  );
}

function MemberDetailPopupInner({
  workspaceId,
  myUserId,
  client,
  developerId,
  onClose,
}: {
  workspaceId: string;
  myUserId: string;
  client: import("@/lib/realtime").RealtimeClient | null;
  developerId: string;
  onClose: () => void;
}) {
  const overlay = useMapOverlay(workspaceId, developerId, client, true);

  const data: MapOverlay | undefined = overlay.data;
  const isMe = developerId === myUserId;

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-20 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {isMe ? "You" : (data?.developer.name ?? "Member")}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] text-slate-400 transition-colors hover:text-white"
        >
          Close
        </button>
      </div>
      <div className="space-y-3 px-4 py-3 text-[13px] text-slate-200">
        {overlay.isLoading && !data && (
          <div className="text-slate-400">Loading activity…</div>
        )}
        {data?.currentSession && (
          <div>
            <div className="text-[10.5px] uppercase tracking-widest text-slate-500">
              Current session
            </div>
            <div className="mt-0.5 font-medium text-white">
              {data.currentSession.title ?? "Untitled session"}
            </div>
            <div className="text-[12px] text-slate-400">
              {data.currentSession.agent.name} ·{" "}
              {data.currentSession.status ?? "running"}
            </div>
          </div>
        )}
        {data?.issue && (
          <div>
            <div className="text-[10.5px] uppercase tracking-widest text-slate-500">
              Linked issue
            </div>
            <div className="mt-0.5 text-white">
              #{data.issue.number} · {data.issue.title}
            </div>
            <div className="text-[12px] text-slate-400">{data.issue.state}</div>
          </div>
        )}
        {data && (data.inputTokens > 0 || data.outputTokens > 0) && (
          <div>
            <div className="text-[10.5px] uppercase tracking-widest text-slate-500">
              Tokens
            </div>
            <div className="mt-0.5 text-white">
              {formatTokens(data.inputTokens)} in ·{" "}
              {formatTokens(data.outputTokens)} out
              {data.costCents != null && (
                <span className="text-slate-400">
                  {" "}
                  · ${(data.costCents / 100).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}
        {!data?.currentSession && !data?.issue && data && (
          <div className="text-slate-400">No active activity right now.</div>
        )}
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
