import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/http";
import type { UsageDayPoint } from "@hive/types";
import {
  BackLink,
  Btn,
  Card,
  CardHead,
  Note,
  PageHead,
  Stat,
} from "@/components/dashboard/kit";

const RANGE_DAYS = [7, 30, 90] as const;

function fmtMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Minimal stacked daily bars, pure SVG — no chart dependency. */
function DailyChart({ days }: { days: UsageDayPoint[] }) {
  const max = Math.max(1, ...days.map((d) => d.inputTokens + d.outputTokens));
  const W = 640;
  const H = 160;
  const gap = 4;
  const bw = days.length > 0 ? W / days.length : W;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-40 w-full"
      role="img"
      aria-label="Daily token usage"
    >
      {days.map((d, i) => {
        const total = d.inputTokens + d.outputTokens;
        const h = Math.max(2, (total / max) * (H - 24));
        const outH = (d.outputTokens / Math.max(1, total)) * h;
        const x = i * bw + gap / 2;
        const w = Math.max(1, bw - gap);
        return (
          <g key={d.date}>
            <title>
              {d.date}: {fmtTokens(total)} tokens
              {d.costCents !== null
                ? ` · $${(d.costCents / 100).toFixed(2)}`
                : ""}
            </title>
            <rect
              x={x}
              y={H - 20 - h}
              width={w}
              height={Math.max(0, h - outH)}
              rx={2}
              className="fill-sky-500/80"
            />
            <rect
              x={x}
              y={H - 20 - outH}
              width={w}
              height={outH}
              rx={2}
              className="fill-violet-500/90"
            />
          </g>
        );
      })}
    </svg>
  );
}

