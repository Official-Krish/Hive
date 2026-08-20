import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { createHmac, randomInt } from "node:crypto";
import { prisma } from "@hive/db";
import { env } from "../src/config/env";
import {
  branchIssueRef,
  commitIssueRef,
} from "../src/modules/issues/issue-links";
import { makeClient, startServer, stopServer } from "./helpers";
import type { TestClient } from "./helpers";

let server: Server;
let c: TestClient;
let baseUrl = "";
let counter = randomInt(1_000_000, 2_000_000_000);
const nextId = (): number => counter++;
const uniqueEmail = (): string => `issue-user-${nextId()}@hive.test`;

function sign(body: string): string {
  return (
    "sha256=" +
    createHmac("sha256", env.GITHUB_WEBHOOK_SECRET).update(body).digest("hex")
  );
}

async function sendWebhook(event: string, body: string): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/github/webhooks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": event,
      "x-github-delivery": "delivery-issue",
      "x-hub-signature-256": sign(body),
    },
    body,
  });
}

function repoPayload(githubId: number, name: string) {
  const fullName = `octo-${githubId}/${name}`;
  return {
    id: githubId,
    name,
    full_name: fullName,
    html_url: `https://github.com/${fullName}`,
    default_branch: "main",
    owner: { login: `octo-${githubId}`, id: githubId },
  };
}

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  baseUrl = started.baseUrl;
  c = makeClient(started.baseUrl);
});

afterAll(async () => {
  await stopServer(server);
});

describe("issue ref parsing", () => {
  test("branchIssueRef extracts issue numbers from common branch conventions", () => {
    expect(branchIssueRef("fix/123-login")).toBe(123);
    expect(branchIssueRef("123-fix")).toBe(123);
    expect(branchIssueRef("feature/issue-123")).toBe(123);
    expect(branchIssueRef("issue/456")).toBe(456);
    expect(branchIssueRef("feat/7890-flag")).toBe(7890);
    expect(branchIssueRef("fix/5-e2e")).toBe(5);
  });

  test("branchIssueRef returns null when no issue number is present", () => {
    expect(branchIssueRef("main")).toBeNull();
    expect(branchIssueRef("fix/safari-redirect")).toBeNull();
    expect(branchIssueRef("release/2.3.4")).toBeNull();
    expect(branchIssueRef("")).toBeNull();
  });

  test("commitIssueRef extracts issue numbers from messages", () => {
    expect(commitIssueRef("fix(login): safari redirect fixes #123")).toBe(123);
    expect(commitIssueRef("Closes #456")).toBe(456);
    expect(commitIssueRef("resolve: #7890")).toBe(7890);
    expect(commitIssueRef("Add tests (#42)")).toBe(42);
  });

  test("commitIssueRef returns null when no reference exists", () => {
    expect(commitIssueRef("chore: bump deps")).toBeNull();
    expect(commitIssueRef("")).toBeNull();
  });
});

