import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { makeClient, startServer, stopServer } from "./helpers";
import type { TestClient } from "./helpers";

let server: Server;
let c: TestClient;
let idCounter = 0;

const ts = "2026-08-19T10:00:00.000Z";
const uniqueId = (prefix: string): string =>
  `${prefix}-${++idCounter}-${Date.now()}`;

type Collector = {
  token: string;
  workspaceId: string;
  developerId: string;
  sessionId: string;
  activityId: string;
  testRunId: string;
  sha: string;
};

async function setupSeeded(): Promise<Collector> {
  const email = await c.registerUser();
  const { token } = await c.registerDevice();
  const membership = await prisma.workspaceMember.findFirst({
    where: { user: { email } },
    select: { workspaceId: true },
  });
  const workspaceId = membership!.workspaceId;
  const me = await c.api("/api/v1/auth/me");
  const meBody = await c.asJson<{ data: { user: { id: string } } }>(me);
  const developerId = meBody.data.user.id;

  const sessionId = uniqueId("sess");
  const activityId = uniqueId("act");
  const testRunId = uniqueId("run");
  const sha = uniqueId("sha");

  await prisma.model.upsert({
    where: { provider_name: { provider: "anthropic", name: "claude-test" } },
    create: {
      provider: "anthropic",
      name: "claude-test",
      inputPricePerMillion: 2,
      outputPricePerMillion: 10,
    },
    update: {},
  });

  const res = await c.api("/api/v1/ingest/events", {
    method: "POST",
    body: {
      deviceId: "dev",
      workspaceId,
      timestamp: ts,
      events: [
        {
          type: "agent.started",
          timestamp: ts,
          sessionId,
          agent: "claude",
          model: "claude-test",
          title: "Seed session",
        },
        {
          type: "agent.token_usage",
          timestamp: ts,
          sessionId,
          provider: "anthropic",
          model: "claude-test",
          inputTokens: 100_000,
          outputTokens: 20_000,
        },
        {
          type: "file.modified",
          timestamp: ts,
          path: "src/reads.ts",
        },
        {
          type: "agent.stopped",
          timestamp: ts,
          sessionId,
          status: "completed",
        },
        {
          type: "activity.started",
          timestamp: ts,
          activityId,
          activityType: "coding",
          title: "Build reads API",
        },
        {
          type: "activity.updated",
          timestamp: ts,
          activityId,
          summary: "middle",
        },
        {
          type: "activity.stopped",
          timestamp: ts,
          activityId,
          outcome: "success",
        },
        {
          type: "git.commit",
          timestamp: ts,
          repository: "acme/reads",
          branch: "main",
          sha,
          message: "feat: reads",
          insertions: 10,
          deletions: 2,
        },
        {
          type: "git.pull_request",
          timestamp: ts,
          repository: "acme/reads",
          number: 101,
          title: "Reads API",
          status: "open",
        },
        {
          type: "test.started",
          timestamp: ts,
          testRunId,
          activityId,
          command: "bun test",
        },
        {
          type: "test.finished",
          timestamp: ts,
          testRunId,
          status: "passed",
          totalTests: 12,
          passedTests: 12,
          durationMs: 500,
        },
      ],
    },
    headers: { "x-device-token": token },
  });
  expect(res.status).toBe(200);

  return {
    token,
    workspaceId,
    developerId,
    sessionId,
    activityId,
    testRunId,
    sha,
  };
}

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  c = makeClient(started.baseUrl);
});

afterAll(async () => {
  await stopServer(server);
});

describe("reads auth + membership", () => {
  test("returns 401 without a session", async () => {
    c.clearJar();
    const res = await c.api("/api/v1/workspaces/x/map");
    expect(res.status).toBe(401);
  });

  test("returns 403 for a non-member on every read endpoint", async () => {
    const seed = await setupSeeded();
    await c.registerUser();
    const endpoints = [
      `/api/v1/workspaces/${seed.workspaceId}/map`,
      `/api/v1/workspaces/${seed.workspaceId}/activities`,
      `/api/v1/workspaces/${seed.workspaceId}/agent-sessions`,
      `/api/v1/workspaces/${seed.workspaceId}/repositories`,
      `/api/v1/workspaces/${seed.workspaceId}/pull-requests`,
      `/api/v1/workspaces/${seed.workspaceId}/metrics`,
      `/api/v1/workspaces/${seed.workspaceId}/alerts`,
      `/api/v1/workspaces/${seed.workspaceId}/tasks`,
      `/api/v1/workspaces/${seed.workspaceId}/test-runs`,
    ];
    for (const path of endpoints) {
      const res = await c.api(path);
      expect(res.status).toBe(403);
    }
  });
});

