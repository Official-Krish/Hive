import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { http, type ReviewActivity } from "@/lib/http";

interface ReviewerModalProps {
  workspaceId: string;
  onClose: () => void;
}

function timeAgo(iso: string): string {
  const s = Math.max(
    1,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const SEV = {
  critical: "bg-rose-500/15 text-rose-300 ring-rose-400/40",
  major: "bg-amber-500/15 text-amber-300 ring-amber-400/40",
  minor: "bg-white/[0.07] text-white/60 ring-white/15",
} as const;

/**
 * What the reviewer bot is doing: live status + recent review passes with
 * findings. Findings render only when git metadata is visible to the viewer.
 */
export function ReviewerModal({ workspaceId, onClose }: ReviewerModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["reviews-recent", workspaceId],
    queryFn: () => http.github.reviewsRecent(workspaceId),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reviews: ReviewActivity[] = data?.reviews ?? [];
  const running = reviews.find(
    (r) => r.status === "running" || r.status === "queued",
  );

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[min(86vh,620px)] w-[min(480px,96vw)] flex-col overflow-hidden rounded-2xl bg-[#f4f2ed] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.09]">
        <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-3">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              Teammate
            </div>
            <div className="text-[15px] font-semibold tracking-tight text-neutral-900">
              Reviewer activity
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reviewer activity"
            className="rounded-lg px-2 py-1 text-[13px] font-semibold text-neutral-500 transition-colors hover:bg-black/[0.05] hover:text-neutral-900"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {running && (
            <div className="mb-3 flex items-center gap-2.5 rounded-2xl bg-neutral-950 px-4 py-3 text-white shadow-md">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300 opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-teal-300" />
              </span>
              <span className="text-[13px] font-semibold">
                Reading PR #{running.prNumber} · {running.repoName}
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="py-6 text-center text-[13px] text-neutral-500">
              Asking the reviewer…
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl bg-white px-4 py-8 text-center ring-1 ring-black/[0.07]">
              <div className="text-[14px] font-semibold text-neutral-900">
                Nothing reviewed yet
              </div>
              <p className="mx-auto mt-1 max-w-[280px] text-[12.5px] text-neutral-500">
                Open a pull request on a linked repo with the reviewer toggle
                on, and the bot will pick it up.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl bg-white px-3.5 py-3 ring-1 ring-black/[0.07]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        r.status === "done"
                          ? "size-2 shrink-0 rounded-full bg-emerald-500"
                          : r.status === "failed"
                            ? "size-2 shrink-0 rounded-full bg-rose-500"
                            : "size-2 shrink-0 animate-pulse rounded-full bg-teal-500"
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-neutral-900">
                      {r.title} · {r.repoName}
                    </span>
                    <span className="shrink-0 text-[11px] font-medium text-neutral-400">
                      {timeAgo(r.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11.5px] font-medium text-neutral-500">
                    {r.status === "done"
                      ? r.findingCount === 0
                        ? "Clean"
                        : `${r.findingCount} finding${r.findingCount === 1 ? "" : "s"}`
                      : r.status}
                    {r.costCents !== null &&
                      ` · $${(r.costCents / 100).toFixed(2)}`}
                  </div>
                  {r.findings && r.findings.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {r.findings.slice(0, 5).map((f, i) => (
                        <li
                          key={i}
                          className="rounded-lg bg-neutral-900/[0.03] px-2.5 py-1.5 text-[12px] ring-1 ring-black/[0.05]"
                        >
                          <span
                            className={`mr-1.5 inline-block rounded-full px-1.5 py-px text-[10px] font-bold uppercase ring-1 ${
                              SEV[f.severity as keyof typeof SEV] ?? SEV.minor
                            }`}
                          >
                            {f.severity}
                          </span>
                          <span className="font-semibold text-neutral-800">
                            {f.title}
                          </span>
                          <span className="block font-mono text-[10.5px] text-neutral-400">
                            {f.file}
                            {f.line ? `:${f.line}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