describe("issues webhook", () => {
  test("upserts an Issue from the issues event", async () => {
    const email = uniqueEmail();
    await c.registerUserWith(email);
    const user = await prisma.user.findUnique({ where: { email } });
    const githubId = nextId();
    const fullName = `octo-${githubId}/tracker`;
    await prisma.gitHubAccount.create({
      data: {
        userId: user!.id,
        githubId,
        login: `octo-${githubId}`,
        accessToken: "enc",
      },
    });

    const body = JSON.stringify({
      action: "opened",
      issue: {
        number: 5,
        title: "Login redirect broken on Safari",
        body: "Repro steps...",
        html_url: `https://github.com/${fullName}/issues/5`,
        state: "open",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        user: { login: `octo-${githubId}` },
        labels: [{ name: "bug" }],
        assignees: [{ login: `octo-${githubId}` }],
      },
      repository: repoPayload(githubId, "tracker"),
    });

    const res = await fetch(`${baseUrl}/api/v1/github/webhooks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-github-delivery": "delivery-issue-1",
        "x-hub-signature-256": sign(body),
      },
      body,
    });
    expect(res.status).toBe(204);

    const repo = await prisma.repository.findUnique({
      where: { githubFullName: fullName },
    });
    const issue = await prisma.issue.findUnique({
      where: { repositoryId_number: { repositoryId: repo!.id, number: 5 } },
    });
    expect(issue).not.toBeNull();
    expect(issue!.title).toBe("Login redirect broken on Safari");
    expect(issue!.state).toBe("open");
    expect(issue!.authorLogin).toBe(`octo-${githubId}`);
    expect(issue!.labels).toEqual(["bug"]);
    expect(issue!.assignees).toEqual([`octo-${githubId}`]);
  });

  test("relinks existing branches and commits when the issue arrives late", async () => {
    const email = uniqueEmail();
    await c.registerUserWith(email);
    const user = await prisma.user.findUnique({ where: { email } });
    const githubId = nextId();
    const fullName = `octo-${githubId}/late`;
    await prisma.gitHubAccount.create({
      data: {
        userId: user!.id,
        githubId,
        login: `octo-${githubId}`,
        accessToken: "enc",
      },
    });

    const pushBody = JSON.stringify({
      ref: "refs/heads/fix/123-login",
      after: "c001",
      head_commit: { id: "c001" },
      commits: [
        {
          id: "c001",
          message: "fix: login fixes #123",
          timestamp: "2026-01-01T00:00:00Z",
        },
      ],
      repository: repoPayload(githubId, "late"),
    });
    await sendWebhook("push", pushBody);

    const repo = await prisma.repository.findUnique({
      where: { githubFullName: fullName },
    });
    const branch = await prisma.branch.findUnique({
      where: {
        repositoryId_name: { repositoryId: repo!.id, name: "fix/123-login" },
      },
    });
    expect(branch?.issueId).toBeNull();

    const issueBody = JSON.stringify({
      action: "opened",
      issue: {
        number: 123,
        title: "Broken login",
        state: "open",
        created_at: "2026-01-01T00:00:00Z",
      },
      repository: repoPayload(githubId, "late"),
    });
    await sendWebhook("issues", issueBody);

    const relinkedBranch = await prisma.branch.findUnique({
      where: {
        repositoryId_name: { repositoryId: repo!.id, name: "fix/123-login" },
      },
    });
    const commit = await prisma.commit.findUnique({
      where: { repositoryId_sha: { repositoryId: repo!.id, sha: "c001" } },
    });
    expect(relinkedBranch?.issueId).not.toBeNull();
    expect(commit?.issueId).toBe(relinkedBranch!.issueId);
  });

  test("push webhook links a commit and branch to an existing issue", async () => {
    const email = uniqueEmail();
    await c.registerUserWith(email);
    const user = await prisma.user.findUnique({ where: { email } });
    const githubId = nextId();
    const fullName = `octo-${githubId}/linked`;
    await prisma.gitHubAccount.create({
      data: {
        userId: user!.id,
        githubId,
        login: `octo-${githubId}`,
        accessToken: "enc",
      },
    });

    const issueBody = JSON.stringify({
      action: "opened",
      issue: {
        number: 77,
        title: "Fix tokens",
        state: "open",
        created_at: "2026-01-01T00:00:00Z",
      },
      repository: repoPayload(githubId, "linked"),
    });
    await sendWebhook("issues", issueBody);

    const pushBody = JSON.stringify({
      ref: "refs/heads/77-fix-tokens",
      after: "c002",
      head_commit: { id: "c002" },
      commits: [
        {
          id: "c002",
          message: "closes #77",
          timestamp: "2026-01-01T00:00:00Z",
        },
      ],
      repository: repoPayload(githubId, "linked"),
    });
    await sendWebhook("push", pushBody);

    const repo = await prisma.repository.findUnique({
      where: { githubFullName: fullName },
    });
    const branch = await prisma.branch.findUnique({
      where: {
        repositoryId_name: { repositoryId: repo!.id, name: "77-fix-tokens" },
      },
    });
    const commit = await prisma.commit.findUnique({
      where: { repositoryId_sha: { repositoryId: repo!.id, sha: "c002" } },
    });
    const issue = await prisma.issue.findUnique({
      where: { repositoryId_number: { repositoryId: repo!.id, number: 77 } },
    });
    expect(branch?.issueId).toBe(issue!.id);
    expect(commit?.issueId).toBe(issue!.id);
  });
});

describe("ingest issue linking", () => {
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
        timestamp: "2026-08-19T10:00:00.000Z",
        events,
      },
      headers: { "x-device-token": token },
    });
  }

  test("links an agent session and a commit to the issue via branch/message refs", async () => {
    const { token, workspaceId } = await setup();
    const repo = await prisma.repository.create({
      data: { workspaceId, name: "hive" },
    });
    const issue = await prisma.issue.create({
      data: {
        repositoryId: repo.id,
        number: 123,
        title: "Broken login redirect",
        state: "open",
        openedAt: new Date(),
      },
    });

    const res = await ingest(token, workspaceId, [
      {
        type: "agent.started",
        timestamp: "2026-08-19T10:00:00.000Z",
        sessionId: "ses-issue-1",
        agent: "opencode",
        model: "deepseek-v4-flash-free",
        repository: "hive",
        branch: "fix/123-login",
        title: "Fix redirect",
      },
      {
        type: "git.commit",
        timestamp: "2026-08-19T10:01:00.000Z",
        repository: "hive",
        sha: "c-issue-1",
        branch: "fix/123-login",
        message: "fixes #123",
      },
    ]);
    expect(res.status).toBe(200);

    const session = await prisma.agentSession.findUnique({
      where: { id: "ses-issue-1" },
    });
    expect(session?.issueId).toBe(issue.id);

    const commit = await prisma.commit.findUnique({
      where: { repositoryId_sha: { repositoryId: repo.id, sha: "c-issue-1" } },
    });
    const branch = await prisma.branch.findUnique({
      where: {
        repositoryId_name: { repositoryId: repo.id, name: "fix/123-login" },
      },
    });
    expect(commit?.issueId).toBe(issue.id);
    expect(branch?.issueId).toBe(issue.id);
  });

  test("GET issues lists rollups and GET issues/:id returns sessions + commits", async () => {
    const email = await c.registerUser();
    const workspaceId = (await prisma.workspaceMember.findFirst({
      where: { user: { email } },
    }))!.workspaceId;
    const repo = await prisma.repository.create({
      data: { workspaceId, name: "rollup" },
    });
    const issue = await prisma.issue.create({
      data: {
        repositoryId: repo.id,
        number: 200,
        title: "Rollup tokens",
        state: "open",
        openedAt: new Date(),
      },
    });
    const agent = await prisma.agent.create({
      data: { workspaceId, name: "opencode", type: "OPENCODE" },
    });
    const sessionId = `ses-rollup-${Date.now()}-${nextId()}`;
    await prisma.agentSession.create({
      data: {
        id: sessionId,
        developerId: (await prisma.workspaceMember.findFirst({
          where: { workspaceId },
        }))!.userId,
        agentId: agent.id,
        workspaceId,
        repositoryId: repo.id,
        branch: "fix/200-rollup",
        issueId: issue.id,
        title: "Rollup session",
        startedAt: new Date(),
      },
    });
    const model = await prisma.model.create({
      data: { provider: "opencode", name: `deepseek-test-${Date.now()}` },
    });
    await prisma.tokenUsage.createMany({
      data: [
        {
          sessionId,
          modelId: model.id,
          inputTokens: 1000,
          outputTokens: 500,
          costCents: 5,
        },
        {
          sessionId,
          modelId: model.id,
          inputTokens: 500,
          outputTokens: 250,
          costCents: 2,
        },
      ],
    });
    await prisma.branch.create({
      data: {
        repositoryId: repo.id,
        name: "fix/200-rollup",
        issueId: issue.id,
      },
    });

    const list = await c.api(`/api/v1/workspaces/${workspaceId}/issues`);
    expect(list.status).toBe(200);
    const listBody = await c.asJson<{
      data: {
        items: Array<{
          id: string;
          inputTokens: number;
          outputTokens: number;
          costCents: number;
          sessionCount: number;
        }>;
      };
    }>(list);
    expect(listBody.data.items).toHaveLength(1);
    expect(listBody.data.items[0]!.inputTokens).toBe(1500);
    expect(listBody.data.items[0]!.outputTokens).toBe(750);
    expect(listBody.data.items[0]!.costCents).toBe(7);
    expect(listBody.data.items[0]!.sessionCount).toBe(1);

    const detail = await c.api(
      `/api/v1/workspaces/${workspaceId}/issues/${issue.id}`,
    );
    expect(detail.status).toBe(200);
    const detailBody = await c.asJson<{
      data: {
        number: number;
        title: string;
        inputTokens: number;
        outputTokens: number;
        sessions: Array<{ id: string; inputTokens: number; costCents: number }>;
        commits: unknown[];
        branches: Array<{ name: string }>;
      };
    }>(detail);
    expect(detailBody.data.number).toBe(200);
    expect(detailBody.data.title).toBe("Rollup tokens");
    expect(detailBody.data.inputTokens).toBe(1500);
    expect(detailBody.data.outputTokens).toBe(750);
    expect(detailBody.data.sessions).toHaveLength(1);
    expect(detailBody.data.sessions[0]!.id).toBe(sessionId);
    expect(detailBody.data.sessions[0]!.inputTokens).toBe(1500);
    expect(detailBody.data.branches[0]!.name).toBe("fix/200-rollup");

    const filtered = await c.api(
      `/api/v1/workspaces/${workspaceId}/issues?state=closed`,
    );
    const filteredBody = await c.asJson<{ data: { items: unknown[] } }>(
      filtered,
    );
    expect(filteredBody.data.items).toHaveLength(0);
  });
});
