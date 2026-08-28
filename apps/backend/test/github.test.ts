import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import type { RealtimeEvent } from "@hive/types";
import { createHmac, randomInt } from "node:crypto";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import type {
  GitHubAccessTokenResponse,
  GitHubEmail,
  GitHubUser,
} from "../src/lib/github";
import { GitHubClient } from "../src/lib/github";
import { GitHubService } from "../src/modules/github/github.service";
import { realtimeBus } from "../src/modules/realtime/realtime.bus";

let httpServer: Server;
let baseUrl: string;

// Must fit Postgres int4 (githubId/githubRepoId are Int). A random start keeps
// ids unique within a run and essentially unique across runs.
let counter = randomInt(1_000_000, 2_000_000_000);
const nextId = (): number => counter++;
const uniqueEmail = (): string => `gh-user-${nextId()}@hive.test`;
const uniqueSlug = (): string => `gh-${nextId()}`;

function ghUser(overrides: Partial<GitHubUser> = {}): GitHubUser {
  const id = nextId();
  return {
    id,
    login: `octo-${id}`,
    name: "Octo Cat",
    email: uniqueEmail(),
    avatar_url: null,
    ...overrides,
  };
}

const GH_TOKEN: GitHubAccessTokenResponse = {
  access_token: "gho_test_token",
  token_type: "bearer",
  scope: "read:user user:email",
};

class StubGitHubClient extends GitHubClient {
  constructor(private readonly user: GitHubUser) {
    super({
      clientId: "test",
      clientSecret: "test",
      redirectUri: "http://localhost:4000/callback",
    });
  }

  override buildAuthorizeUrl(state: string): string {
    return `https://github.com/login/oauth/authorize?state=${state}&client_id=test`;
  }

  override async exchangeCodeForToken(
    code: string,
  ): Promise<GitHubAccessTokenResponse> {
    expect(code).toBe("test-code");
    return GH_TOKEN;
  }

  override async getUser(): Promise<GitHubUser> {
    return this.user;
  }

  override async getUserEmails(): Promise<GitHubEmail[]> {
    return [{ email: this.user.email!, primary: true, verified: true }];
  }
}

const published: Array<{ workspaceId: string; event: RealtimeEvent }> = [];

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
      "x-github-delivery": "delivery-1",
      "x-hub-signature-256": sign(body),
    },
    body,
  });
}

async function createUserWithWorkspace(
  name = "Dev",
): Promise<{ userId: string; workspaceId: string }> {
  const user = await prisma.user.create({
    data: { email: uniqueEmail(), name },
  });
  const org = await prisma.organization.create({
    data: { name: `${name}'s Org`, slug: uniqueSlug() },
  });
  const workspace = await prisma.workspace.create({
    data: {
      orgId: org.id,
      name: "Main",
      slug: uniqueSlug(),
      webhookSecret: "test-secret-1234",
    },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: user.id },
  });
  return { userId: user.id, workspaceId: workspace.id };
}

beforeAll(async () => {
  httpServer = createApp().listen(0);
  await new Promise<void>((resolve) => httpServer.once("listening", resolve));
  const address = httpServer.address();
  if (address && typeof address === "object") {
    baseUrl = `http://localhost:${address.port}`;
  }

  realtimeBus.setPublisher((workspaceId, event) => {
    published.push({ workspaceId, event });
  });
});

afterAll(async () => {
  realtimeBus.setPublisher(null);
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await prisma.$disconnect();
});

