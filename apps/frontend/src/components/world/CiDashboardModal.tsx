import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FiArrowUpRight, FiCheck, FiAlertTriangle } from "react-icons/fi";
import { http } from "@/lib/http";
import type { RealtimeClient } from "@/lib/realtime";
import { DModal, timeAgo } from "./chrome";
import { cn } from "@/lib/utils";

const PILL = "rounded-lg bg-white px-3 py-2 ring-1 ring-black/[0.08]";

interface CiDashboardModalProps {
  workspaceId: string;
  client: RealtimeClient | null;
  onClose: () => void;
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
  const failed =
    !loading &&
    [reposQ, prsQ, mergedQ, testsQ].every((q) => q.isError && !q.data);

  const repos = reposQ.data ?? [];
  const prs = prsQ.data?.items ?? [];
  const runs = testsQ.data?.items ?? [];
  const lastDeploy = mergedQ.data?.items?.[0] ?? null;

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
    return latestByBranch.get(`${repoKey}:default`)?.passing ?? true;
  };

  return (
    <DModal eyebrow="Engineering" title="CI" onClose={onClose} wide>
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center gap-2.5 py-12 text-[12px] text-neutral-500">
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-neutral-900/15 border-t-neutral-900" />
            Reading engineering health…
          </div>
        )}

        {failed && (
          <div className="mx-auto max-w-sm rounded-lg border border-rose-500/30 bg-rose-50 px-3.5 py-3 text-center text-[12px] text-rose-700">
            Couldn&apos;t reach CI data.{" "}
            <button
              type="button"
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["ci", workspaceId],
                })
              }
              className="font-semibold underline underline-offset-2 hover:text-rose-900"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !failed && (
          <div className="flex flex-col gap-4">
            <section>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                Branches
              </div>
              {repos.length === 0 ? (
                <div className={PILL}>
                  <div className="text-[13px] text-neutral-500">
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
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] tabular-nums text-neutral-500">
                            <span>{repo.branchCount} branches</span>
                            <span
                              className="h-3 w-px bg-black/[0.08]"
                              aria-hidden
                            />
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

            <section>
              <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                Pull requests
              </div>
              {prs.length === 0 ? (
                <div className={PILL}>
                  <div className="text-[13px] text-neutral-500">
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
                            <span className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-400">
                              PR #{pr.number}
                            </span>
                            <span className="truncate text-[13px] font-medium text-neutral-900">
                              {pr.title}
                            </span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-neutral-500">
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

            <div className="mt-1 flex items-center justify-between gap-3 rounded-xl bg-neutral-900/[0.03] px-3 py-2.5 ring-1 ring-black/[0.06]">
              <div className="flex min-w-0 items-center gap-2 text-[12px] text-neutral-600">
                {prs.length === 0 ? (
                  <>
                    <FiCheck className="size-3.5 shrink-0 text-emerald-600" />
                    Mainline is green
                  </>
                ) : (
                  <>
                    <FiAlertTriangle className="size-3.5 shrink-0 text-amber-600" />
                    <span className="truncate">
                      {prs.length} open {prs.length === 1 ? "PR" : "PRs"}{" "}
                      awaiting merge
                    </span>
                  </>
                )}
              </div>
              {lastDeploy ? (
                <div className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium tabular-nums text-neutral-700">
                  <FiArrowUpRight className="size-3.5" />
                  Deploy {timeAgo(lastDeploy.mergedAt ?? lastDeploy.updatedAt)}
                </div>
              ) : (
                <div className="shrink-0 text-[12px] text-neutral-400">
                  No deploy recorded
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DModal>
  );
}
