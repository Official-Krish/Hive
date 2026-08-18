import { afterEach, test, expect } from "bun:test";
import { prisma } from "@hive/db";
import { handler as finalizeSessions } from "../src/jobs/finalize.sessions";
import { handler as finalizeActivities } from "../src/jobs/finalize.activities";
import { createFixture, unique, type Fixture } from "./helpers";

const fixtures: Fixture[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((f) => f.cleanup()));
});

test("finalize.sessions flips RUNNING to COMPLETED when ended", async () => {
  const f = await createFixture();
  fixtures.push(f);

  await prisma.agentSession.create({
    data: {
      developerId: f.userId,
      agentId: f.agentId,
      workspaceId: f.workspaceId,
      status: "RUNNING",
      startedAt: new Date(Date.now() - 1000 * 60),
      endedAt: new Date(),
    },
  });
  await prisma.agentSession.create({
    data: {
      developerId: f.userId,
      agentId: f.agentId,
      workspaceId: f.workspaceId,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  await finalizeSessions();

  const rows = await prisma.agentSession.findMany({
    where: { workspaceId: f.workspaceId },
  });
  const statuses = rows.map((r) => r.status);
  expect(statuses).toContain("COMPLETED");
  expect(statuses).toContain("RUNNING");
});

test("finalize.activities aggregates usage and sets outcome", async () => {
  const f = await createFixture();
  fixtures.push(f);

  const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const endedAt = new Date(Date.now() - 60 * 60 * 1000);

  const activity = await prisma.activity.create({
    data: {
      developerId: f.userId,
      workspaceId: f.workspaceId,
      type: "CODING",
      title: "Implement feature",
      status: "IN_PROGRESS",
      startedAt,
      endedAt,
    },
  });

  const sessionA = await prisma.agentSession.create({
    data: {
      developerId: f.userId,
      agentId: f.agentId,
      workspaceId: f.workspaceId,
      activityId: activity.id,
      status: "COMPLETED",
      startedAt,
      endedAt,
    },
  });
  const sessionB = await prisma.agentSession.create({
    data: {
      developerId: f.userId,
      agentId: f.agentId,
      workspaceId: f.workspaceId,
      activityId: activity.id,
      status: "COMPLETED",
      startedAt,
      endedAt,
    },
  });

  await prisma.tokenUsage.create({
    data: {
      sessionId: sessionA.id,
      inputTokens: 100,
      outputTokens: 50,
      costCents: 20,
    },
  });
  await prisma.tokenUsage.create({
    data: {
      sessionId: sessionB.id,
      inputTokens: 200,
      outputTokens: 100,
      costCents: 40,
    },
  });

  const commit = await prisma.commit.create({
    data: {
      repositoryId: f.repositoryId,
      sha: unique("sha"),
      message: "feat: implement",
      authoredAt: endedAt,
      filesChanged: 3,
      insertions: 10,
      deletions: 5,
    },
  });
  const pr = await prisma.pullRequest.create({
    data: {
      repositoryId: f.repositoryId,
      number: 42,
      title: "Implement feature",
      status: "MERGED",
      mergedAt: endedAt,
    },
  });
  await prisma.testRun.create({
    data: { activityId: activity.id, status: "PASSED" },
  });
  await prisma.activity.update({
    where: { id: activity.id },
    data: {
      commits: { connect: [{ id: commit.id }] },
      pullRequests: { connect: [{ id: pr.id }] },
    },
  });

  await finalizeActivities();

  const finalized = await prisma.activity.findUnique({
    where: { id: activity.id },
  });
  expect(finalized!.status).toBe("COMPLETED");
  expect(finalized!.outcomeStatus).toBe("SUCCESS");
  expect(finalized!.filesChanged).toBe(3);
  expect(finalized!.linesChanged).toBe(15);

  const usage = await prisma.tokenUsage.findUnique({
    where: { activityId: activity.id },
  });
  expect(usage).not.toBeNull();
  expect(usage!.inputTokens).toBe(300);
  expect(usage!.outputTokens).toBe(150);
  expect(usage!.costCents).toBe(60);

  await finalizeActivities();
  const count = await prisma.tokenUsage.count({
    where: { activityId: activity.id },
  });
  expect(count).toBe(1);
});

test("finalize.activities marks FAILED on failed tests", async () => {
  const f = await createFixture();
  fixtures.push(f);

  const startedAt = new Date(Date.now() - 1000 * 60);
  const endedAt = new Date();

  const activity = await prisma.activity.create({
    data: {
      developerId: f.userId,
      workspaceId: f.workspaceId,
      type: "TESTING",
      title: "Run tests",
      status: "IN_PROGRESS",
      startedAt,
      endedAt,
    },
  });
  await prisma.testRun.create({
    data: { activityId: activity.id, status: "FAILED" },
  });

  await finalizeActivities();

  const finalized = await prisma.activity.findUnique({
    where: { id: activity.id },
  });
  expect(finalized!.outcomeStatus).toBe("FAILED");
});

test("finalize.activities leaves outcome null when no signals", async () => {
  const f = await createFixture();
  fixtures.push(f);

  const startedAt = new Date(Date.now() - 1000 * 60);
  const endedAt = new Date();

  const activity = await prisma.activity.create({
    data: {
      developerId: f.userId,
      workspaceId: f.workspaceId,
      type: "AGENT",
      title: "Explore",
      status: "IN_PROGRESS",
      startedAt,
      endedAt,
    },
  });

  await finalizeActivities();

  const finalized = await prisma.activity.findUnique({
    where: { id: activity.id },
  });
  expect(finalized!.status).toBe("COMPLETED");
  expect(finalized!.outcomeStatus).toBeNull();
  expect(finalized!.filesChanged).toBeNull();
  expect(finalized!.linesChanged).toBeNull();
});
