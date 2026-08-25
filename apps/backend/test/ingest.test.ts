import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import type { RealtimeEvent } from "@hive/types";
import { realtimeBus } from "../src/modules/realtime/realtime.bus";
import { makeClient, startServer, stopServer } from "./helpers";
import type { TestClient } from "./helpers";

let server: Server;
let c: TestClient;
let keyCounter = 0;
let idCounter = 0;

const ts = "2026-08-19T10:00:00.000Z";
const uniqueKey = (): string => `ingestkey-${Date.now()}-${++keyCounter}`;
const uniqueId = (prefix: string): string =>
  `${prefix}-${++idCounter}-${Date.now()}`;

async function setupCollector(): Promise<{
  token: string;
  workspaceId: string;
}> {
  const email = await c.registerUser();
  await c.createWorkspace("Ingest");
  const { token } = await c.registerDevice();
  const membership = await prisma.workspaceMember.findFirst({
    where: { user: { email } },
    select: { workspaceId: true },
  });
  return { token, workspaceId: membership!.workspaceId };
}

async function ingest(
  token: string,
  workspaceId: string,
  events: unknown[],
  headers: Record<string, string> = {},
): Promise<Response> {
  return c.api("/api/v1/ingest/events", {
    method: "POST",
    body: {
      deviceId: "dev",
      workspaceId,
      timestamp: ts,
      events,
    },
    headers: { "x-device-token": token, ...headers },
  });
}

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  c = makeClient(started.baseUrl);
});

afterAll(async () => {
  await stopServer(server);
});

describe("ingest auth", () => {
  test("rejects a batch without a device token", async () => {
    const { workspaceId } = await setupCollector();
    const res = await c.api("/api/v1/ingest/events", {
      method: "POST",
      body: { deviceId: "dev", workspaceId, events: [] },
    });
    expect(res.status).toBe(401);
  });

  test("rejects a batch for a workspace the device user is not a member of", async () => {
    const { token } = await setupCollector();
    const otherEmail = await c.registerUser();
    await c.createWorkspace("Other");
    const other = await prisma.workspaceMember.findFirst({
      where: { user: { email: otherEmail } },
      select: { workspaceId: true },
    });
    const res = await ingest(token, other!.workspaceId, [
      { type: "file.modified", timestamp: ts, path: "src/a.ts" },
    ]);
    expect(res.status).toBe(403);
  });

  test("rejects an invalid batch shape", async () => {
    const { token, workspaceId } = await setupCollector();
    const res = await ingest(token, workspaceId, [
      { type: "unknown.event", timestamp: ts },
    ]);
    expect(res.status).toBe(400);
  });

  test("replays the same response for a duplicate idempotency key", async () => {
    const { token, workspaceId } = await setupCollector();
    const key = uniqueKey();
    const event = { type: "file.modified", timestamp: ts, path: "src/a.ts" };
    const first = await ingest(token, workspaceId, [event], {
      "idempotency-key": key,
    });
    expect(first.status).toBe(200);
    const second = await ingest(token, workspaceId, [event], {
      "idempotency-key": key,
    });
    expect(second.status).toBe(200);
    const [one, two] = await Promise.all([c.asJson(first), c.asJson(second)]);
    expect(one).toEqual(two);
  });
});

