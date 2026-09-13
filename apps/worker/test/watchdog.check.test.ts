import { describe, expect, test } from "bun:test";
import { prisma } from "@hive/db";
import { checkWorkspace } from "../src/jobs/watchdog.check";
import { createFixture } from "./helpers";

async function openAlerts(workspaceId: string, type: string) {
  return prisma.alert.findMany({
    where: { workspaceId, type, status: "OPEN" },
  });
}

describe("watchdog.check", () => {
  test("flags a stuck approval session once, escalates, then auto-resolves", async () => {
    const f = await createFixture();
    try {
      const session = await prisma.agentSession.create({
        data: {
          developerId: f.userId,
          agentId: f.agentId,
          workspaceId: f.workspaceId,
          title: "stuck session",
          status: "WAITING_APPROVAL",
          updatedAt: new Date(Date.now() - 15 * 60_000),
        },
      });

      await checkWorkspace(f.workspaceId);
      let alerts = await openAlerts(f.workspaceId, "agent.stuck");
      expect(alerts.length).toBe(1);
      expect(alerts[0]?.severity).toBe("WARNING");

      await checkWorkspace(f.workspaceId);
      alerts = await openAlerts(f.workspaceId, "agent.stuck");
      expect(alerts.length).toBe(1);

      await prisma.agentSession.update({
        where: { id: session.id },
        data: {
          status: "WAITING_APPROVAL",
          updatedAt: new Date(Date.now() - 40 * 60_000),
        },
      });
      await checkWorkspace(f.workspaceId);
      alerts = await openAlerts(f.workspaceId, "agent.stuck");
      expect(alerts.length).toBe(1);
      expect(alerts[0]?.severity).toBe("CRITICAL");

      await prisma.agentSession.update({
        where: { id: session.id },
        data: { status: "COMPLETED", endedAt: new Date() },
      });
      await checkWorkspace(f.workspaceId);
      alerts = await openAlerts(f.workspaceId, "agent.stuck");
      expect(alerts.length).toBe(0);
    } finally {
      await prisma.alert.deleteMany({ where: { workspaceId: f.workspaceId } });
      await f.cleanup();
    }
  });

  test("flags three consecutive test failures, clears on pass", async () => {
    const f = await createFixture();
    try {
      for (let i = 0; i < 2; i++) {
        await prisma.testRun.create({
          data: {
            developerId: f.userId,
            repositoryId: f.repositoryId,
            branch: "main",
            command: "bun test",
            status: "FAILED",
            startedAt: new Date(Date.now() - (3 - i) * 60_000),
            endedAt: new Date(Date.now() - (3 - i) * 60_000 + 1000),
          },
        });
      }
      await checkWorkspace(f.workspaceId);
      expect(
        (await openAlerts(f.workspaceId, "test.failing_streak")).length,
      ).toBe(0);

      await prisma.testRun.create({
        data: {
          developerId: f.userId,
          repositoryId: f.repositoryId,
          branch: "main",
          command: "bun test",
          status: "FAILED",
          startedAt: new Date(),
          endedAt: new Date(),
        },
      });
      await checkWorkspace(f.workspaceId);
      let alerts = await openAlerts(f.workspaceId, "test.failing_streak");
      expect(alerts.length).toBe(1);
      expect(alerts[0]?.severity).toBe("WARNING");

      await prisma.testRun.create({
        data: {
          developerId: f.userId,
          repositoryId: f.repositoryId,
          branch: "main",
          command: "bun test",
          status: "PASSED",
          startedAt: new Date(),
          endedAt: new Date(),
        },
      });
      await checkWorkspace(f.workspaceId);
      alerts = await openAlerts(f.workspaceId, "test.failing_streak");
      expect(alerts.length).toBe(0);
    } finally {
      await prisma.alert.deleteMany({ where: { workspaceId: f.workspaceId } });
      await f.cleanup();
    }
  });

  test("warns at the budget threshold and escalates past the cap", async () => {
    const f = await createFixture();
    try {
      await prisma.usageBudget.create({
        data: {
          workspaceId: f.workspaceId,
          monthlyCapCents: 1000,
          alertAtPct: 80,
        },
      });
      const session = await prisma.agentSession.create({
        data: {
          developerId: f.userId,
          agentId: f.agentId,
          workspaceId: f.workspaceId,
          status: "COMPLETED",
          endedAt: new Date(),
        },
      });
      await prisma.tokenUsage.create({
        data: {
          sessionId: session.id,
          modelId: f.modelId,
          inputTokens: 100_000,
          outputTokens: 50_000,
          costCents: 850,
        },
      });

      await checkWorkspace(f.workspaceId);
      let alerts = await openAlerts(f.workspaceId, "budget.risk");
      expect(alerts.length).toBe(1);
      expect(alerts[0]?.severity).toBe("WARNING");

      await prisma.tokenUsage.create({
        data: {
          sessionId: session.id,
          modelId: f.modelId,
          inputTokens: 100_000,
          outputTokens: 50_000,
          costCents: 500,
        },
      });
      await checkWorkspace(f.workspaceId);
      alerts = await openAlerts(f.workspaceId, "budget.risk");
      expect(alerts.length).toBe(1);
      expect(alerts[0]?.severity).toBe("CRITICAL");
    } finally {
      await prisma.alert.deleteMany({ where: { workspaceId: f.workspaceId } });
      await prisma.usageBudget.deleteMany({
        where: { workspaceId: f.workspaceId },
      });
      await f.cleanup();
    }
  });

  test("flags token burn with no file output", async () => {
    const f = await createFixture();
    try {
      const session = await prisma.agentSession.create({
        data: {
          developerId: f.userId,
          agentId: f.agentId,
          workspaceId: f.workspaceId,
          status: "RUNNING",
        },
      });
      await prisma.tokenUsage.create({
        data: {
          sessionId: session.id,
          modelId: f.modelId,
          inputTokens: 250_000,
          outputTokens: 10_000,
          costCents: 100,
        },
      });

      await checkWorkspace(f.workspaceId);
      const alerts = await openAlerts(f.workspaceId, "token.burn");
      expect(alerts.length).toBe(1);
      expect(alerts[0]?.severity).toBe("WARNING");
    } finally {
      await prisma.alert.deleteMany({ where: { workspaceId: f.workspaceId } });
      await f.cleanup();
    }
  });
});
