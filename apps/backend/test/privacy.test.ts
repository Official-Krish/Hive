import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { makeClient, startServer, stopServer, uniqueEmail } from "./helpers";
import type { TestClient } from "./helpers";

let server: Server;
let c: TestClient;
let idCounter = 0;

const ts = "2026-08-19T10:00:00.000Z";
const uniqueId = (prefix: string): string =>
  `${prefix}-${++idCounter}-${Date.now()}`;

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  c = makeClient(started.baseUrl);
});

afterAll(async () => {
  await stopServer(server);
});

async function loginAs(email: string): Promise<void> {
  c.clearJar();
  const res = await c.api("/api/v1/auth/login", {
    method: "POST",
    body: { email, password: "Password123" },
  });
  expect(res.status).toBe(200);
}

type Seeded = {
  token: string;
  workspaceId: string;
  sessionId: string;
  activityId: string;
};

async function seedWorkspace(): Promise<Seeded> {
  const email = await c.registerUser();
  const { token } = await c.registerDevice();
  const membership = await prisma.workspaceMember.findFirst({
    where: { user: { email } },
    select: { workspaceId: true },
  });
  const workspaceId = membership!.workspaceId;
  const sessionId = uniqueId("sess");
  const activityId = uniqueId("act");

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
          title: "Secret title",
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
          path: "src/secret.ts",
        },
        {
          type: "terminal.command",
          timestamp: ts,
          command: "npm run secret",
        },
        {
          type: "process.started",
          timestamp: ts,
          pid: 42,
          command: "secret-tool run",
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
          title: "Secret activity",
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
          sha: uniqueId("sha"),
          message: "feat: secret",
          insertions: 10,
          deletions: 2,
        },
        {
          type: "git.pull_request",
          timestamp: ts,
          repository: "acme/reads",
          number: 42,
          title: "Secret PR",
          status: "open",
        },
      ],
    },
    headers: { "x-device-token": token },
  });
  expect(res.status).toBe(200);

  return { token, workspaceId, sessionId, activityId };
}

describe("privacy access", () => {
  test("returns 401 without a session", async () => {
    c.clearJar();
    const res = await c.api("/api/v1/workspaces/x/privacy");
    expect(res.status).toBe(401);
  });

  test("any member reads, only admin+ patches", async () => {
    await c.registerUser();
    const workspaceId = await c.primaryWorkspaceId();

    const memberEmail = uniqueEmail("member");
    const token = await c.inviteAndGetToken(workspaceId, memberEmail);
    await c.acceptInviteAs(token, memberEmail);
    await loginAs(memberEmail);

    const get = await c.api(`/api/v1/workspaces/${workspaceId}/privacy`);
    expect(get.status).toBe(200);

    const patch = await c.api(`/api/v1/workspaces/${workspaceId}/privacy`, {
      method: "PATCH",
      body: { allowTokenUsage: false },
    });
    expect(patch.status).toBe(403);
  });
});

describe("privacy get + update", () => {
  test("returns defaults before any change", async () => {
    await c.registerUser();
    const workspaceId = await c.primaryWorkspaceId();

    const res = await c.api(`/api/v1/workspaces/${workspaceId}/privacy`);
    expect(res.status).toBe(200);
    const body = await c.asJson<{ data: Record<string, unknown> }>(res);
    expect(body.data).toMatchObject({
      allowActivitySummaries: true,
      allowAgentStatus: true,
      allowTokenUsage: true,
      allowGitMetadata: true,
      allowExactCommands: false,
      allowFilePaths: false,
      allowPromptMetadata: false,
      updatedById: null,
    });
    expect(typeof body.data.updatedAt).toBe("string");
  });

  test("patch persists and records the actor", async () => {
    await c.registerUser();
    const workspaceId = await c.primaryWorkspaceId();
    const me = await c.api("/api/v1/auth/me");
    const meBody = await c.asJson<{ data: { user: { id: string } } }>(me);
    const userId = meBody.data.user.id;

    const patch = await c.api(`/api/v1/workspaces/${workspaceId}/privacy`, {
      method: "PATCH",
      body: { allowTokenUsage: false, allowFilePaths: true },
    });
    expect(patch.status).toBe(200);
    const body = await c.asJson<{
      data: {
        allowTokenUsage: boolean;
        allowFilePaths: boolean;
        updatedById: string;
        updatedAt: string | null;
      };
    }>(patch);
    expect(body.data.allowTokenUsage).toBe(false);
    expect(body.data.allowFilePaths).toBe(true);
    expect(body.data.updatedById).toBe(userId);
    expect(body.data.updatedAt).not.toBeNull();

    const row = await prisma.privacySetting.findUnique({
      where: { workspaceId },
    });
    expect(row?.allowTokenUsage).toBe(false);
    expect(row?.allowFilePaths).toBe(true);
  });
});

