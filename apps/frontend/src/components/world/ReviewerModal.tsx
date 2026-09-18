import { DCard, DError, DLoading, DModal, timeAgo } from "./chrome";
import { useQuery } from "@tanstack/react-query";
import { http, type ReviewActivity } from "@/lib/http";

interface ReviewerModalProps {
  workspaceId: string;
  onClose: () => void;
}

// Light-card severity pills (the modal body is bone/white, not dark).
const SEV = {
  critical: "bg-rose-600/10 text-rose-700 ring-rose-600/25",
  major: "bg-amber-500/15 text-amber-800 ring-amber-500/30",
  minor: "bg-black/[0.05] text-neutral-600 ring-black/[0.08]",
} as const;

/**
 * What the reviewer bot is doing: live status + recent review passes with
 * findings. Findings render only when git metadata is visible to the viewer.
 */
export function ReviewerModal({ workspaceId, onClose }: ReviewerModalProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reviews-recent", workspaceId],
    queryFn: () => http.github.reviewsRecent(workspaceId),
  });

  const reviews: ReviewActivity[] = data?.reviews ?? [];
  const running = reviews.find(
    (r) => r.status === "running" || r.status === "queued",
  );

  return (
    <DModal
      eyebrow="Teammate"
      title="Reviewer activity"
      onClose={onClose}
      closeLabel="Close reviewer activity"
    >
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
          <DLoading>Asking the reviewer…</DLoading>
        ) : isError ? (
          <DError retry={() => void refetch()}>
            Couldn&apos;t load reviewer activity.
          </DError>
        ) : reviews.length === 0 ? (
          <DCard className="px-4 py-8 text-center">
            <div className="text-[14px] font-semibold text-neutral-900">
              Nothing reviewed yet
            </div>
            <p className="mx-auto mt-1 max-w-[280px] text-[12.5px] text-neutral-500">
              Open a pull request on a linked repo with the reviewer toggle on,
              and the bot will pick it up.
            </p>
          </DCard>
        ) : (
          <div className="flex flex-col gap-2">
            {reviews.map((r) => (
              <DCard key={r.id} className="px-3.5 py-3">
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
                        <span className="block font-mono text-[10.5px] text-neutral-500">
                          {f.file}
                          {f.line ? `:${f.line}` : ""}
                        </span>
                      </li>
                    ))}
                    {r.findings.length > 5 && (
                      <li className="px-2.5 py-1 text-[11.5px] font-medium text-neutral-500">
                        +{r.findings.length - 5} more finding
                        {r.findings.length - 5 === 1 ? "" : "s"}
                      </li>
                    )}
                  </ul>
                )}
              </DCard>
            ))}
          </div>
        )}
      </div>
    </DModal>
  );
}
