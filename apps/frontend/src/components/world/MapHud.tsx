import { useEffect, useState } from "react";
import { Check, X, Zap } from "lucide-react";
import { useMapOverlay } from "@/hooks/useRealtimeMap";
import { type MapOverlay } from "@/lib/http";
import { timeAgo } from "@/components/dashboard/primitives";

/* Paper material shared by world overlays — matches the console's bone
   instruments (PaperInset language) so the world frame feels native. */
const PANEL =
  "overflow-hidden rounded-2xl bg-[#f4f2ed]/97 ring-1 ring-black/[0.09] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_24px_48px_-20px_rgba(28,25,18,0.4)] backdrop-blur-sm";
const LABEL =
  "text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-400";

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
      className="pointer-events-auto fixed inset-0 z-30 grid place-items-center bg-black/25 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
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

  return (
    <div className={PANEL}>
      {/* header */}
      <div className="flex items-center gap-3 border-b border-black/[0.07] px-5 py-3.5">
        {data?.developer.avatarUrl ? (
          <img
            src={data.developer.avatarUrl}
            alt=""
            className="size-9 flex-shrink-0 rounded-full object-cover ring-1 ring-black/[0.08]"
          />
        ) : (
          <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900/[0.06] font-serif text-[15px] text-neutral-700 ring-1 ring-black/[0.06]">
            {(data?.developer.name ?? title).charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-[17px] leading-tight text-neutral-900">
            {title}
          </div>
          {!isMe && data?.developer.email && (
            <div className="flex items-center gap-2 truncate text-[11.5px] capitalize text-neutral-500">
              {data?.developer.label ? (
                <span className="font-medium not-italic text-neutral-700">
                  {data.developer.status} · {data.developer.label}
                </span>
              ) : (
                (data?.developer.status ?? "")
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-black/[0.05] hover:text-neutral-900"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* body */}
      <div className="space-y-5 px-5 py-4 text-[13px] text-neutral-800">
        {overlay.isLoading && !data && (
          <div className="py-2 text-neutral-500">Loading activity…</div>
        )}

        {data?.developer.workingOn && (
          <section>
            <div className={LABEL}>Working on</div>
            <div className="mt-1 flex items-center gap-1.5 font-medium text-neutral-900">
              <Zap className="size-3.5 shrink-0 text-violet-500" />
              <span className="min-w-0">{data.developer.workingOn}</span>
            </div>
          </section>
        )}

        {data?.project && (
          <section>
            <div className={LABEL}>Project</div>
            <div className="mt-1 font-mono text-[12px] text-neutral-800">
              {data.project}
            </div>
          </section>
        )}

        {session ? (
          <section>
            <div className={LABEL}>Current session</div>
            <div className="mt-1.5 font-medium leading-snug text-neutral-900">
              {session.title ?? "Untitled session"}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] capitalize text-neutral-500">
              <span className="rounded-full bg-black/[0.05] px-2 py-0.5 font-medium text-neutral-700 ring-1 ring-black/[0.06]">
                {session.agent.name}
              </span>
              {session.agent.model && (
                <span className="font-mono text-[10.5px] lowercase">
                  {session.agent.model}
                </span>
              )}
              {session.branch && (
                <span className="rounded-full bg-neutral-900/[0.05] px-2 py-0.5 font-mono text-[10.5px] lowercase text-neutral-600 ring-1 ring-black/[0.06]">
                  {session.branch}
                </span>
              )}
              <span>·</span>
              <span>{session.status ?? "running"}</span>
              <span>·</span>
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
            <div className="text-[12.5px] italic text-neutral-500">
              No active session right now.
            </div>
          )
        )}

        {data?.issue && (
          <section>
            <div className={LABEL}>Linked issue</div>
            <div className="mt-1.5 font-medium text-neutral-900">
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
            <div className="mt-1.5 flex items-baseline gap-2 font-serif text-[22px] leading-none tabular-nums text-neutral-900">
              {formatTokens(data.inputTokens)}
              <span className="font-sans text-[10px] uppercase tracking-wider text-neutral-500">
                in
              </span>
              <span className="text-neutral-300">/</span>
              {formatTokens(data.outputTokens)}
              <span className="font-sans text-[10px] uppercase tracking-wider text-neutral-500">
                out
              </span>
              {data.costCents != null && (
                <span className="ml-auto rounded-full bg-black/[0.05] px-2.5 py-1 font-sans text-[12px] font-semibold text-neutral-800 ring-1 ring-black/[0.06]">
                  ${(data.costCents / 100).toFixed(2)}
                </span>
              )}
            </div>

            {/* model mix — stacked share bar + legend */}
            {stats?.modelMix && stats.modelMix.length > 0 && (
              <div className="mt-3">
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
                  {stats.modelMix.map((m, i) => (
                    <div
                      key={m.model}
                      className={MIX_COLORS[i % MIX_COLORS.length]}
                      style={{ width: `${Math.max(4, m.share * 100)}%` }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {stats.modelMix.map((m, i) => (
                    <span
                      key={m.model}
                      className="flex items-center gap-1 font-mono text-[10px] lowercase text-neutral-500"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${MIX_DOTS[i % MIX_DOTS.length]}`}
                      />
                      {m.model} · {Math.round(m.share * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* today strip */}
        {stats &&
          (stats.sessionsToday > 0 ||
            stats.testsPassedToday > 0 ||
            stats.testsFailedToday > 0) && (
            <section>
              <div className={LABEL}>Today</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] tabular-nums text-neutral-700">
                <span>
                  <span className="font-semibold text-neutral-900">
                    {stats.sessionsToday}
                  </span>{" "}
                  session{stats.sessionsToday === 1 ? "" : "s"}
                </span>
                <span className="h-3 w-px bg-black/[0.09]" />
                <span>
                  <span className="font-semibold text-neutral-900">
                    {formatDuration(stats.activeMinutesToday * 60_000)}
                  </span>{" "}
                  active
                </span>
                {(stats.testsPassedToday > 0 || stats.testsFailedToday > 0) && (
                  <>
                    <span className="h-3 w-px bg-black/[0.09]" />
                    <span className="flex items-center gap-0.5 text-emerald-700">
                      {stats.testsPassedToday}
                      <Check className="size-3" />
                    </span>
                    {stats.testsFailedToday > 0 && (
                      <span className="flex items-center gap-0.5 text-rose-600">
                        {stats.testsFailedToday}
                        <X className="size-3" />
                      </span>
                    )}
                    <span className="text-neutral-500">tests</span>
                  </>
                )}
                {stats.costCentsToday != null && stats.costCentsToday > 0 && (
                  <>
                    <span className="h-3 w-px bg-black/[0.09]" />
                    <span className="font-semibold text-neutral-900">
                      ${(stats.costCentsToday / 100).toFixed(2)}
                    </span>
                    <span className="text-neutral-500">today</span>
                  </>
                )}
              </div>
            </section>
          )}

        {/* live feed from their running session */}
        {stats?.recentEvents && stats.recentEvents.length > 0 && (
          <section>
            <div className={LABEL}>Live</div>
            <ul className="mt-1.5 space-y-1">
              {stats.recentEvents.map((e, i) => (
                <li
                  key={`${e.at}-${i}`}
                  className="flex items-center justify-between gap-3 text-[11.5px]"
                >
                  <span className="truncate font-mono text-neutral-700">
                    {e.label}
                  </span>
                  <span className="flex-shrink-0 text-[10.5px] text-neutral-400">
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

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

const MIX_COLORS = ["bg-neutral-900", "bg-neutral-500", "bg-neutral-300"];
const MIX_DOTS = ["bg-neutral-900", "bg-neutral-500", "bg-neutral-300"];

function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
