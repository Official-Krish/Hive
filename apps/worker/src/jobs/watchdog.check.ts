import { z } from "zod";
import { prisma, EventType, type Prisma } from "@hive/db";
import { WATCHDOG_DEFAULTS } from "@hive/types";
import { publishAlert, type AlertBroadcast } from "@hive/queue";
import { env } from "../config/env";
import { logger } from "../lib/logger";

export const schema = z.object({});

const STUCK_STATUSES = ["WAITING_APPROVAL", "BLOCKED"] as const;

interface OpenAlert {
  id: string;
  type: string;
  metadata: unknown;
  createdAt: Date;
}

function metaKey(metadata: unknown): string {
  const m = (metadata ?? {}) as Record<string, unknown>;
  return String(
    m.sessionId ??
      m.period ??
      `${m.repositoryId ?? ""}|${m.branch ?? ""}|${m.command ?? ""}`,
  );
}

async function openWatchdogAlerts(
  workspaceId: string,
  type: string,
): Promise<OpenAlert[]> {
  return prisma.alert.findMany({
    where: { workspaceId, type, status: "OPEN" },
    select: { id: true, type: true, metadata: true, createdAt: true },
  });
}

async function ensureOpen(
  workspaceId: string,
  type: string,
  key: string,
  severity: "WARNING" | "CRITICAL",
  message: string,
  metadata: Record<string, unknown>,
  open: OpenAlert[],
  created: AlertBroadcast[],
): Promise<void> {
  const existing = open.find((a) => metaKey(a.metadata) === key);
  if (existing) {
    const current = await prisma.alert.findUnique({
      where: { id: existing.id },
      select: { severity: true },
    });
    if (current && current.severity !== severity) {
      await prisma.alert.update({
        where: { id: existing.id },
        data: {
          severity,
          message,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    }
    return;
  }
  if (open.length >= WATCHDOG_DEFAULTS.maxOpenPerType) return;
  const row = await prisma.alert.create({
    data: {
      workspaceId,
      severity,
      type,
      message,
      metadata: metadata as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  open.push({
    id: row.id,
    type,
    metadata,
    createdAt: new Date(),
  });
  created.push({
    alertId: row.id,
    workspaceId,
    alertType: type,
    severity: severity === "CRITICAL" ? "critical" : "warning",
    message,
  });
}

async function resolveStale(
  open: OpenAlert[],
  liveKeys: Set<string>,
): Promise<number> {
  const stale = open.filter((a) => !liveKeys.has(metaKey(a.metadata)));
  for (const a of stale) {
    if (!a.id) continue;
    await prisma.alert.update({
      where: { id: a.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  }
  return stale.length;
}

async function checkStuckSessions(
  workspaceId: string,
  now: Date,
  created: AlertBroadcast[],
): Promise<void> {
  const warnMs = env.WATCHDOG_STUCK_MIN * 60_000;
  const critMs = warnMs * 3;
  const sessions = await prisma.agentSession.findMany({
    where: {
      workspaceId,
      status: { in: ["WAITING_APPROVAL", "BLOCKED", "RUNNING"] },
    },
    select: {
      id: true,
      developerId: true,
      status: true,
      updatedAt: true,
    },
  });
  const open = await openWatchdogAlerts(workspaceId, "agent.stuck");
  const live = new Set<string>();

  for (const s of sessions) {
    const stuckMs = now.getTime() - s.updatedAt.getTime();
    let stuck = false;
    let label = "";
    if ((STUCK_STATUSES as readonly string[]).includes(s.status)) {
      stuck = stuckMs >= warnMs;
      label =
        s.status === "WAITING_APPROVAL" ? "waiting on approval" : "blocked";
    } else if (s.status === "RUNNING" && stuckMs >= critMs) {
      const recent = await prisma.agentEvent.findFirst({
        where: {
          agentSessionId: s.id,
          occurredAt: { gte: new Date(now.getTime() - critMs) },
        },
        select: { id: true },
      });
      stuck = !recent;
      label = "silent";
    }
    if (!stuck) continue;
    const minutes = Math.round(stuckMs / 60_000);
    live.add(s.id);
    await ensureOpen(
      workspaceId,
      "agent.stuck",
      s.id,
      stuckMs >= critMs ? "CRITICAL" : "WARNING",
      `Agent session ${label} — ${minutes}m`,
      {
        sessionId: s.id,
        developerId: s.developerId,
        status: s.status.toLowerCase(),
        stuckMinutes: minutes,
      },
      open,
      created,
    );
  }
  await resolveStale(open, live);
}

async function checkTokenBurn(
  workspaceId: string,
  now: Date,
  created: AlertBroadcast[],
): Promise<void> {
  const windowStart = new Date(
    now.getTime() - WATCHDOG_DEFAULTS.burnWindowMin * 60_000,
  );
  const usages = await prisma.tokenUsage.groupBy({
    by: ["sessionId"],
    where: {
      session: { workspaceId },
      measuredAt: { gte: windowStart },
      sessionId: { not: null },
    },
    _sum: { inputTokens: true, outputTokens: true, costCents: true },
  });
  const open = await openWatchdogAlerts(workspaceId, "token.burn");
  const live = new Set<string>();

  for (const u of usages) {
    if (!u.sessionId) continue;
    const windowTokens = (u._sum.inputTokens ?? 0) + (u._sum.outputTokens ?? 0);
    if (windowTokens < env.WATCHDOG_BURN_TOKENS) continue;
    const output = await prisma.agentEvent.findFirst({
      where: { agentSessionId: u.sessionId, type: EventType.FILE_MODIFIED },
      select: { id: true },
    });
    if (output) continue;
    const session = await prisma.agentSession.findUnique({
      where: { id: u.sessionId },
      select: { developerId: true, endedAt: true },
    });
    if (!session || session.endedAt) continue;
    const windowCostCents = u._sum.costCents ?? null;
    live.add(u.sessionId);
    await ensureOpen(
      workspaceId,
      "token.burn",
      u.sessionId,
      windowCostCents !== null &&
        windowCostCents >= env.WATCHDOG_BURN_COST_CENTS
        ? "CRITICAL"
        : "WARNING",
      `Agent session burning tokens with no file output`,
      {
        sessionId: u.sessionId,
        developerId: session.developerId,
        windowTokens,
        windowCostCents,
      },
      open,
      created,
    );
  }
  await resolveStale(open, live);
}

async function checkFailingStreaks(
  workspaceId: string,
  created: AlertBroadcast[],
): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const runs = await prisma.testRun.findMany({
    where: {
      OR: [{ repository: { workspaceId } }, { activity: { workspaceId } }],
      status: { in: ["FAILED", "PASSED"] },
      startedAt: { gte: since },
    },
    select: {
      status: true,
      startedAt: true,
      repositoryId: true,
      branch: true,
      command: true,
      repository: { select: { name: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 500,
  });
  const groups = new Map<string, typeof runs>();
  for (const r of runs) {
    const key = `${r.repositoryId ?? ""}|${r.branch ?? ""}|${r.command ?? ""}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }
  const open = await openWatchdogAlerts(workspaceId, "test.failing_streak");
  const live = new Set<string>();

  for (const [key, list] of groups) {
    let streak = 0;
    for (const r of list) {
      if (r.status === "FAILED") streak += 1;
      else break;
    }
    if (streak < WATCHDOG_DEFAULTS.failStreak) continue;
    const head = list[0];
    if (!head) continue;
    live.add(key);
    await ensureOpen(
      workspaceId,
      "test.failing_streak",
      key,
      streak >= WATCHDOG_DEFAULTS.failStreak + 2 ? "CRITICAL" : "WARNING",
      `Tests failing ${streak}x in a row${head.repository ? ` (${head.repository.name})` : ""}`,
      {
        repositoryId: head.repositoryId,
        repositoryName: head.repository?.name ?? null,
        branch: head.branch,
        command: head.command,
        consecutiveFailures: streak,
      },
      open,
      created,
    );
  }
  await resolveStale(open, live);
}

async function checkBudgets(
  workspaceId: string,
  now: Date,
  created: AlertBroadcast[],
): Promise<void> {
  const budget = await prisma.usageBudget.findUnique({
    where: { workspaceId },
  });
  const open = await openWatchdogAlerts(workspaceId, "budget.risk");
  if (!budget?.monthlyCapCents) {
    await resolveStale(open, new Set());
    return;
  }
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const period = monthStart.toISOString().slice(0, 7);
  const spend = await prisma.tokenUsage.aggregate({
    where: {
      session: { workspaceId },
      measuredAt: { gte: monthStart },
    },
    _sum: { costCents: true },
  });
  const monthSpendCents = spend._sum.costCents ?? 0;
  const pct = (monthSpendCents / budget.monthlyCapCents) * 100;
  const live = new Set<string>();
  if (pct >= 100) {
    live.add(period);
    await ensureOpen(
      workspaceId,
      "budget.risk",
      period,
      "CRITICAL",
      `Monthly token budget exceeded (${Math.round(pct)}%)`,
      {
        period,
        monthSpendCents,
        monthlyCapCents: budget.monthlyCapCents,
        pct: Math.round(pct),
      },
      open,
      created,
    );
  } else if (pct >= budget.alertAtPct) {
    live.add(period);
    await ensureOpen(
      workspaceId,
      "budget.risk",
      period,
      "WARNING",
      `Monthly token budget at ${Math.round(pct)}%`,
      {
        period,
        monthSpendCents,
        monthlyCapCents: budget.monthlyCapCents,
        pct: Math.round(pct),
      },
      open,
      created,
    );
  }
  await resolveStale(open, live);
}

export async function checkWorkspace(
  workspaceId: string,
  now: Date = new Date(),
): Promise<void> {
  const created: AlertBroadcast[] = [];
  await checkStuckSessions(workspaceId, now, created);
  await checkTokenBurn(workspaceId, now, created);
  await checkFailingStreaks(workspaceId, created);
  await checkBudgets(workspaceId, now, created);
  // Instant fan-out to connected dashboards (polling covers the rest).
  for (const event of created) {
    await publishAlert(event, logger);
  }
}

export async function handler(): Promise<void> {
  const now = new Date();
  const workspaces = await prisma.workspace.findMany({
    select: { id: true },
  });
  let created = 0;
  for (const { id } of workspaces) {
    const before = await prisma.alert.count({
      where: { workspaceId: id, status: "OPEN" },
    });
    await checkWorkspace(id, now);
    const after = await prisma.alert.count({
      where: { workspaceId: id, status: "OPEN" },
    });
    created += Math.max(0, after - before);
  }
  logger.info(
    `[watchdog.check] scanned ${workspaces.length} workspaces (+${created} open)`,
  );
}
