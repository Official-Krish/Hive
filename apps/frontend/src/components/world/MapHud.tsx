import { useEffect, useState } from "react";
import { Check, X, Zap } from "lucide-react";
import { useMapOverlay } from "@/hooks/useRealtimeMap";
import { type MapOverlay } from "@/lib/http";
import { formatDuration, formatTokens, statusLabel, timeAgo } from "./chrome";
import { cn } from "@/lib/utils";

const LABEL =
  "text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500";

const MIX_COLORS = [
  "bg-emerald-600",
  "bg-sky-500",
  "bg-violet-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-neutral-300",
];
const MIX_DOTS = [...MIX_COLORS];

interface MemberDetailPopupProps {
  workspaceId: string;
  myUserId: string;
  client: import("@/lib/realtime").RealtimeClient | null;
  developerId: string | null;
  onClose: () => void;
}

/**
 * Centered member modal — everything the backend knows about a teammate's
 * current work: live session, linked issue, project, and AI token spend.
 */
export function MemberDetailPopup({
  workspaceId,
  myUserId,
  client,
  developerId,
  onClose,
}: MemberDetailPopupProps) {
  useEffect(() => {
    if (!developerId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [developerId, onClose]);

  if (!developerId) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/25 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Member details"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-[#f4f2ed] ring-1 ring-black/[0.08]"
      >
        <MemberModalInner
          workspaceId={workspaceId}
          myUserId={myUserId}
          client={client}
          developerId={developerId}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

function MemberModalInner({
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
  const title = isMe ? "You" : (data?.developer.name ?? "Member");

  // Live session-duration ticker.
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const session = data?.currentSession ?? null;
  const stats = data?.stats ?? null;
  const status = data?.developer.status ?? null;

  return (
    <div>
      {/* header */}
      <div className="flex items-center gap-3 border-b border-black/[0.07] px-5 py-3.5">
        {data?.developer.avatarUrl ? (
          <img
            src={data.developer.avatarUrl}
            alt=""
            className="size-9 flex-shrink-0 rounded-full object-cover ring-1 ring-black/[0.08]"
          />
        ) : (
          <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[15px] font-medium text-neutral-700 ring-1 ring-black/[0.08]">
            {(data?.developer.name ?? title).charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold leading-tight tracking-tight text-neutral-900">
            {title}
          </div>
          <div className="truncate text-[11.5px] text-neutral-500">
            {statusLabel(status)}
            {data?.developer.label ? ` · ${data.developer.label}` : ""}
            {data?.developer.email && !isMe ? ` · ${data.developer.email}` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close member details"
          className="flex size-8 flex-shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-950"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* body */}
      <div className="space-y-5 px-5 py-4 text-[13px]">
        {overlay.isLoading && !data && !overlay.error && (
          <div className="flex items-center gap-2.5 py-2 text-neutral-500">
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-black/[0.09] border-t-neutral-900" />
            Loading activity…
          </div>
        )}
        {overlay.error && !data && (
          <div className="rounded-lg border border-rose-400/25 bg-rose-500/[0.07] px-3.5 py-3 text-[13px] text-rose-100/90">
            Couldn't load this member's activity.{" "}
            <button
              type="button"
              onClick={() => overlay.refetch?.()}
              className="font-semibold text-rose-700 underline underline-offset-2 hover:text-neutral-950"
            >
              Retry
            </button>
          </div>
        )}

        {data?.developer.workingOn && (
          <section>
            <div className={LABEL}>Working on</div>
            <div className="mt-1 flex items-center gap-1.5 font-medium text-neutral-700">
              <Zap className="size-3.5 shrink-0 text-violet-600" />
              <span className="min-w-0 truncate">
                {data.developer.workingOn}
              </span>
            </div>
          </section>
        )}

        {data?.project && (
          <section>
            <div className={LABEL}>Project</div>
            <div className="mt-1 truncate font-mono text-[12px] text-neutral-700">
              {data.project}
            </div>
          </section>
        )}

        {session ? (
          <section>
            <div className={LABEL}>Current session</div>
            <div className="mt-1.5 font-medium leading-snug text-neutral-800">
              {session.title ?? "Untitled session"}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-neutral-500">
              <span className="rounded-full bg-black/[0.04] px-2 py-0.5 font-medium capitalize text-neutral-700 ring-1 ring-black/[0.08]">
                {session.agent.name}
              </span>
              {session.agent.model && (
                <span className="font-mono text-[10.5px] lowercase">
                  {session.agent.model}
                </span>
              )}
              {session.branch && (
                <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10.5px] lowercase text-neutral-500 ring-1 ring-black/[0.08]">
                  {session.branch}
                </span>
              )}
              <span aria-hidden>·</span>
              <span className="capitalize">{session.status ?? "running"}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">
                running{" "}
                {formatDuration(
                  Date.now() - new Date(session.startedAt).getTime(),
                )}
              </span>
            </div>
          </section>
        ) : (
          data && (
            <div className="text-[12.5px] text-neutral-500">
              No active session right now.
            </div>
          )
        )}

        {data?.issue && (
          <section>
            <div className={LABEL}>Linked issue</div>
            <div className="mt-1.5 font-medium text-neutral-800">
              #{data.issue.number} · {data.issue.title}
            </div>
            <div className="mt-0.5 text-[11.5px] capitalize text-neutral-500">
              {data.issue.state}
            </div>
          </section>
        )}

        {data && (
          <section>
            <div className={LABEL}>AI tokens</div>
            <div className="mt-1.5 flex items-baseline gap-2 text-[22px] font-semibold leading-none tabular-nums text-neutral-900">
              {formatTokens(data.inputTokens)}
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                in
              </span>
              <span className="text-neutral-300">/</span>
              {formatTokens(data.outputTokens)}
              <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                out
              </span>
              {data.costCents != null && (
                <span className="ml-auto rounded-full bg-black/[0.04] px-2.5 py-1 text-[12px] font-semibold text-neutral-800 ring-1 ring-black/[0.08]">
                  ${(data.costCents / 100).toFixed(2)}
                </span>
              )}
            </div>

            {stats?.modelMix && stats.modelMix.length > 0 && (
              <div className="mt-3">
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-black/[0.04]">
                  {(() => {
                    const total = stats.modelMix.reduce(
                      (a, m) => a + m.share,
                      0,
                    );
                    return stats.modelMix.map((m, i) => (
                      <div
                        key={m.model}
                        className={MIX_COLORS[i % MIX_COLORS.length]}
                        style={{
                          width: `${Math.max(3, (m.share / (total || 1)) * 100)}%`,
                        }}
                      />
                    ));
                  })()}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {stats.modelMix.map((m, i) => (
                    <span
                      key={m.model}
                      className="flex items-center gap-1 font-mono text-[10px] lowercase text-neutral-500"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          MIX_DOTS[i % MIX_DOTS.length],
                        )}
                      />
                      {m.model} · {Math.round(m.share * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {stats &&
          (stats.sessionsToday > 0 ||
            stats.testsPassedToday > 0 ||
            stats.testsFailedToday > 0) && (
            <section>
              <div className={LABEL}>Today</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] tabular-nums text-neutral-600">
                <span>
                  <span className="font-semibold text-neutral-800">
                    {stats.sessionsToday}
                  </span>{" "}
                  session{stats.sessionsToday === 1 ? "" : "s"}
                </span>
                <span className="h-3 w-px bg-black/[0.05]" aria-hidden />
                <span>
                  <span className="font-semibold text-neutral-800">
                    {formatDuration(stats.activeMinutesToday * 60_000)}
                  </span>{" "}
                  active
                </span>
                {(stats.testsPassedToday > 0 || stats.testsFailedToday > 0) && (
                  <>
                    <span className="h-3 w-px bg-black/[0.05]" aria-hidden />
                    <span className="flex items-center gap-0.5 text-emerald-700">
                      {stats.testsPassedToday}
                      <Check className="size-3" />
                    </span>
                    {stats.testsFailedToday > 0 && (
                      <span className="flex items-center gap-0.5 text-rose-700">
                        {stats.testsFailedToday}
                        <X className="size-3" />
                      </span>
                    )}
                    <span className="text-neutral-500">tests</span>
                  </>
                )}
                {stats.costCentsToday != null && stats.costCentsToday > 0 && (
                  <>
                    <span className="h-3 w-px bg-black/[0.05]" aria-hidden />
                    <span className="font-semibold text-neutral-800">
                      ${(stats.costCentsToday / 100).toFixed(2)}
                    </span>
                    <span className="text-neutral-500">today</span>
                  </>
                )}
              </div>
            </section>
          )}

        {stats?.recentEvents && stats.recentEvents.length > 0 && (
          <section>
            <div className={LABEL}>Live</div>
            <ul className="mt-1.5 space-y-1">
              {stats.recentEvents.map((e, i) => (
                <li
                  key={`${e.at}-${i}`}
                  className="flex items-center justify-between gap-3 text-[11.5px]"
                >
                  <span className="truncate font-mono text-neutral-600">
                    {e.label}
                  </span>
                  <span className="flex-shrink-0 text-[10.5px] tabular-nums text-neutral-400">
                    {timeAgo(e.at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export { formatTokens, formatDuration } from "./chrome";