describe("ingest agent events", () => {
  test("records the full agent session lifecycle and token cost", async () => {
    const { token, workspaceId } = await setupCollector();
    const sessionId = uniqueId("sess-life");
    await prisma.model.upsert({
      where: {
        provider_name: {
          provider: "anthropic",
          name: "claude-sonnet-4-5",
        },
      },
      create: {
        provider: "anthropic",
        name: "claude-sonnet-4-5",
        inputPricePerMillion: 3,
        outputPricePerMillion: 15,
      },
      update: {},
    });

    const res = await ingest(token, workspaceId, [
      {
        type: "agent.started",
        timestamp: ts,
        sessionId,
        agent: "claude",
        model: "claude-sonnet-4-5",
        title: "Build ingest",
      },
      {
        type: "agent.token_usage",
        timestamp: ts,
        sessionId,
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        inputTokens: 1_000_000,
        outputTokens: 500_000,
      },
      {
        type: "agent.stopped",
        timestamp: ts,
        sessionId,
        status: "completed",
      },
    ]);
    expect(res.status).toBe(200);
    const body = await c.asJson<{
      data: { accepted: boolean; eventCount: number; failures: number };
    }>(res);
    expect(body.data).toEqual({ accepted: true, eventCount: 3, failures: 0 });

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      include: { agent: true, tokenUsages: true },
    });
    expect(session).not.toBeNull();
    expect(session!.status).toBe("COMPLETED");
    expect(session!.endedAt).not.toBeNull();
    expect(session!.title).toBe("Build ingest");
    expect(session!.agent.name).toBe("claude");
    expect(session!.agent.type).toBe("CLAUDE");
    expect(session!.agent.status).toBe("IDLE");
    expect(session!.tokenUsages).toHaveLength(1);
    expect(session!.tokenUsages[0]!.inputTokens).toBe(1_000_000);
    expect(session!.tokenUsages[0]!.costCents).toBe(1050);
  });

  test("applies an agent summary to the session", async () => {
    const { token, workspaceId } = await setupCollector();
    const sessionId = uniqueId("sess-sum");
    await ingest(token, workspaceId, [
      {
        type: "agent.started",
        timestamp: ts,
        sessionId,
        agent: "opencode",
      },
      {
        type: "agent.summary",
        timestamp: ts,
        sessionId,
        summary: "Implemented login flow",
      },
    ]);
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: { summary: true },
    });
    expect(session!.summary).toBe("Implemented login flow");
  });

  test("is idempotent when a session id is reused", async () => {
    const { token, workspaceId } = await setupCollector();
    const sessionId = uniqueId("sess-repeat");
    const started = {
      type: "agent.started",
      timestamp: ts,
      sessionId,
      agent: "codex",
    } as const;
    await ingest(token, workspaceId, [started]);
    await ingest(token, workspaceId, [started]);
    const count = await prisma.agentSession.count({
      where: { id: sessionId },
    });
    expect(count).toBe(1);
  });
});

describe("ingest activity events", () => {
  test("records start, update and stop", async () => {
    const { token, workspaceId } = await setupCollector();
    const activityId = uniqueId("act");
    const res = await ingest(token, workspaceId, [
      {
        type: "activity.started",
        timestamp: ts,
        activityId,
        activityType: "coding",
        title: "Auth flow",
      },
      {
        type: "activity.updated",
        timestamp: ts,
        activityId,
        summary: "progress",
        filesChanged: 3,
        linesChanged: 42,
      },
      {
        type: "activity.stopped",
        timestamp: ts,
        activityId,
        outcome: "success",
      },
    ]);
    expect(res.status).toBe(200);

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
    });
    expect(activity).not.toBeNull();
    expect(activity!.status).toBe("COMPLETED");
    expect(activity!.outcomeStatus).toBe("SUCCESS");
    expect(activity!.endedAt).not.toBeNull();
    expect(activity!.summary).toBe("progress");
    expect(activity!.filesChanged).toBe(3);
    expect(activity!.linesChanged).toBe(42);
  });

  test("ignores updates for an unknown activity", async () => {
    const { token, workspaceId } = await setupCollector();
    const res = await ingest(token, workspaceId, [
      {
        type: "activity.updated",
        timestamp: ts,
        activityId: "missing-act",
        summary: "nope",
      },
    ]);
    expect(res.status).toBe(200);
  });
});

describe("ingest git events", () => {
  test("records commits, branches and pull requests", async () => {
    const { token, workspaceId } = await setupCollector();
    const res = await ingest(token, workspaceId, [
      {
        type: "git.commit",
        timestamp: ts,
        repository: "acme/web",
        branch: "main",
        sha: uniqueId("sha"),
        message: "feat: login",
        insertions: 12,
        deletions: 3,
      },
      {
        type: "git.branch",
        timestamp: ts,
        repository: "acme/web",
        name: "feature/login",
        lastCommitSha: "abc123",
      },
      {
        type: "git.pull_request",
        timestamp: ts,
        repository: "acme/web",
        number: 42,
        title: "Login flow",
        status: "merged",
        headBranch: "feature/login",
        baseBranch: "main",
      },
    ]);
    expect(res.status).toBe(200);

    const repo = await prisma.repository.findUnique({
      where: { workspaceId_name: { workspaceId, name: "acme/web" } },
      include: { branches: true, commits: true, pullRequests: true },
    });
    expect(repo).not.toBeNull();
    expect(repo!.branches).toHaveLength(2);
    expect(repo!.commits).toHaveLength(1);
    expect(repo!.commits[0]!.message).toBe("feat: login");
    expect(repo!.pullRequests).toHaveLength(1);
    expect(repo!.pullRequests[0]!.status).toBe("MERGED");
  });
});

