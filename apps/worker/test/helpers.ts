import { prisma } from "@hive/db";

let counter = 0;

export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}_${Math.random().toString(36).slice(2, 6)}`;
}

export interface Fixture {
  userId: string;
  orgId: string;
  workspaceId: string;
  modelId: string;
  agentId: string;
  repositoryId: string;
  cleanup: () => Promise<void>;
}

export async function createFixture(): Promise<Fixture> {
  const org = await prisma.organization.create({
    data: { name: unique("Org"), slug: unique("org") },
  });
  const user = await prisma.user.create({
    data: { email: `${unique("user")}@example.com`, name: "Test User" },
  });
  const workspace = await prisma.workspace.create({
    data: {
      orgId: org.id,
      name: "Test Workspace",
      slug: unique("ws"),
      webhookSecret: unique("whsec"),
    },
  });
  const model = await prisma.model.create({
    data: {
      provider: "test",
      name: unique("model"),
      inputPricePerMillion: 3,
      outputPricePerMillion: 15,
    },
  });
  const agent = await prisma.agent.create({
    data: { workspaceId: workspace.id, name: "test-agent", type: "GENERIC" },
  });
  const repository = await prisma.repository.create({
    data: {
      workspaceId: workspace.id,
      name: unique("repo"),
      provider: "GITHUB",
    },
  });

  const cleanup = async () => {
    await prisma.tokenUsage.deleteMany({
      where: {
        OR: [
          { session: { workspaceId: workspace.id } },
          { activity: { workspaceId: workspace.id } },
        ],
      },
    });
    await prisma.efficiencyMetric.deleteMany({
      where: { workspaceId: workspace.id },
    });
    await prisma.presence.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.testRun.deleteMany({
      where: {
        OR: [
          { activity: { workspaceId: workspace.id } },
          { repositoryId: repository.id },
        ],
      },
    });
    await prisma.invite.deleteMany({ where: { orgId: org.id } });
    await prisma.agent.deleteMany({ where: { workspaceId: workspace.id } });
    await prisma.organization.deleteMany({ where: { id: org.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.model.deleteMany({ where: { id: model.id } });
  };

  return {
    userId: user.id,
    orgId: org.id,
    workspaceId: workspace.id,
    modelId: model.id,
    agentId: agent.id,
    repositoryId: repository.id,
    cleanup,
  };
}
