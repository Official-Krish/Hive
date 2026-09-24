import { describe, expect, test } from "bun:test";
import { prisma } from "@hive/db";
import type { AlertBroadcast, EnforcementCommand } from "@hive/queue";
import { checkWorkspace } from "../src/jobs/watchdog.check";
import { createFixture, unique } from "./helpers";

async function openAlerts(workspaceId: string, type: string) {
  return prisma.alert.findMany({
    where: { workspaceId, type, status: "OPEN" },
  });
}

async function seedSpend(
  workspaceId: string,
  userId: string,
  agentId: string,
  modelId: string,
  costCents: number,
): Promise<void> {
  const session = await prisma.agentSession.create({
    data: {
      developerId: userId,
      agentId,
      workspaceId,
      status: "COMPLETED",
    },
  });
  await prisma.tokenUsage.create({
    data: {
      sessionId: session.id,
      modelId,
      inputTokens: 100,
      outputTokens: 10,
      costCents,
      measuredAt: new Date(),
    },
  });
}

async function setBudget(
  workspaceId: string,
  input: {
    monthlyCapCents?: number | null;
    memberCapCents?: number | null;
    hardEnforce?: boolean;
  },
): Promise<void> {
  await prisma.usageBudget.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      monthlyCapCents: input.monthlyCapCents ?? null,
      alertAtPct: 80,
      memberCapCents: input.memberCapCents ?? null,
      hardEnforce: input.hardEnforce ?? false,
    },
    update: {
      monthlyCapCents: input.monthlyCapCents ?? null,
      memberCapCents: input.memberCapCents ?? null,
      hardEnforce: input.hardEnforce ?? false,
    },
  });
}

async function addMember(workspaceId: string): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `${unique("user")}@example.com`, name: "Member" },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId, userId: user.id, role: "MEMBER" },
  });
  return user.id;
}

async function cleanupWorkspace(workspaceId: string): Promise<void> {
  await prisma.alert.deleteMany({ where: { workspaceId } });
  await prisma.usageBudget.deleteMany({ where: { workspaceId } });
  await prisma.tokenUsage.deleteMany({
    where: { session: { workspaceId } },
  });
  await prisma.agentSession.deleteMany({ where: { workspaceId } });
  await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
}

function hooks(received: EnforcementCommand[], alerts: AlertBroadcast[]) {
  return {
    onAlert: async (e: AlertBroadcast) => {
      alerts.push(e);
    },
    onEnforce: async (c: EnforcementCommand) => {
      received.push(c);
    },
  };
}

