import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FiX, FiArrowUpRight, FiCheck, FiAlertTriangle } from "react-icons/fi";
import { http } from "@/lib/http";
import type { RealtimeClient } from "@/lib/realtime";
import { cn } from "@/lib/utils";

const EYEBROW =
  "text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-400";
const PILL =
  "rounded-lg bg-white px-3 py-2 ring-1 ring-black/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]";

interface CiDashboardModalProps {
  workspaceId: string;
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

function StatusDot({ passing }: { passing: boolean }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        passing ? "bg-emerald-500" : "bg-rose-500 animate-pulse",
      )}
    />
  );
}

export function CiDashboardModal({
  workspaceId,
  client,
  onClose,
}: CiDashboardModalProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!client) return;
    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: ["ci", workspaceId],
      });
    };
    const offs = [
      client.on("repo.push", refresh),
      client.on("test.finished", refresh),
      client.on("pr.updated", refresh),
    ];
    return () => offs.forEach((off) => off());
  }, [client, workspaceId, queryClient]);

  const reposQ = useQuery({
    queryKey: ["ci", workspaceId, "repos"],
    queryFn: () => http.reads.repositories(workspaceId),
  });
  const prsQ = useQuery({
    queryKey: ["ci", workspaceId, "prs"],
    queryFn: () =>
      http.reads.pullRequests(workspaceId, { status: "open", pageSize: 50 }),
  });
  const mergedQ = useQuery({
    queryKey: ["ci", workspaceId, "merged"],
    queryFn: () =>
      http.reads.pullRequests(workspaceId, { status: "merged", pageSize: 5 }),
  });
  const testsQ = useQuery({
    queryKey: ["ci", workspaceId, "tests"],
    queryFn: () => http.reads.testRuns(workspaceId, { pageSize: 100 }),
  });

  const loading =
    (reposQ.isLoading && !reposQ.data) ||
    (prsQ.isLoading && !prsQ.data) ||
    (mergedQ.isLoading && !mergedQ.data) ||
    (testsQ.isLoading && !testsQ.data);

  const repos = reposQ.data ?? [];
  const prs = prsQ.data?.items ?? [];
  const runs = testsQ.data?.items ?? [];
  const lastDeploy = mergedQ.data?.items?.[0] ?? null;

  // Latest test run status per (repoId -> branch fallback).
  const latestByBranch = new Map<string, { passing: boolean }>();
  for (const r of runs) {
    if (r.status === "running" || !r.repository) continue;
    const key = `${r.repository.id}:${r.branch ?? "default"}`;
    if (!latestByBranch.has(key)) {
      latestByBranch.set(key, { passing: r.status === "passed" });
    }
  }

  const repoHealth = (repo: (typeof repos)[number]): boolean => {
    const defaultKey = `${repo.id}:${repo.defaultBranch ?? "default"}`;
    const entry = latestByBranch.get(defaultKey);
    if (entry) return entry.passing;
    return latestByBranch.has(`${repo.id}:default`)
      ? latestByBranch.get(`${repo.id}:default`)!.passing
      : true;
  };

  const prHealth = (pr: (typeof prs)[number]): boolean => {
    const repoKey = pr.repository?.id;
    if (!repoKey) return true;
    const headKey = `${repoKey}:default`;
    const entry = latestByBranch.get(headKey);
    if (entry) return entry.passing;
    return latestByBranch.get(`${repoKey}:default`)?.passing ?? true;
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div className="flex h-[min(80vh,720px)] w-[min(680px,96vw)] flex-col overflow-hidden rounded-2xl bg-[#0b0d12] ring-1 ring-black/[0.5] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <div>
            <div className={cn(EYEBROW, "text-neutral-500")}>Engineering</div>
            <div className="font-serif text-[15px] leading-tight text-white">
              CI
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close CI dashboard"
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <FiX className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="py-12 text-center text-[12px] text-neutral-500">
              Reading engineering health…
            </div>
          )}

          {!loading && (
            <div className="flex flex-col gap-4">
              {/* Branches */}
              <section>
                <div className={cn(EYEBROW, "mb-2 text-neutral-500")}>
                  Branches
                </div>
                {repos.length === 0 ? (
                  <div className={PILL}>
                    <div className="text-[13px] text-neutral-300">
                      No repositories linked yet.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {repos.map((repo) => (
                      <div key={repo.id} className={PILL}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-[13.5px] font-semibold text-neutral-900">
                              {repo.defaultBranch ?? "default"} · {repo.name}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500">
                              <span>{repo.branchCount} branches</span>
                              <span className="h-3 w-px bg-black/[0.08]" />
                              <span>{repo.openPrCount} open PRs</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <StatusDot passing={repoHealth(repo)} />
                            <span className="text-[11.5px] font-semibold text-neutral-700">
                              {repoHealth(repo) ? "PASSING" : "FAILED"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Open PRs */}
              <section>
                <div className={cn(EYEBROW, "mb-2 text-neutral-500")}>
                  Pull requests
                </div>
                {prs.length === 0 ? (
                  <div className={PILL}>
                    <div className="text-[13px] text-neutral-300">
                      No open pull requests.
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {prs.map((pr) => (
                      <div key={pr.id} className={PILL}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 font-mono text-[11px] text-neutral-400">
                                PR #{pr.number}
                              </span>
                              <span className="truncate text-[13px] font-medium text-neutral-900">
                                {pr.title}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-neutral-500">
                              {pr.repository?.name}
                              {pr.authorName ? ` · ${pr.authorName}` : ""}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <StatusDot passing={prHealth(pr)} />
                            <span className="text-[11.5px] font-semibold text-neutral-700">
                              {prHealth(pr) ? "PASSING" : "FAILED"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Overview strip */}
              <div className="mt-1 flex items-center justify-between gap-3 rounded-xl bg-black/[0.05] px-3 py-2.5 ring-1 ring-black/[0.06]">
                <div className="flex items-center gap-2 text-[12px] text-neutral-600">
                  {prs.length === 0 ? (
                    <>
                      <FiCheck className="size-3.5 text-emerald-500" />
                      Mainline is green
                    </>
                  ) : (
                    <>
                      <FiAlertTriangle className="size-3.5 text-amber-500" />
                      {prs.length} open {prs.length === 1 ? "PR" : "PRs"}{" "}
                      awaiting merge
                    </>
                  )}
                </div>
                {lastDeploy ? (
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-700">
                    <FiArrowUpRight className="size-3.5" />
                    Deploy{" "}
                    {timeAgo(lastDeploy.mergedAt ?? lastDeploy.updatedAt)}
                  </div>
                ) : (
                  <div className="text-[12px] text-neutral-400">
                    No deploy recorded
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
