import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { IssueMatcherService } from "../src/modules/ai/issue-matcher.service";
import { aiEnabled } from "../src/modules/ai/ai-client";
import { makeClient, startServer, stopServer } from "./helpers";
import type { TestClient } from "./helpers";

let server: Server;
let c: TestClient;
let counter = 0;
const nextId = (): number => ++counter;

async function setup(): Promise<{ token: string; workspaceId: string }> {
  const email = await c.registerUser();
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
): Promise<Response> {
  return c.api("/api/v1/ingest/events", {
    method: "POST",
    body: {
      deviceId: "dev",
      workspaceId,
      timestamp: "2026-08-20T10:00:00.000Z",
      events,
    },
    headers: { "x-device-token": token },
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

describe("ai issue matcher", () => {
  test("links a session whose branch has no issue ref when the model matches", async () => {
    const { token, workspaceId } = await setup();
    const repo = await prisma.repository.create({
      data: { workspaceId, name: `ai-${nextId()}` },
    });
    const issue = await prisma.issue.create({
      data: {
        repositoryId: repo.id,
        number: 42,
        title: "Fix Safari login redirect",
        body: "Redirect drops the session cookie",
        state: "open",
        openedAt: new Date(),
      },
    });
    const sessionId = `ses-ai-${Date.now()}-${nextId()}`;

    const res = await ingest(token, workspaceId, [
      {
        type: "agent.started",
        timestamp: "2026-08-20T10:00:00.000Z",
        sessionId,
        agent: "opencode",
        model: "deepseek-v4-flash-free",
        repository: repo.name,
        branch: "fix/safari-redirect",
        title: "Fix the safari login redirect",
      },
      {
        type: "file.modified",
        timestamp: "2026-08-20T10:01:00.000Z",
        path: "src/routes/login.ts",
        repository: repo.name,
        branch: "fix/safari-redirect",
      },
      {
        type: "git.branch",
        timestamp: "2026-08-20T10:01:00.000Z",
        repository: repo.name,
        name: "fix/safari-redirect",
        headSha: "c-ai-1",
      },
    ]);
    expect(res.status).toBe(200);

    let seenPrompt = "";
    const matcher = new IssueMatcherService(async (prompt) => {
      seenPrompt = prompt;
      return { issueNumber: 42, confidence: 0.95 };
    });
    await matcher.runMatch(sessionId);

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
    });
    expect(session?.issueId).toBe(issue.id);
    const branch = await prisma.branch.findUnique({
      where: {
        repositoryId_name: {
          repositoryId: repo.id,
          name: "fix/safari-redirect",
        },
      },
    });
    expect(branch?.issueId).toBe(issue.id);

    expect(seenPrompt).toContain("Fix Safari login redirect");
    expect(seenPrompt).toContain("src/routes/login.ts");
    expect(seenPrompt).toContain("fix/safari-redirect");
  });

  test("does not link when the model returns no match", async () => {
    const { token, workspaceId } = await setup();
    const repo = await prisma.repository.create({
      data: { workspaceId, name: `ai-${nextId()}` },
    });
    await prisma.issue.create({
      data: {
        repositoryId: repo.id,
        number: 7,
        title: "Unrelated",
        state: "open",
        openedAt: new Date(),
      },
    });
    const sessionId = `ses-ai-${Date.now()}-${nextId()}`;
    await ingest(token, workspaceId, [
      {
        type: "agent.started",
        timestamp: "2026-08-20T10:00:00.000Z",
        sessionId,
        agent: "opencode",
        repository: repo.name,
        branch: "chore/deps",
        title: "Bump deps",
      },
    ]);

    const matcher = new IssueMatcherService(async () => ({
      issueNumber: null,
      confidence: 0,
    }));
    await matcher.runMatch(sessionId);

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
    });
    expect(session?.issueId).toBeNull();
  });

  test("does not link below the confidence threshold", async () => {
    const { token, workspaceId } = await setup();
    const repo = await prisma.repository.create({
      data: { workspaceId, name: `ai-${nextId()}` },
    });
    await prisma.issue.create({
      data: {
        repositoryId: repo.id,
        number: 9,
        title: "Safari cookie",
        state: "open",
        openedAt: new Date(),
      },
    });
    const sessionId = `ses-ai-${Date.now()}-${nextId()}`;
    await ingest(token, workspaceId, [
      {
        type: "agent.started",
        timestamp: "2026-08-20T10:00:00.000Z",
        sessionId,
        agent: "opencode",
        repository: repo.name,
        branch: "fix/safari-cookie",
        title: "Cookie on safari",
      },
    ]);

    const matcher = new IssueMatcherService(async () => ({
      issueNumber: 9,
      confidence: 0.1,
    }));
    await matcher.runMatch(sessionId);

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
    });
    expect(session?.issueId).toBeNull();
  });

  test("does not link when the model returns an unknown issue number", async () => {
    const { token, workspaceId } = await setup();
    const repo = await prisma.repository.create({
      data: { workspaceId, name: `ai-${nextId()}` },
    });
    await prisma.issue.create({
      data: {
        repositoryId: repo.id,
        number: 3,
        title: "Real issue",
        state: "open",
        openedAt: new Date(),
      },
    });
    const sessionId = `ses-ai-${Date.now()}-${nextId()}`;
    await ingest(token, workspaceId, [
      {
        type: "agent.started",
        timestamp: "2026-08-20T10:00:00.000Z",
        sessionId,
        agent: "opencode",
        repository: repo.name,
        branch: "fix/thing",
        title: "Thing",
      },
    ]);

    const matcher = new IssueMatcherService(async () => ({
      issueNumber: 999,
      confidence: 0.99,
    }));
    await matcher.runMatch(sessionId);

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
    });
    expect(session?.issueId).toBeNull();
  });

  test("does not relink a session that already has an issue", async () => {
    const { token, workspaceId } = await setup();
    const repo = await prisma.repository.create({
      data: { workspaceId, name: `ai-${nextId()}` },
    });
    const issue = await prisma.issue.create({
      data: {
        repositoryId: repo.id,
        number: 11,
        title: "Deterministic",
        state: "open",
        openedAt: new Date(),
      },
    });
    const sessionId = `ses-ai-${Date.now()}-${nextId()}`;
    await ingest(token, workspaceId, [
      {
        type: "agent.started",
        timestamp: "2026-08-20T10:00:00.000Z",
        sessionId,
        agent: "opencode",
        repository: repo.name,
        branch: "fix/11-x",
        title: "X",
      },
    ]);
    const already = await prisma.agentSession.findUnique({
      where: { id: sessionId },
    });
    expect(already?.issueId).toBe(issue.id);

    const matcher = new IssueMatcherService(async () => {
      throw new Error("should not be called");
    });
    await matcher.runMatch(sessionId);

    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
    });
    expect(session?.issueId).toBe(issue.id);
  });

  test("matchSession is a no-op when AI is not configured", async () => {
    // Local dev .env carries real AI credentials, so the disabled path is
    // only exercisable when AI_PROVIDER/AI_API_KEY are absent.
    if (aiEnabled()) return;
    expect(aiEnabled()).toBe(false);
    const matcher = new IssueMatcherService(async () => {
      throw new Error("should not be called when AI is disabled");
    });
    await matcher.matchSession("does-not-exist");
  });
});