describe("budget enforcement", () => {
  test("soft breach alerts without stopping anything", async () => {
    const f = await createFixture();
    const received: EnforcementCommand[] = [];
    const alerts: AlertBroadcast[] = [];
    try {
      await addMember(f.workspaceId);
      await prisma.workspaceMember.create({
        data: { workspaceId: f.workspaceId, userId: f.userId, role: "MEMBER" },
      });
      await setBudget(f.workspaceId, {
        monthlyCapCents: 100,
        hardEnforce: false,
      });
      await seedSpend(f.workspaceId, f.userId, f.agentId, f.modelId, 150);

      await checkWorkspace(f.workspaceId, new Date(), hooks(received, alerts));

      const risk = await openAlerts(f.workspaceId, "budget.risk");
      expect(risk.length).toBe(1);
      expect(risk[0]?.severity).toBe("CRITICAL");
      expect(await openAlerts(f.workspaceId, "budget.enforced")).toHaveLength(
        0,
      );
      expect(received).toHaveLength(0);
      expect(alerts.some((a) => a.alertType === "budget.risk")).toBe(true);
    } finally {
      await cleanupWorkspace(f.workspaceId);
      await f.cleanup();
    }
  });

  test("hard workspace breach stops all collectors exactly once", async () => {
    const f = await createFixture();
    const received: EnforcementCommand[] = [];
    const alerts: AlertBroadcast[] = [];
    try {
      await prisma.workspaceMember.create({
        data: { workspaceId: f.workspaceId, userId: f.userId, role: "MEMBER" },
      });
      await setBudget(f.workspaceId, {
        monthlyCapCents: 100,
        hardEnforce: true,
      });
      await seedSpend(f.workspaceId, f.userId, f.agentId, f.modelId, 150);

      await checkWorkspace(f.workspaceId, new Date(), hooks(received, alerts));

      const enforced = await openAlerts(f.workspaceId, "budget.enforced");
      expect(enforced).toHaveLength(1);
      expect(received).toHaveLength(1);
      expect(received[0]?.userId).toBeNull();
      expect(received[0]?.workspaceId).toBe(f.workspaceId);
      expect(alerts.some((a) => a.alertType === "budget.enforced")).toBe(true);

      // Still breaching: latched, no repeat command.
      await checkWorkspace(f.workspaceId, new Date(), hooks(received, alerts));
      expect(await openAlerts(f.workspaceId, "budget.enforced")).toHaveLength(
        1,
      );
      expect(received).toHaveLength(1);

      // Back under cap: alerts resolve and the switch re-arms.
      await prisma.tokenUsage.deleteMany({
        where: { session: { workspaceId: f.workspaceId } },
      });
      await checkWorkspace(f.workspaceId, new Date(), hooks(received, alerts));
      expect(await openAlerts(f.workspaceId, "budget.enforced")).toHaveLength(
        0,
      );
      expect(await openAlerts(f.workspaceId, "budget.risk")).toHaveLength(0);
    } finally {
      await cleanupWorkspace(f.workspaceId);
      await f.cleanup();
    }
  });

  test("hard member breach stops only that member", async () => {
    const f = await createFixture();
    const received: EnforcementCommand[] = [];
    const alerts: AlertBroadcast[] = [];
    let otherId = "";
    try {
      otherId = await addMember(f.workspaceId);
      await prisma.workspaceMember.create({
        data: { workspaceId: f.workspaceId, userId: f.userId, role: "MEMBER" },
      });
      await setBudget(f.workspaceId, {
        memberCapCents: 100,
        hardEnforce: true,
      });
      await seedSpend(f.workspaceId, f.userId, f.agentId, f.modelId, 150);
      await seedSpend(f.workspaceId, otherId, f.agentId, f.modelId, 10);

      await checkWorkspace(f.workspaceId, new Date(), hooks(received, alerts));

      const enforced = await openAlerts(f.workspaceId, "budget.enforced");
      expect(enforced).toHaveLength(1);
      expect(enforced[0]?.metadata).toMatchObject({ memberId: f.userId });
      expect(received).toHaveLength(1);
      expect(received[0]?.userId).toBe(f.userId);
    } finally {
      await cleanupWorkspace(f.workspaceId);
      if (otherId) await prisma.user.delete({ where: { id: otherId } });
      await f.cleanup();
    }
  });

  test("member caps do nothing when hard enforce is off", async () => {
    const f = await createFixture();
    const received: EnforcementCommand[] = [];
    const alerts: AlertBroadcast[] = [];
    try {
      await prisma.workspaceMember.create({
        data: { workspaceId: f.workspaceId, userId: f.userId, role: "MEMBER" },
      });
      await setBudget(f.workspaceId, {
        memberCapCents: 100,
        hardEnforce: false,
      });
      await seedSpend(f.workspaceId, f.userId, f.agentId, f.modelId, 150);

      await checkWorkspace(f.workspaceId, new Date(), hooks(received, alerts));

      const risk = await openAlerts(f.workspaceId, "budget.risk");
      expect(risk.length).toBe(1);
      expect(await openAlerts(f.workspaceId, "budget.enforced")).toHaveLength(
        0,
      );
      expect(received).toHaveLength(0);
    } finally {
      await cleanupWorkspace(f.workspaceId);
      await f.cleanup();
    }
  });
});