describe("map", () => {
  test("returns the workspace map with the member in the snapshot", async () => {
    const seed = await setupSeeded();
    const res = await c.api(`/api/v1/workspaces/${seed.workspaceId}/map`);
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: {
        mapId: string;
        name: string;
        version: number;
        members: Array<{ userId: string; name: string }>;
      };
    }>(res);
    expect(body.data.name).toBe("Default");
    expect(body.data.members.map((m) => m.userId)).toContain(seed.developerId);
  });
});

describe("activities", () => {
  test("lists seeded activities with pagination metadata", async () => {
    const seed = await setupSeeded();
    const res = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/activities?page=1&pageSize=10`,
    );
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: {
        items: Array<{ id: string; type: string; status: string }>;
        total: number;
        hasMore: boolean;
      };
    }>(res);
    expect(body.data.total).toBeGreaterThan(0);
    expect(body.data.items.map((i) => i.id)).toContain(seed.activityId);
    const item = body.data.items.find((i) => i.id === seed.activityId)!;
    expect(item.type).toBe("coding");
    expect(item.status).toBe("completed");
  });

  test("filters by status and paginates", async () => {
    const seed = await setupSeeded();
    const secondActivity = uniqueId("act");
    await c.api("/api/v1/ingest/events", {
      method: "POST",
      body: {
        deviceId: "dev",
        workspaceId: seed.workspaceId,
        timestamp: ts,
        events: [
          {
            type: "activity.started",
            timestamp: ts,
            activityId: secondActivity,
            activityType: "research",
            title: "Second activity",
          },
          {
            type: "activity.stopped",
            timestamp: ts,
            activityId: secondActivity,
            outcome: "success",
          },
        ],
      },
      headers: { "x-device-token": seed.token },
    });
    const res = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/activities?status=completed&pageSize=1`,
    );
    const body = await c.asJson<{
      data: { items: unknown[]; total: number; hasMore: boolean };
    }>(res);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.total).toBe(2);
    expect(body.data.hasMore).toBe(true);
  });

  test("returns full activity detail", async () => {
    const seed = await setupSeeded();
    const res = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/activities/${seed.activityId}`,
    );
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: {
        summary: string | null;
        outcomeStatus: string;
        events: Array<{ type: string }>;
        testRuns: Array<{ status: string }>;
      };
    }>(res);
    expect(body.data.summary).toBe("middle");
    expect(body.data.outcomeStatus).toBe("success");
    expect(body.data.testRuns).toHaveLength(1);
    expect(body.data.testRuns[0]?.status).toBe("passed");
  });
});

describe("agent sessions", () => {
  test("lists sessions with token totals", async () => {
    const seed = await setupSeeded();
    const res = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/agent-sessions`,
    );
    const body = await c.asJson<{
      data: {
        items: Array<{
          id: string;
          status: string;
          inputTokens: number;
          outputTokens: number;
        }>;
      };
    }>(res);
    const session = body.data.items.find((s) => s.id === seed.sessionId)!;
    expect(session.status).toBe("completed");
    expect(session.inputTokens).toBe(100_000);
    expect(session.outputTokens).toBe(20_000);
  });

  test("returns session detail with the event timeline", async () => {
    const seed = await setupSeeded();
    const res = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/agent-sessions/${seed.sessionId}`,
    );
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: {
        events: Array<{ type: string; payload: { path?: string } }>;
        tokenUsage: Array<{ inputTokens: number; costCents: number | null }>;
      };
    }>(res);
    const types = body.data.events.map((e) => e.type);
    expect(types).toContain("file_modified");
    expect(body.data.tokenUsage[0]?.inputTokens).toBe(100_000);
    expect(body.data.tokenUsage[0]?.costCents).toBe(40);
  });
});

describe("repositories + PRs", () => {
  test("lists repositories with open PR count", async () => {
    const seed = await setupSeeded();
    const res = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/repositories`,
    );
    const body = await c.asJson<{
      data: Array<{ name: string; openPrCount: number }>;
    }>(res);
    const repo = body.data.find((r) => r.name === "acme/reads")!;
    expect(repo.openPrCount).toBe(1);
  });

  test("returns repository detail with branch, commit and PR", async () => {
    const seed = await setupSeeded();
    const list = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/repositories`,
    );
    const listBody = await c.asJson<{ data: Array<{ id: string }> }>(list);
    const repoId = listBody.data[0]!.id;

    const res = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/repositories/${repoId}`,
    );
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: {
        branches: Array<{ name: string }>;
        commits: Array<{ sha: string }>;
        pullRequests: Array<{ number: number; status: string }>;
      };
    }>(res);
    expect(body.data.branches.map((b) => b.name)).toContain("main");
    expect(body.data.commits.map((c) => c.sha)).toContain(seed.sha);
    expect(body.data.pullRequests[0]).toMatchObject({
      number: 101,
      status: "open",
    });
  });

  test("lists pull requests with the status filter", async () => {
    const seed = await setupSeeded();
    const res = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/pull-requests?status=open`,
    );
    const body = await c.asJson<{
      data: {
        items: Array<{ number: number; status: string }>;
      };
    }>(res);
    expect(body.data.items[0]).toMatchObject({ number: 101, status: "open" });
  });
});

describe("metrics, alerts, tasks", () => {
  test("lists metrics and resolves an alert as an admin", async () => {
    const seed = await setupSeeded();
    const periodStart = new Date("2026-08-17T00:00:00.000Z");
    await prisma.efficiencyMetric.create({
      data: {
        workspaceId: seed.workspaceId,
        period: "WEEK",
        periodStart,
        tasksCompleted: 5,
        prsMerged: 2,
        tokensTotal: 100_000,
        costTotalCents: 120,
      },
    });
    const metricsRes = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/metrics?period=week`,
    );
    const metricsBody = await c.asJson<{
      data: Array<{ period: string; tasksCompleted: number }>;
    }>(metricsRes);
    expect(metricsBody.data[0]).toMatchObject({
      period: "week",
      tasksCompleted: 5,
    });

    const alert = await prisma.alert.create({
      data: {
        workspaceId: seed.workspaceId,
        severity: "WARNING",
        type: "token-spike",
        message: "Usage spike detected",
        status: "OPEN",
      },
    });
    const alertsRes = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/alerts?severity=warning`,
    );
    const alertsBody = await c.asJson<{
      data: { items: Array<{ id: string; status: string }> };
    }>(alertsRes);
    expect(alertsBody.data.items[0]).toMatchObject({
      id: alert.id,
      status: "open",
    });

    const resolve = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/alerts/${alert.id}/resolve`,
      { method: "POST" },
    );
    expect(resolve.status).toBe(204);
    const updated = await prisma.alert.findUniqueOrThrow({
      where: { id: alert.id },
    });
    expect(updated.status).toBe("RESOLVED");
  });

  test("lists tasks with filters", async () => {
    const seed = await setupSeeded();
    await prisma.task.create({
      data: {
        workspaceId: seed.workspaceId,
        developerId: seed.developerId,
        title: "Fix reads bug",
        priority: "HIGH",
        status: "OPEN",
      },
    });
    const res = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/tasks?priority=high`,
    );
    const body = await c.asJson<{
      data: {
        items: Array<{ title: string; priority: string; status: string }>;
      };
    }>(res);
    expect(body.data.items[0]).toMatchObject({
      title: "Fix reads bug",
      priority: "high",
      status: "open",
    });
  });
});

describe("models, test runs, developer stats", () => {
  test("lists models including the seeded one", async () => {
    await setupSeeded();
    const res = await c.api("/api/v1/models");
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: Array<{ provider: string; name: string }>;
    }>(res);
    expect(body.data.find((m) => m.name === "claude-test")).toMatchObject({
      provider: "anthropic",
    });
  });

  test("lists test runs", async () => {
    const seed = await setupSeeded();
    const res = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/test-runs?status=passed`,
    );
    const body = await c.asJson<{
      data: {
        items: Array<{ id: string; status: string; totalTests: number }>;
      };
    }>(res);
    expect(body.data.items[0]).toMatchObject({
      id: seed.testRunId,
      status: "passed",
      totalTests: 12,
    });
  });

  test("returns developer stats with token totals and counts", async () => {
    const seed = await setupSeeded();
    const res = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/developers/${seed.developerId}/stats`,
    );
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: {
        inputTokens: number;
        outputTokens: number;
        costCents: number | null;
        sessionCount: number;
        activityCount: number;
      };
    }>(res);
    expect(body.data.inputTokens).toBe(100_000);
    expect(body.data.outputTokens).toBe(20_000);
    expect(body.data.costCents).toBe(40);
    expect(body.data.sessionCount).toBe(1);
    expect(body.data.activityCount).toBe(1);
  });
});
