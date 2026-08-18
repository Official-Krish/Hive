import { z } from "zod";
import { prisma } from "@hive/db";
import { logger } from "../lib/logger";

export const schema = z.object({
  windows: z.array(
    z.object({
      period: z.enum(["DAY", "WEEK", "MONTH"]),
      periodStart: z.string().min(1),
    }),
  ),
});

type Payload = z.infer<typeof schema>;

const PERIOD_MS: Record<"DAY" | "WEEK" | "MONTH", (start: Date) => Date> = {
  DAY: (start) => new Date(start.getTime() + 24 * 60 * 60 * 1000),
  WEEK: (start) => new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000),
  MONTH: (start) =>
    new Date(
      start.getUTCFullYear(),
      start.getUTCMonth() + 1,
      start.getUTCDate(),
    ),
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

export async function handler(payload: Payload): Promise<void> {
  const workspaces = await prisma.workspace.findMany({ select: { id: true } });
  for (const { id: workspaceId } of workspaces) {
    for (const window of payload.windows) {
      const start = new Date(window.periodStart);
      const end = PERIOD_MS[window.period](start);
      await computeWorkspaceWindow(workspaceId, window.period, start, end);
    }
  }
  logger.info(
    `[metrics.aggregate] computed metrics for ${workspaces.length} workspaces`,
  );
}

type Scope = {
  OR: [
    { session: { workspaceId: string } },
    { activity: { workspaceId: string } },
  ];
};

async function computeWorkspaceWindow(
  workspaceId: string,
  period: "DAY" | "WEEK" | "MONTH",
  start: Date,
  end: Date,
): Promise<void> {
  const scope: Scope = {
    OR: [{ session: { workspaceId } }, { activity: { workspaceId } }],
  };

  await backfillCosts(workspaceId, start, end, scope);

  const agg = await prisma.tokenUsage.aggregate({
    where: { ...scope, measuredAt: { gte: start, lt: end } },
    _sum: { inputTokens: true, outputTokens: true, costCents: true },
  });

  const tokensTotal =
    (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0);
  const costTotalCents = agg._sum.costCents ?? 0;

  const tasksCompleted = await prisma.task.count({
    where: {
      workspaceId,
      status: "COMPLETED",
      completedAt: { gte: start, lt: end },
    },
  });

  const prsMerged = await prisma.pullRequest.count({
    where: {
      repository: { workspaceId },
      status: "MERGED",
      mergedAt: { gte: start, lt: end },
    },
  });

  const agentsTotal = await prisma.agentSession.count({
    where: { workspaceId, startedAt: { gte: start, lt: end } },
  });

  const ended = await prisma.agentSession.count({
    where: {
      workspaceId,
      endedAt: { gte: start, lt: end },
      status: { in: ["COMPLETED", "ERROR", "STOPPED"] },
    },
  });
  const completed = await prisma.agentSession.count({
    where: {
      workspaceId,
      endedAt: { gte: start, lt: end },
      status: "COMPLETED",
    },
  });
  const errored = await prisma.agentSession.count({
    where: { workspaceId, endedAt: { gte: start, lt: end }, status: "ERROR" },
  });

  const agentSuccessRate = ended > 0 ? round2((completed / ended) * 100) : null;
  const retryRate = ended > 0 ? round2((errored / ended) * 100) : null;
  const tokensPerTask =
    tasksCompleted > 0 ? round2(tokensTotal / tasksCompleted) : null;
  const costPerPrCents =
    prsMerged > 0 ? Math.round(costTotalCents / prsMerged) : null;

  const data = {
    tokensPerTask,
    costPerPrCents,
    agentSuccessRate,
    retryRate,
    tasksCompleted: tasksCompleted || null,
    prsMerged: prsMerged || null,
    agentsTotal: agentsTotal || null,
    tokensTotal: tokensTotal || null,
    costTotalCents: costTotalCents || null,
  };

  await prisma.efficiencyMetric.upsert({
    where: {
      workspaceId_period_periodStart: {
        workspaceId,
        period,
        periodStart: start,
      },
    },
    create: { workspaceId, period, periodStart: start, ...data },
    update: { ...data, computedAt: new Date() },
  });
}

async function backfillCosts(
  workspaceId: string,
  start: Date,
  end: Date,
  scope: Scope,
): Promise<void> {
  const uncosted = await prisma.tokenUsage.findMany({
    where: {
      ...scope,
      measuredAt: { gte: start, lt: end },
      costCents: null,
      modelId: { not: null },
    },
    include: { model: true },
  });
  for (const usage of uncosted) {
    const model = usage.model;
    if (!model?.inputPricePerMillion || !model.outputPricePerMillion) continue;
    const inputCents =
      (usage.inputTokens / 1_000_000) *
      model.inputPricePerMillion.toNumber() *
      100;
    const outputCents =
      (usage.outputTokens / 1_000_000) *
      model.outputPricePerMillion.toNumber() *
      100;
    await prisma.tokenUsage.update({
      where: { id: usage.id },
      data: { costCents: Math.round(inputCents + outputCents) },
    });
  }
}