export function WorkspaceUsage() {
  const { workspaceId = "" } = useParams();
  const queryClient = useQueryClient();
  const [days, setDays] = useState<(typeof RANGE_DAYS)[number]>(30);
  const [tab, setTab] = useState<"usage" | "throughput" | "keys">("usage");
  const [capInput, setCapInput] = useState("");
  const [alertInput, setAlertInput] = useState("80");

  const range = useMemo(() => ({ from: isoDaysAgo(days) }), [days]);

  const workspace = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => http.workspaces.get(workspaceId),
  });
  const isAdmin =
    workspace.data?.role === "admin" || workspace.data?.role === "owner";

  const summary = useQuery({
    queryKey: ["usage-summary", workspaceId, days],
    queryFn: () => http.reads.usageSummary(workspaceId, range),
    enabled: isAdmin,
  });
  const byMember = useQuery({
    queryKey: ["usage-by-member", workspaceId, days],
    queryFn: () => http.reads.usageByMember(workspaceId, range),
    enabled: isAdmin && tab === "usage",
  });
  const throughput = useQuery({
    queryKey: ["throughput", workspaceId, days],
    queryFn: () => http.reads.throughput(workspaceId, range),
    enabled: isAdmin && tab === "throughput",
  });
  const reviewsDigest = useQuery({
    queryKey: ["reviews-summary", workspaceId, days],
    queryFn: () => http.github.reviewsSummary(workspaceId, range),
    enabled: isAdmin && tab === "throughput",
  });
  const pool = useQuery({
    queryKey: ["vending-pool", workspaceId],
    queryFn: () => http.reads.vendingPool(workspaceId),
    enabled: isAdmin && tab === "keys",
  });
  const ledger = useQuery({
    queryKey: ["vending-checkouts", workspaceId],
    queryFn: () => http.reads.vendingCheckouts(workspaceId),
    enabled: isAdmin && tab === "keys",
  });
  const wsMembers = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => http.workspaces.members.list(workspaceId),
    enabled: isAdmin && tab === "keys",
  });
  const [assignPool, setAssignPool] = useState("");
  const [assignUser, setAssignUser] = useState("");
  const [stockProvider, setStockProvider] = useState("claude");
  const [stockLabel, setStockLabel] = useState("");
  const [stockSecret, setStockSecret] = useState("");
  const [stockCap, setStockCap] = useState("");
  const assignMutation = useMutation({
    mutationFn: () =>
      http.reads.vendingAssign(workspaceId, {
        poolId: assignPool,
        userId: assignUser,
      }),
    onSuccess: () => {
      setAssignPool("");
      setAssignUser("");
      void queryClient.invalidateQueries({
        queryKey: ["vending-pool", workspaceId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["vending-checkouts", workspaceId],
      });
    },
  });
  const stockMutation = useMutation({
    mutationFn: () =>
      http.reads.vendingStock(workspaceId, {
        provider: stockProvider as "claude" | "opencode" | "codex",
        label: stockLabel.trim(),
        secret: stockSecret.trim(),
        maxCheckouts: stockCap.trim() === "" ? null : Number(stockCap),
      }),
    onSuccess: () => {
      setStockLabel("");
      setStockSecret("");
      setStockCap("");
      void queryClient.invalidateQueries({
        queryKey: ["vending-pool", workspaceId],
      });
    },
  });

  const budgetMutation = useMutation({
    mutationFn: (input: {
      monthlyCapCents: number | null;
      alertAtPct: number;
    }) => http.reads.updateUsageBudget(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["usage-summary", workspaceId],
      });
    },
  });

  const data = summary.data;
  const masked = data?.hiddenByPrivacy === true;
  const cap = data?.budget.monthlyCapCents ?? null;
  const spent = data?.monthSpendCents ?? null;
  const pct =
    cap !== null && cap > 0 && spent !== null
      ? Math.min(100, Math.round((spent / cap) * 100))
      : null;
  const overAlert = pct !== null && pct >= (data?.budget.alertAtPct ?? 80);

  const sortedMembers = useMemo(() => {
    const rows = [...(byMember.data?.members ?? [])];
    rows.sort((a, b) => (b.costCents ?? -1) - (a.costCents ?? -1));
    return rows;
  }, [byMember.data]);

  const sortedThroughput = useMemo(() => {
    const rows = [...(throughput.data?.members ?? [])];
    rows.sort((a, b) => b.tasksCompleted - a.tasksCompleted);
    return rows;
  }, [throughput.data]);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6">
      <BackLink to={`/dashboard/w/${workspaceId}`}>Workspace</BackLink>
      <PageHead
        eyebrow="Admin"
        title="Usage & throughput"
        sub="Token spend per member, budgets, and what the team shipped."
      />

      {!workspace.isLoading && !isAdmin && (
        <Note tone="warn">
          Only workspace admins can view usage data. Ask an admin for access.
        </Note>
      )}

      {isAdmin && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-white p-1 ring-1 ring-black/[0.07]">
              {(["usage", "throughput", "keys"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={
                    tab === t
                      ? "rounded-lg bg-neutral-900 px-3 py-1.5 text-[13px] font-semibold text-white"
                      : "rounded-lg px-3 py-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-900"
                  }
                >
                  {t === "usage"
                    ? "Token usage"
                    : t === "throughput"
                      ? "Throughput"
                      : "API keys"}
                </button>
              ))}
            </div>
            <div className="flex rounded-xl bg-white p-1 ring-1 ring-black/[0.07]">
              {RANGE_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={
                    days === d
                      ? "rounded-lg bg-neutral-900 px-3 py-1.5 text-[13px] font-semibold text-white"
                      : "rounded-lg px-3 py-1.5 text-[13px] font-medium text-neutral-500 hover:text-neutral-900"
                  }
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {masked && (
            <div className="mt-4">
              <Note tone="warn">
                Token visibility is disabled in this workspace's privacy
                settings — figures below are masked. Throughput counts are
                unaffected.{" "}
                <Link
                  to={`/dashboard/w/${workspaceId}/settings`}
                  className="font-semibold underline"
                >
                  Privacy settings
                </Link>
              </Note>
            </div>
          )}

          {tab === "usage" && (
            <div className="mt-4 flex flex-col gap-4">
              <Card className="grid grid-cols-2 gap-6 p-5 lg:grid-cols-4">
                <Stat
                  label={`Spend · month`}
                  value={masked ? "masked" : fmtMoney(spent)}
                  hint={
                    cap !== null
                      ? `of ${fmtMoney(cap)} cap`
                      : "no monthly cap set"
                  }
                />
                <Stat
                  label={`Cost · ${days}d`}
                  value={masked ? "masked" : fmtMoney(data?.costCents)}
                />
                <Stat
                  label={`Tokens · ${days}d`}
                  value={
                    masked
                      ? "masked"
                      : fmtTokens(
                          (data?.inputTokens ?? 0) + (data?.outputTokens ?? 0),
                        )
                  }
                  hint={
                    masked
                      ? undefined
                      : `${fmtTokens(data?.cachedInputTokens ?? 0)} cached`
                  }
                />
                <Stat
                  label={`Sessions · ${days}d`}
                  value={String(data?.sessions ?? 0)}
                />
              </Card>

              {cap !== null && pct !== null && !masked && (
                <Card className="p-5">
                  <div className="flex items-center justify-between text-[13px] font-semibold">
                    <span>Monthly budget</span>
                    <span className={overAlert ? "text-rose-600" : ""}>
                      {pct}% used
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-900/[0.07]">
                    <div
                      className={
                        overAlert
                          ? "h-full bg-rose-500"
                          : "h-full bg-emerald-500"
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {overAlert && (
                    <div className="mt-2 text-[12px] font-medium text-rose-600">
                      Over the {data?.budget.alertAtPct}% alert threshold.
                    </div>
                  )}
                </Card>
              )}

              <Card>
                <CardHead title="Daily tokens" />
                <div className="px-5 py-4">
                  {(data?.byDay.length ?? 0) === 0 ? (
                    <div className="py-6 text-center text-sm text-neutral-400">
                      {masked ? "Masked by privacy." : "No usage in range."}
                    </div>
                  ) : (
                    <>
                      <DailyChart days={data!.byDay} />
                      <div className="mt-1 flex gap-4 text-[11px] font-medium text-neutral-500">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-sm bg-sky-500/80" />
                          Input
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-sm bg-violet-500/90" />
                          Output
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </Card>

              {!masked && (data?.byModel.length ?? 0) > 0 && (
                <Card>
                  <CardHead title="By model" />
                  <div className="flex flex-col gap-2 px-5 py-4">
                    {data!.byModel.map((m) => {
                      const total = m.inputTokens + m.outputTokens;
                      const max = Math.max(
                        1,
                        ...data!.byModel.map(
                          (x) => x.inputTokens + x.outputTokens,
                        ),
                      );
                      return (
                        <div key={m.model} className="flex items-center gap-3">
                          <span className="w-36 truncate text-[13px] font-medium">
                            {m.model}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-900/[0.07]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500"
                              style={{ width: `${(total / max) * 100}%` }}
                            />
                          </div>
                          <span className="w-20 text-right font-mono text-[12px] text-neutral-500">
                            {fmtTokens(total)}
                          </span>
                          <span className="w-16 text-right font-mono text-[12px] text-neutral-700">
                            {fmtMoney(m.costCents)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              <Card>
                <CardHead title="By member" />
                <div className="px-5 py-2">
                  {byMember.isLoading ? (
                    <div className="py-4 text-sm text-neutral-400">
                      Loading…
                    </div>
                  ) : sortedMembers.length === 0 ? (
                    <div className="py-4 text-sm text-neutral-400">
                      No members with usage in range.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wide text-neutral-400">
                            <th className="py-2 pr-3 font-semibold">Member</th>
                            <th className="py-2 pr-3 font-semibold">
                              Sessions
                            </th>
                            <th className="py-2 pr-3 text-right font-semibold">
                              Tokens
                            </th>
                            <th className="py-2 pr-3 text-right font-semibold">
                              Cost
                            </th>
                            <th className="py-2 font-semibold">Top model</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedMembers.map((m) => (
                            <tr
                              key={m.userId}
                              className="border-t border-black/[0.05]"
                            >
                              <td className="py-2 pr-3 font-semibold">
                                {m.name}
                              </td>
                              <td className="py-2 pr-3 font-mono">
                                {m.sessions}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono">
                                {m.hiddenByPrivacy
                                  ? "masked"
                                  : fmtTokens(m.inputTokens + m.outputTokens)}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono">
                                {fmtMoney(m.costCents)}
                              </td>
                              <td className="py-2 text-neutral-500">
                                {m.topModel ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <CardHead title="Monthly budget" />
                <div className="flex flex-wrap items-end gap-3 px-5 py-4">
                  <label className="flex flex-col gap-1 text-[12px] font-medium text-neutral-500">
                    Cap (USD, empty = none)
                    <input
                      value={capInput}
                      onChange={(e) => setCapInput(e.target.value)}
                      placeholder={
                        cap !== null ? `$${(cap / 100).toFixed(2)}` : "No cap"
                      }
                      inputMode="decimal"
                      className="w-32 rounded-xl bg-white px-3 py-2 text-[13px] text-neutral-900 ring-1 ring-black/[0.1]"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-medium text-neutral-500">
                    Alert at %
                    <input
                      value={alertInput}
                      onChange={(e) => setAlertInput(e.target.value)}
                      inputMode="numeric"
                      className="w-20 rounded-xl bg-white px-3 py-2 text-[13px] text-neutral-900 ring-1 ring-black/[0.1]"
                    />
                  </label>
                  <Btn
                    onClick={() => {
                      const dollars = capInput.trim();
                      budgetMutation.mutate({
                        monthlyCapCents:
                          dollars === ""
                            ? null
                            : Math.round(Number(dollars) * 100),
                        alertAtPct: Number(alertInput) || 80,
                      });
                    }}
                  >
                    {budgetMutation.isPending ? "Saving…" : "Save budget"}
                  </Btn>
                </div>
                {budgetMutation.isError && (
                  <div className="px-5 pb-4 text-[12px] font-medium text-rose-600">
                    Could not save — check the amounts.
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === "throughput" && (
            <>
              {reviewsDigest.data &&
                (reviewsDigest.data.reviewed > 0 ||
                  reviewsDigest.data.findings > 0) && (
                  <Card className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-5">
                    <Stat
                      label="PRs reviewed"
                      value={String(reviewsDigest.data.reviewed)}
                    />
                    <Stat
                      label="Findings"
                      value={String(reviewsDigest.data.findings)}
                    />
                    <Stat
                      label="Review spend"
                      value={fmtMoney(reviewsDigest.data.costCents)}
                    />
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                      Reviewer teammate · {days}d
                    </span>
                  </Card>
                )}
              <Card>
                <CardHead title={`Team throughput · ${days}d`} />
                <div className="px-5 py-2">
                  {throughput.isLoading ? (
                    <div className="py-4 text-sm text-neutral-400">
                      Loading…
                    </div>
                  ) : sortedThroughput.length === 0 ? (
                    <div className="py-4 text-sm text-neutral-400">
                      No members found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="text-[11px] uppercase tracking-wide text-neutral-400">
                            <th className="py-2 pr-3 font-semibold">Member</th>
                            <th className="py-2 pr-3 text-right font-semibold">
                              Tasks
                            </th>
                            <th className="py-2 pr-3 text-right font-semibold">
                              PRs
                            </th>
                            <th className="py-2 pr-3 text-right font-semibold">
                              Tests ✓/✗
                            </th>
                            <th className="py-2 pr-3 text-right font-semibold">
                              Cost
                            </th>
                            <th className="py-2 text-right font-semibold">
                              $/task
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedThroughput.map((m) => (
                            <tr
                              key={m.userId}
                              className="border-t border-black/[0.05]"
                            >
                              <td className="py-2 pr-3 font-semibold">
                                {m.name}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono">
                                {m.tasksCompleted}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono">
                                {m.prsMerged}
                              </td>
                              <td className="py-2 pr-3 text-right font-mono">
                                <span className="text-emerald-600">
                                  {m.testsPassed}
                                </span>
                                /
                                <span
                                  className={
                                    m.testsFailed > 0 ? "text-rose-600" : ""
                                  }
                                >
                                  {m.testsFailed}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-right font-mono">
                                {fmtMoney(m.costCents)}
                              </td>
                              <td className="py-2 text-right font-mono">
                                {m.costPerTaskCents !== null
                                  ? fmtMoney(m.costPerTaskCents)
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          {tab === "keys" && (
            <KeysTab
              pool={pool.data?.entries ?? []}
              loading={pool.isLoading}
              checkouts={ledger.data?.checkouts ?? []}
              members={wsMembers.data ?? []}
              assignPool={assignPool}
              setAssignPool={setAssignPool}
              assignUser={assignUser}
              setAssignUser={setAssignUser}
              assigning={assignMutation.isPending}
              assignError={assignMutation.isError}
              onAssign={() => assignMutation.mutate()}
              stockProvider={stockProvider}
              setStockProvider={setStockProvider}
              stockLabel={stockLabel}
              setStockLabel={setStockLabel}
              stockSecret={stockSecret}
              setStockSecret={setStockSecret}
              stockCap={stockCap}
              setStockCap={setStockCap}
              stocking={stockMutation.isPending}
              stockError={stockMutation.isError}
              stockOk={stockMutation.isSuccess}
              onStock={() => stockMutation.mutate()}
            />
          )}
        </>
      )}
    </div>
  );
}

function KeysTab({
  pool,
  loading,
  checkouts,
  members,
  assignPool,
  setAssignPool,
  assignUser,
  setAssignUser,
  assigning,
  assignError,
  onAssign,
  stockProvider,
  setStockProvider,
  stockLabel,
  setStockLabel,
  stockSecret,
  setStockSecret,
  stockCap,
  setStockCap,
  stocking,
  stockError,
  stockOk,
  onStock,
}: {
  pool: Array<{
    id: string;
    provider: string;
    label: string;
    status: string;
    checkoutCount: number;
    maxCheckouts: number | null;
  }>;
  loading: boolean;
  checkouts: Array<{
    id: string;
    provider: string;
    label: string;
    userName: string;
    revealedAt: string;
    assignedByName: string | null;
  }>;
  members: Array<{ userId: string; name: string }>;
  assignPool: string;
  setAssignPool: (v: string) => void;
  assignUser: string;
  setAssignUser: (v: string) => void;
  assigning: boolean;
  assignError: boolean;
  onAssign: () => void;
  stockProvider: string;
  setStockProvider: (v: string) => void;
  stockLabel: string;
  setStockLabel: (v: string) => void;
  stockSecret: string;
  setStockSecret: (v: string) => void;
  stockCap: string;
  setStockCap: (v: string) => void;
  stocking: boolean;
  stockError: boolean;
  stockOk: boolean;
  onStock: () => void;
}) {
  const total = pool.length;
  const taken = pool.filter((e) => e.checkoutCount > 0).length;
  const untaken = pool.filter(
    (e) => e.checkoutCount === 0 && e.status === "available",
  ).length;
  const available = pool.filter((e) => e.status === "available");

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Card className="grid grid-cols-3 gap-6 p-5">
        <Stat label="Total keys" value={String(total)} />
        <Stat label="Taken" value={String(taken)} />
        <Stat label="Untaken" value={String(untaken)} />
      </Card>

      <Card>
        <CardHead
          title="Stock a key"
          hint="Admins only — encrypted at rest, hashed for lookup"
        />
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <label className="flex w-32 flex-col gap-1 text-[12px] font-medium text-neutral-500">
            Provider
            <select
              value={stockProvider}
              onChange={(e) => setStockProvider(e.target.value)}
              className="rounded-xl bg-white px-3 py-2 text-[13px] text-neutral-900 ring-1 ring-black/[0.1]"
            >
              <option value="claude">Claude</option>
              <option value="opencode">OpenCode</option>
              <option value="codex">Codex</option>
            </select>
          </label>
          <label className="flex min-w-36 flex-1 flex-col gap-1 text-[12px] font-medium text-neutral-500">
            Label
            <input
              value={stockLabel}
              onChange={(e) => setStockLabel(e.target.value)}
              placeholder="team-key-1"
              className="rounded-xl bg-white px-3 py-2 text-[13px] text-neutral-900 ring-1 ring-black/[0.1]"
            />
          </label>
          <label className="flex min-w-44 flex-[2] flex-col gap-1 text-[12px] font-medium text-neutral-500">
            Secret (paste once — never shown again)
            <input
              value={stockSecret}
              onChange={(e) => setStockSecret(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              spellCheck={false}
              className="rounded-xl bg-white px-3 py-2 font-mono text-[13px] text-neutral-900 ring-1 ring-black/[0.1]"
            />
          </label>
          <label className="flex w-24 flex-col gap-1 text-[12px] font-medium text-neutral-500">
            Max reveals
            <input
              value={stockCap}
              onChange={(e) => setStockCap(e.target.value)}
              placeholder="∞"
              inputMode="numeric"
              className="rounded-xl bg-white px-3 py-2 text-[13px] text-neutral-900 ring-1 ring-black/[0.1]"
            />
          </label>
          <Btn
            disabled={
              !stockLabel.trim() || stockSecret.trim().length < 8 || stocking
            }
            onClick={onStock}
          >
            {stocking ? "Stocking…" : "Stock key"}
          </Btn>
        </div>
        {stockError && (
          <div className="px-5 pb-4 text-[12px] font-medium text-rose-600">
            Could not stock — it may already exist.
          </div>
        )}
        {stockOk && (
          <div className="px-5 pb-4 text-[12px] font-medium text-emerald-600">
            Key stocked — ready in the machine.
          </div>
        )}
      </Card>

      <Card>
        <CardHead title="Assign a key" hint="Admins grant keys to members" />
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <label className="flex min-w-44 flex-1 flex-col gap-1 text-[12px] font-medium text-neutral-500">
            Key
            <select
              value={assignPool}
              onChange={(e) => setAssignPool(e.target.value)}
              className="rounded-xl bg-white px-3 py-2 text-[13px] text-neutral-900 ring-1 ring-black/[0.1]"
            >
              <option value="">Select a stocked key…</option>
              {available.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.provider} · {e.label} ({e.checkoutCount}
                  {e.maxCheckouts !== null ? `/${e.maxCheckouts}` : ""} taken)
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-44 flex-1 flex-col gap-1 text-[12px] font-medium text-neutral-500">
            Member
            <select
              value={assignUser}
              onChange={(e) => setAssignUser(e.target.value)}
              className="rounded-xl bg-white px-3 py-2 text-[13px] text-neutral-900 ring-1 ring-black/[0.1]"
            >
              <option value="">Select a member…</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <Btn
            disabled={!assignPool || !assignUser || assigning}
            onClick={onAssign}
          >
            {assigning ? "Assigning…" : "Assign key"}
          </Btn>
        </div>
        {assignError && (
          <div className="px-5 pb-4 text-[12px] font-medium text-rose-600">
            Could not assign — the key may be exhausted.
          </div>
        )}
      </Card>

      <Card>
        <CardHead title="Taken keys" hint="Who holds what" />
        <div className="px-5 py-2">
          {loading ? (
            <div className="py-4 text-sm text-neutral-400">Loading…</div>
          ) : checkouts.length === 0 ? (
            <div className="py-4 text-sm text-neutral-400">
              No checkouts yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-neutral-400">
                    <th className="py-2 pr-3 font-semibold">Key</th>
                    <th className="py-2 pr-3 font-semibold">Holder</th>
                    <th className="py-2 pr-3 font-semibold">Via</th>
                    <th className="py-2 text-right font-semibold">Taken</th>
                  </tr>
                </thead>
                <tbody>
                  {checkouts.map((c) => (
                    <tr key={c.id} className="border-t border-black/[0.05]">
                      <td className="py-2 pr-3 font-semibold">
                        {c.provider} · {c.label}
                      </td>
                      <td className="py-2 pr-3">{c.userName}</td>
                      <td className="py-2 pr-3 text-neutral-500">
                        {c.assignedByName
                          ? `assigned by ${c.assignedByName}`
                          : "self checkout"}
                      </td>
                      <td className="py-2 text-right font-mono text-neutral-500">
                        {new Date(c.revealedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHead title="Stock" hint="Every stocked key + status" />
        <div className="px-5 py-2">
          {loading ? (
            <div className="py-4 text-sm text-neutral-400">Loading…</div>
          ) : pool.length === 0 ? (
            <div className="py-4 text-sm text-neutral-500">
              Nothing stocked yet — stock keys from the API (admin endpoint).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-neutral-400">
                    <th className="py-2 pr-3 font-semibold">Key</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 text-right font-semibold">Checkouts</th>
                  </tr>
                </thead>
                <tbody>
                  {pool.map((e) => (
                    <tr key={e.id} className="border-t border-black/[0.05]">
                      <td className="py-2 pr-3 font-semibold">
                        {e.provider} · {e.label}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            e.status === "available"
                              ? "rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                              : "rounded-full bg-neutral-900/[0.05] px-2 py-0.5 text-[11px] font-semibold text-neutral-500"
                          }
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono">
                        {e.checkoutCount}
                        {e.maxCheckouts !== null ? `/${e.maxCheckouts}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