describe("privacy read gating", () => {
  test("allowTokenUsage=false zeroes token data everywhere", async () => {
    const seed = await seedWorkspace();
    const res = await c.api(`/api/v1/workspaces/${seed.workspaceId}/privacy`, {
      method: "PATCH",
      body: { allowTokenUsage: false },
    });
    expect(res.status).toBe(200);

    const sessions = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/agent-sessions`,
    );
    const sessionsBody = await c.asJson<{
      data: {
        items: Array<{
          inputTokens: number;
          outputTokens: number;
          costCents: number | null;
        }>;
      };
    }>(sessions);
    expect(sessionsBody.data.items[0]).toMatchObject({
      inputTokens: 0,
      outputTokens: 0,
      costCents: null,
    });

    const detail = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/agent-sessions/${seed.sessionId}`,
    );
    const detailBody = await c.asJson<{
      data: { tokenUsage: unknown[]; inputTokens: number };
    }>(detail);
    expect(detailBody.data.tokenUsage).toHaveLength(0);
    expect(detailBody.data.inputTokens).toBe(0);

    const me = await c.api("/api/v1/auth/me");
    const meBody = await c.asJson<{ data: { user: { id: string } } }>(me);
    const devId = meBody.data.user.id;
    const stats = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/developers/${devId}/stats`,
    );
    const statsBody = await c.asJson<{
      data: { inputTokens: number; costCents: number | null };
    }>(stats);
    expect(statsBody.data).toMatchObject({ inputTokens: 0, costCents: null });

    await prisma.efficiencyMetric.create({
      data: {
        workspaceId: seed.workspaceId,
        period: "WEEK",
        periodStart: new Date("2026-08-17T00:00:00.000Z"),
        tasksCompleted: 5,
        prsMerged: 2,
        tokensTotal: 100_000,
        costTotalCents: 120,
      },
    });
    const metrics = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/metrics?period=week`,
    );
    const metricsBody = await c.asJson<{
      data: Array<{
        tokensTotal: number | null;
        costTotalCents: number | null;
      }>;
    }>(metrics);
    expect(metricsBody.data[0]).toMatchObject({
      tokensTotal: null,
      costTotalCents: null,
    });
  });

  test("allowActivitySummaries=false and allowAgentStatus=false null summaries and statuses", async () => {
    const seed = await seedWorkspace();
    const patch = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/privacy`,
      {
        method: "PATCH",
        body: { allowActivitySummaries: false, allowAgentStatus: false },
      },
    );
    expect(patch.status).toBe(200);

    const activities = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/activities`,
    );
    const actBody = await c.asJson<{
      data: { items: Array<{ summary: string | null; status: string | null }> };
    }>(activities);
    expect(actBody.data.items[0]).toMatchObject({
      summary: null,
      status: null,
    });

    const sessions = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/agent-sessions`,
    );
    const sessBody = await c.asJson<{
      data: { items: Array<{ summary: string | null; status: string | null }> };
    }>(sessions);
    expect(sessBody.data.items[0]).toMatchObject({
      summary: null,
      status: null,
    });

    const map = await c.api(`/api/v1/workspaces/${seed.workspaceId}/map`);
    const mapBody = await c.asJson<{
      data: { members: Array<{ status: string | null }> };
    }>(map);
    expect(mapBody.data.members[0]?.status).toBeNull();
  });

  test("allowGitMetadata=false empties commit/PR content", async () => {
    const seed = await seedWorkspace();
    const patch = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/privacy`,
      {
        method: "PATCH",
        body: { allowGitMetadata: false },
      },
    );
    expect(patch.status).toBe(200);

    const repos = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/repositories`,
    );
    const reposBody = await c.asJson<{ data: Array<{ id: string }> }>(repos);
    const repoId = reposBody.data[0]!.id;
    const repoDetail = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/repositories/${repoId}`,
    );
    const repoBody = await c.asJson<{
      data: {
        commits: unknown[];
        pullRequests: unknown[];
        branches: unknown[];
      };
    }>(repoDetail);
    expect(repoBody.data.commits).toHaveLength(0);
    expect(repoBody.data.pullRequests).toHaveLength(0);

    const prs = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/pull-requests`,
    );
    const prsBody = await c.asJson<{ data: { items: unknown[] } }>(prs);
    expect(prsBody.data.items).toHaveLength(0);
  });

  test("default privacy masks paths, commands and prompt titles in events", async () => {
    const seed = await seedWorkspace();
    const detail = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/agent-sessions/${seed.sessionId}`,
    );
    const body = await c.asJson<{
      data: {
        title: string | null;
        events: Array<{ type: string; payload: Record<string, unknown> }>;
      };
    }>(detail);
    expect(body.data.title).toBeNull();
    const fileEvent = body.data.events.find((e) => e.type === "file_modified");
    expect(fileEvent?.payload.path).toBeNull();
    const termEvent = body.data.events.find(
      (e) => e.type === "terminal_command",
    );
    expect(termEvent?.payload.command).toBeNull();
    const procEvent = body.data.events.find(
      (e) => e.type === "process_started",
    );
    expect(procEvent?.payload.command).toBeNull();
  });

  test("allowing sensitive fields exposes them", async () => {
    const seed = await seedWorkspace();
    const patch = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/privacy`,
      {
        method: "PATCH",
        body: {
          allowExactCommands: true,
          allowFilePaths: true,
          allowPromptMetadata: true,
        },
      },
    );
    expect(patch.status).toBe(200);

    const detail = await c.api(
      `/api/v1/workspaces/${seed.workspaceId}/agent-sessions/${seed.sessionId}`,
    );
    const body = await c.asJson<{
      data: {
        title: string | null;
        events: Array<{ type: string; payload: Record<string, unknown> }>;
      };
    }>(detail);
    expect(body.data.title).toBe("Secret title");
    const fileEvent = body.data.events.find((e) => e.type === "file_modified");
    expect(fileEvent?.payload.path).toBe("src/secret.ts");
    const termEvent = body.data.events.find(
      (e) => e.type === "terminal_command",
    );
    expect(termEvent?.payload.command).toBe("npm run secret");
  });
});