describe("github oauth", () => {
  const stateFrom = (service: GitHubService): string =>
    new URL(service.buildLoginUrl("/")).searchParams.get("state")!;

  test("builds an authorize URL with a signed state", () => {
    const service = new GitHubService(new StubGitHubClient(ghUser()));
    const url = service.buildLoginUrl("http://localhost:5173/settings");
    expect(url).toContain("client_id=test");
    expect(stateFrom(service)).toContain(".");
    expect(service.buildLoginUrl("/")).not.toBe(service.buildLoginUrl("/"));
  });

  test("rejects an invalid state token", async () => {
    const service = new GitHubService(new StubGitHubClient(ghUser()));
    await expect(
      service.handleCallback({
        code: "test-code",
        state: "not-a-real-state",
        ctx: {},
      }),
    ).rejects.toThrow();
  });

  test("creates a user and personal org without a workspace on first sign-in", async () => {
    const user = ghUser();
    const service = new GitHubService(new StubGitHubClient(user));
    const result = await service.handleCallback({
      code: "test-code",
      state: stateFrom(service),
      ctx: {},
    });

    expect(result.session.user.email).toBe(user.email!);
    const account = await prisma.gitHubAccount.findUnique({
      where: { githubId: user.id },
      include: {
        user: { include: { memberships: true, workspaceMembers: true } },
      },
    });
    expect(account).not.toBeNull();
    expect(account!.login).toBe(user.login);
    expect(account!.accessToken).not.toContain("gho_test_token");
    expect(account!.user.email).toBe(user.email!);
    expect(account!.user.memberships.length).toBe(1);
    expect(account!.user.workspaceMembers).toHaveLength(0);
  });

  test("links an existing user by email instead of creating a duplicate", async () => {
    const user = ghUser();
    const existing = await prisma.user.create({
      data: { email: user.email!, name: "Existing Octo" },
    });
    const service = new GitHubService(new StubGitHubClient(user));

    const result = await service.handleCallback({
      code: "test-code",
      state: stateFrom(service),
      ctx: {},
    });

    expect(result.session.user.id).toBe(existing.id);
    const accounts = await prisma.gitHubAccount.findMany({
      where: { userId: existing.id },
    });
    expect(accounts.length).toBe(1);
    expect(accounts[0]!.login).toBe(user.login);
  });

  test("links to an already-authenticated session user", async () => {
    const { userId } = await createUserWithWorkspace("Session User");
    const service = new GitHubService(new StubGitHubClient(ghUser()));

    const result = await service.handleCallback({
      code: "test-code",
      state: stateFrom(service),
      existingUserId: userId,
      ctx: {},
    });

    expect(result.session.user.id).toBe(userId);
    const account = await prisma.gitHubAccount.findFirst({
      where: { userId },
    });
    expect(account).not.toBeNull();
  });

  test("exchangeUserToken refuses to provision a new account for the CLI", async () => {
    const user = ghUser();
    const service = new GitHubService(new StubGitHubClient(user));

    await expect(
      service.exchangeUserToken(
        "gho_device_token",
        {},
        { provisionIfMissing: false },
      ),
    ).rejects.toThrow(/web first/);

    const account = await prisma.gitHubAccount.findUnique({
      where: { githubId: user.id },
    });
    expect(account).toBeNull();
  });

  test("exchangeUserToken links a device-flow token to an existing account", async () => {
    const user = ghUser();
    const { userId } = await createUserWithWorkspace("Existing Dev");
    await prisma.user.update({
      where: { id: userId },
      data: { email: user.email! },
    });
    const service = new GitHubService(new StubGitHubClient(user));

    const result = await service.exchangeUserToken(
      "gho_device_token",
      {},
      { provisionIfMissing: false },
    );

    expect(result.user.id).toBe(userId);
    const account = await prisma.gitHubAccount.findUnique({
      where: { githubId: user.id },
    });
    expect(account).not.toBeNull();
    expect(account!.accessToken).not.toContain("gho_device_token");
  });

  test("POST /api/v1/github/auth/token returns a session with tokens in the body", async () => {
    const user = ghUser();
    const { userId } = await createUserWithWorkspace("Existing Dev");
    await prisma.user.update({
      where: { id: userId },
      data: { email: user.email! },
    });
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/user/emails")) {
        return new Response(
          JSON.stringify([
            { email: user.email!, primary: true, verified: true },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/user")) {
        return new Response(JSON.stringify(user), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return realFetch(input as Request | URL | string, init);
    }) as typeof globalThis.fetch;

    try {
      const res = await fetch(`${baseUrl}/api/v1/github/auth/token`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken: "gho_device_token" }),
      });
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        data: {
          user: { email: string };
          accessToken: string;
          refreshToken: string;
        };
      };
      expect(body.data.user.email).toBe(user.email!);
      expect(body.data.accessToken.length).toBeGreaterThan(0);
      expect(body.data.refreshToken.length).toBeGreaterThan(0);

      const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]!);
      expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
      expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("disconnect removes the github account", async () => {
    const { userId } = await createUserWithWorkspace("Disconnector");
    const user = ghUser();
    await prisma.gitHubAccount.create({
      data: {
        userId,
        githubId: user.id,
        login: user.login,
        accessToken: "encrypted",
      },
    });

    const service = new GitHubService(new StubGitHubClient(user));
    await service.disconnect(userId);

    const account = await prisma.gitHubAccount.findFirst({ where: { userId } });
    expect(account).toBeNull();
  });
});