describe("ingest test events", () => {
  test("records a completed test run", async () => {
    const { token, workspaceId } = await setupCollector();
    const testRunId = uniqueId("run");
    const res = await ingest(token, workspaceId, [
      {
        type: "test.started",
        timestamp: ts,
        testRunId,
        command: "bun test",
      },
      {
        type: "test.finished",
        timestamp: ts,
        testRunId,
        status: "passed",
        totalTests: 42,
        passedTests: 42,
        durationMs: 1200,
      },
    ]);
    expect(res.status).toBe(200);

    const run = await prisma.testRun.findUnique({ where: { id: testRunId } });
    expect(run).not.toBeNull();
    expect(run!.status).toBe("PASSED");
    expect(run!.totalTests).toBe(42);
    expect(run!.endedAt).not.toBeNull();
  });
});

describe("ingest environment events", () => {
  test("attaches to the running agent session when one exists", async () => {
    const { token, workspaceId } = await setupCollector();
    const sessionId = uniqueId("sess-env");
    await ingest(token, workspaceId, [
      {
        type: "agent.started",
        timestamp: ts,
        sessionId,
        agent: "generic",
      },
      {
        type: "file.modified",
        timestamp: ts,
        path: "src/lib/queue.ts",
      },
    ]);

    const event = await prisma.agentEvent.findFirst({
      where: { agentSessionId: sessionId },
    });
    expect(event).not.toBeNull();
    expect(event!.type).toBe("FILE_MODIFIED");
    expect(event!.sequence).toBe(1);
    const payload = event!.payload as { path: string };
    expect(payload.path).toBe("src/lib/queue.ts");
  });

  test("attaches to the in-progress activity when no session is running", async () => {
    const { token, workspaceId } = await setupCollector();
    const activityId = uniqueId("act-env");
    await ingest(token, workspaceId, [
      {
        type: "activity.started",
        timestamp: ts,
        activityId,
        activityType: "research",
        title: "Investigate",
      },
      {
        type: "terminal.command",
        timestamp: ts,
        command: "ls -la",
      },
    ]);

    const event = await prisma.activityEvent.findFirst({
      where: { activityId },
    });
    expect(event).not.toBeNull();
    expect(event!.type).toBe("TERMINAL_COMMAND");
  });
});

describe("ingest realtime broadcasts", () => {
  test("publishes agent, activity, push and pr events to the workspace topic", async () => {
    const { token, workspaceId } = await setupCollector();
    const published: RealtimeEvent[] = [];
    realtimeBus.setPublisher((_ws, event) => published.push(event));

    const sessionId = uniqueId("sess-bc");
    const res = await ingest(token, workspaceId, [
      {
        type: "agent.started",
        timestamp: ts,
        sessionId,
        agent: "claude",
        title: "Broadcast me",
      },
      {
        type: "activity.started",
        timestamp: ts,
        activityId: uniqueId("act-bc"),
        activityType: "coding",
        title: "Broadcast act",
      },
      {
        type: "git.commit",
        timestamp: ts,
        repository: "acme/bc",
        sha: uniqueId("sha-bc"),
        message: "push",
      },
      {
        type: "git.pull_request",
        timestamp: ts,
        repository: "acme/bc",
        number: 7,
        title: "PR",
        status: "open",
      },
    ]);
    expect(res.status).toBe(200);

    realtimeBus.setPublisher(null);
    const types = published.map((e) => e.type);
    expect(types).toContain("agent.started");
    expect(types).toContain("activity.updated");
    expect(types).toContain("repo.push");
    expect(types).toContain("pr.updated");

    const agentEvent = published.find(
      (e) => e.type === "agent.started",
    ) as Extract<RealtimeEvent, { type: "agent.started" }>;
    expect(agentEvent.sessionId).toBe(sessionId);
    expect(agentEvent.agent).toBe("claude");
  });
});
