import { afterEach, test, expect } from "bun:test";
import { prisma } from "@hive/db";
import { handler } from "../src/jobs/metrics.aggregate";
import { createFixture, type Fixture } from "./helpers";

const fixtures: Fixture[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((f) => f.cleanup()));
});

test("aggregates DAY metrics with cost backfill from model pricing", async () => {
  const f = await createFixture();
  fixtures.push(f);

  const windowStart = new Date(Date.UTC(2026, 7, 18));

  const completedSession = await prisma.agentSession.create({
    data: {
      developerId: f.userId,
      agentId: f.agentId,
      workspaceId: f.workspaceId,
      status: "COMPLETED",
      startedAt: windowStart,
      endedAt: new Date(windowStart.getTime() + 60 * 60 * 1000),
    },
  });
  await prisma.agentSession.create({
    data: {
      developerId: f.userId,
      agentId: f.agentId,
      workspaceId: f.workspaceId,
      status: "ERROR",
      startedAt: windowStart,
      endedAt: new Date(windowStart.getTime() + 2 * 60 * 60 * 1000),
    },
  });

  await prisma.tokenUsage.create({
    data: {
      sessionId: completedSession.id,
      modelId: f.modelId,
      inputTokens: 2_000_000,
      outputTokens: 1_000_000,
      measuredAt: new Date(windowStart.getTime() + 30 * 60 * 1000),
    },
  });

  await prisma.task.create({
    data: {
      developerId: f.userId,
      workspaceId: f.workspaceId,
      title: "task",
      status: "COMPLETED",
      completedAt: new Date(windowStart.getTime() + 30 * 60 * 1000),
    },
  });

  await prisma.pullRequest.create({
    data: {
      repositoryId: f.repositoryId,
      number: 1,
      title: "pr",
      status: "MERGED",
      mergedAt: new Date(windowStart.getTime() + 60 * 60 * 1000),
    },
  });

  await handler({
    windows: [{ period: "DAY", periodStart: windowStart.toISOString() }],
  });

  const metric = await prisma.efficiencyMetric.findUnique({
    where: {
      workspaceId_period_periodStart: {
        workspaceId: f.workspaceId,
        period: "DAY",
        periodStart: windowStart,
      },
    },
  });

  expect(metric).not.toBeNull();
  expect(metric!.tokensTotal).toBe(3_000_000);
  expect(metric!.costTotalCents).toBe(2100);
  expect(metric!.tasksCompleted).toBe(1);
  expect(metric!.prsMerged).toBe(1);
  expect(metric!.agentsTotal).toBe(2);
  expect(Number(metric!.tokensPerTask)).toBe(3000000);
  expect(metric!.costPerPrCents).toBe(2100);
  expect(Number(metric!.agentSuccessRate)).toBe(50);
  expect(Number(metric!.retryRate)).toBe(50);
});

test("metric upsert is idempotent", async () => {
  const f = await createFixture();
  fixtures.push(f);

  const windowStart = new Date(Date.UTC(2026, 7, 17));
  await handler({
    windows: [{ period: "DAY", periodStart: windowStart.toISOString() }],
  });
  await handler({
    windows: [{ period: "DAY", periodStart: windowStart.toISOString() }],
  });

  const count = await prisma.efficiencyMetric.count({
    where: {
      workspaceId: f.workspaceId,
      period: "DAY",
      periodStart: windowStart,
    },
  });
  expect(count).toBe(1);
});