describe("github webhooks", () => {
  test("rejects a missing signature", async () => {
    const res = await fetch(`${baseUrl}/api/v1/github/webhooks`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-github-event": "ping" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });

  test("rejects an invalid signature", async () => {
    const res = await fetch(`${baseUrl}/api/v1/github/webhooks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "ping",
        "x-hub-signature-256": "sha256=" + "a".repeat(64),
      },
      body: JSON.stringify({ zen: "keep it simple" }),
    });
    expect(res.status).toBe(401);
  });

  test("acks ping and records the delivery", async () => {
    const res = await sendWebhook("ping", JSON.stringify({ zen: "hi" }));
    expect(res.status).toBe(204);

    const delivery = await prisma.webhookDelivery.findFirst({
      where: { event: "ping" },
      orderBy: { receivedAt: "desc" },
    });
    expect(delivery?.status).toBe("VERIFIED");
  });

  test("returns 400 for a malformed body", async () => {
    const res = await sendWebhook("push", "{not-json");
    expect(res.status).toBe(400);
  });

  test("ingests a push: creates repo, branch, commits and broadcasts repo.push", async () => {
    const { userId, workspaceId } = await createUserWithWorkspace("Pusher");
    const owner = ghUser();
    const githubId = nextId();
    const fullName = `octo-${githubId}/hive`;

    await prisma.gitHubAccount.create({
      data: {
        userId,
        githubId: owner.id,
        login: owner.login,
        accessToken: "enc",
      },
    });

    await prisma.repository.create({
      data: {
        workspaceId,
        githubRepoId: githubId,
        githubFullName: fullName,
        name: "hive",
        provider: "GITHUB",
        url: `https://github.com/${fullName}`,
      },
    });

    const body = JSON.stringify({
      ref: "refs/heads/main",
      after: "abc123",
      head_commit: { id: "abc123" },
      commits: [
        { id: "abc123", message: "first", timestamp: "2026-01-01T00:00:00Z" },
      ],
      repository: {
        id: githubId,
        name: "hive",
        full_name: fullName,
        html_url: `https://github.com/${fullName}`,
        default_branch: "main",
        owner: { login: owner.login, id: owner.id },
      },
    });

    const res = await sendWebhook("push", body);
    expect(res.status).toBe(204);

    const repo = await prisma.repository.findUnique({
      where: { githubFullName: fullName },
      include: { branches: true, commits: true },
    });
    expect(repo).not.toBeNull();
    expect(repo!.workspaceId).toBe(workspaceId);
    expect(repo!.provider).toBe("GITHUB");
    expect(repo!.branches).toHaveLength(1);
    expect(repo!.branches[0]!.name).toBe("main");
    expect(repo!.branches[0]!.lastCommitSha).toBe("abc123");
    expect(repo!.commits).toHaveLength(1);
    expect(repo!.commits[0]!.message).toBe("first");

    const push = published.find(
      (p) => p.event.type === "repo.push" && p.event.repositoryId === repo!.id,
    );
    expect(push).toBeDefined();
    expect(push!.workspaceId).toBe(workspaceId);
    if (push!.event.type === "repo.push") {
      expect(push!.event.branch).toBe("main");
      expect(push!.event.commitCount).toBe(1);
      expect(push!.event.headSha).toBe("abc123");
    }
  });

  test("ingests a pull_request: opens a PR and broadcasts pr.updated", async () => {
    const { userId, workspaceId } = await createUserWithWorkspace("PRAuthor");
    const owner = ghUser();
    const githubId = nextId();
    const fullName = `octo-${githubId}/notes`;

    await prisma.gitHubAccount.create({
      data: {
        userId,
        githubId: owner.id,
        login: owner.login,
        accessToken: "enc",
      },
    });

    await prisma.repository.create({
      data: {
        workspaceId,
        githubRepoId: githubId,
        githubFullName: fullName,
        name: "notes",
        provider: "GITHUB",
        url: `https://github.com/${fullName}`,
      },
    });

    const body = JSON.stringify({
      action: "opened",
      pull_request: {
        number: 7,
        title: "Add realtime",
        html_url: `https://github.com/${fullName}/pull/7`,
        draft: false,
        merged: false,
        head: { ref: "feat/realtime" },
        base: { ref: "main" },
      },
      repository: {
        id: githubId,
        name: "notes",
        full_name: fullName,
        html_url: `https://github.com/${fullName}`,
        default_branch: "main",
        owner: { login: owner.login, id: owner.id },
      },
    });

    const res = await sendWebhook("pull_request", body);
    expect(res.status).toBe(204);

    const repo = await prisma.repository.findUnique({
      where: { githubFullName: fullName },
    });
    const pr = await prisma.pullRequest.findUnique({
      where: { repositoryId_number: { repositoryId: repo!.id, number: 7 } },
    });
    expect(pr).not.toBeNull();
    expect(pr!.status).toBe("OPEN");
    expect(pr!.title).toBe("Add realtime");
    expect(pr!.headBranch).toBe("feat/realtime");

    const updated = published.find(
      (p) => p.event.type === "pr.updated" && p.event.repositoryId === repo!.id,
    );
    expect(updated).toBeDefined();
    expect(updated!.workspaceId).toBe(workspaceId);
    if (updated!.event.type === "pr.updated") {
      expect(updated!.event.status).toBe("OPEN");
      expect(updated!.event.prNumber).toBe(7);
    }
  });

  test("marks a merged pull_request as merged", async () => {
    const { workspaceId } = await createUserWithWorkspace("Merged");
    const owner = ghUser();
    const githubId = nextId();
    const fullName = `octo-${githubId}/notes`;

    await prisma.repository.create({
      data: {
        workspaceId,
        githubRepoId: githubId,
        githubFullName: fullName,
        name: "notes",
        provider: "GITHUB",
        url: `https://github.com/${fullName}`,
      },
    });

    const body = JSON.stringify({
      action: "closed",
      pull_request: {
        number: 8,
        title: "Done",
        draft: false,
        merged: true,
        merged_at: "2026-02-01T00:00:00Z",
        closed_at: "2026-02-01T00:00:00Z",
      },
      repository: {
        id: githubId,
        name: "notes",
        full_name: fullName,
        default_branch: "main",
        owner: { login: owner.login, id: owner.id },
      },
    });

    const res = await sendWebhook("pull_request", body);
    expect(res.status).toBe(204);

    const repo = await prisma.repository.findUnique({
      where: { githubFullName: fullName },
    });
    const pr = await prisma.pullRequest.findUnique({
      where: { repositoryId_number: { repositoryId: repo!.id, number: 8 } },
    });
    expect(pr?.status).toBe("MERGED");
  });

  test("records an errored delivery when the handler fails", async () => {
    const { workspaceId } = await createUserWithWorkspace("Broken");
    const githubId = nextId();
    const fullName = `octo-${githubId}/broken`;
    await prisma.repository.create({
      data: {
        workspaceId,
        githubRepoId: githubId,
        githubFullName: fullName,
        name: "broken",
        provider: "GITHUB",
      },
    });

    const res = await sendWebhook(
      "push",
      JSON.stringify({
        ref: "refs/heads/main",
        commits: { bad: true },
        repository: {
          id: githubId,
          name: "broken",
          full_name: fullName,
          owner: { login: "octocat", id: nextId() },
        },
      }),
    );
    expect(res.status).toBe(500);

    const delivery = await prisma.webhookDelivery.findFirst({
      where: { event: "push", status: "ERROR" },
      orderBy: { receivedAt: "desc" },
    });
    expect(delivery).not.toBeNull();
  });

  test("ignores webhooks for a repository that is not linked to any workspace", async () => {
    const { userId, workspaceId } = await createUserWithWorkspace("Listener");
    const owner = ghUser();
    const githubId = nextId();
    const fullName = `octo-${githubId}/rogue`;

    await prisma.gitHubAccount.create({
      data: {
        userId,
        githubId: owner.id,
        login: owner.login,
        accessToken: "enc",
      },
    });

    // The repo is owned by the connected account but was never linked via the
    // GitHub App or manual link — so it must be ignored entirely.
    const body = JSON.stringify({
      ref: "refs/heads/main",
      after: "abc123",
      head_commit: { id: "abc123" },
      commits: [
        { id: "abc123", message: "first", timestamp: "2026-01-01T00:00:00Z" },
      ],
      repository: {
        id: githubId,
        name: "rogue",
        full_name: fullName,
        html_url: `https://github.com/${fullName}`,
        default_branch: "main",
        owner: { login: owner.login, id: owner.id },
      },
    });

    const res = await sendWebhook("push", body);
    expect(res.status).toBe(204);

    const repo = await prisma.repository.findUnique({
      where: { githubFullName: fullName },
    });
    expect(repo).toBeNull();
    expect(
      await prisma.gitHubNotification.count({ where: { workspaceId } }),
    ).toBe(0);
  });
});
