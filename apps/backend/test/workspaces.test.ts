import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { randomInt } from "node:crypto";
import { prisma, RepositoryProvider } from "@hive/db";
import { makeClient, startServer, stopServer, uniqueEmail } from "./helpers";
import type { TestClient } from "./helpers";
import { encryptSecret } from "../src/lib/encryption";

let server: Server;
let c: TestClient;

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  c = makeClient(started.baseUrl);
});

afterAll(async () => {
  await stopServer(server);
});

describe("workspace auth", () => {
  test("returns 401 without a session", async () => {
    c.clearJar();
    const res = await c.api("/api/v1/workspaces");
    expect(res.status).toBe(401);
  });
});

describe("workspace create + list", () => {
  test("creates a workspace as owner and lists it", async () => {
    c.clearJar();
    await c.registerUser();
    const name = uniqueEmail("proj");
    const id = await c.createWorkspace(name);

    const detail = await c.api(`/api/v1/workspaces/${id}`);
    expect(detail.status).toBe(200);
    const body = await c.asJson<{
      data: { id: string; name: string; role: string; memberCount: number };
    }>(detail);
    expect(body.data).toMatchObject({
      id,
      name,
      role: "owner",
      memberCount: 1,
    });

    const list = await c.api("/api/v1/workspaces");
    const listBody = await c.asJson<{
      data: Array<{
        id: string;
        name: string;
        role: string;
        memberCount: number;
      }>;
    }>(list);
    const created = listBody.data.find((w) => w.id === id);
    expect(created).toMatchObject({
      id,
      name,
      role: "owner",
      memberCount: 1,
    });
  });

  test("applies the custom slug and validates invalid input", async () => {
    c.clearJar();
    await c.registerUser();
    const res = await c.api("/api/v1/workspaces", {
      method: "POST",
      body: { name: "My Slash", slug: "my-slash" },
    });
    expect(res.status).toBe(201);
    const body = await c.asJson<{ data: { slug: string } }>(res);
    expect(body.data.slug).toBe("my-slash");

    const bad = await c.api("/api/v1/workspaces", {
      method: "POST",
      body: { name: "" },
    });
    expect(bad.status).toBe(400);
  });

  test("member of another workspace cannot see a foreign workspace", async () => {
    c.clearJar();
    await c.registerUser();
    const id = await c.createWorkspace("Private");
    await c.registerUser();

    const res = await c.api(`/api/v1/workspaces/${id}`);
    expect(res.status).toBe(403);
  });
});

describe("workspace update + delete", () => {
  test("owner can update name/description and delete", async () => {
    c.clearJar();
    await c.registerUser();
    const id = await c.createWorkspace("Rename Me");

    const patch = await c.api(`/api/v1/workspaces/${id}`, {
      method: "PATCH",
      body: { name: "Renamed", description: "New desc" },
    });
    expect(patch.status).toBe(200);
    const body = await c.asJson<{
      data: { name: string; description: string };
    }>(patch);
    expect(body.data).toMatchObject({
      name: "Renamed",
      description: "New desc",
    });

    const del = await c.api(`/api/v1/workspaces/${id}`, { method: "DELETE" });
    expect(del.status).toBe(204);

    const get = await c.api(`/api/v1/workspaces/${id}`);
    expect(get.status).toBe(403);
  });

  test("member cannot update or delete", async () => {
    c.clearJar();
    await c.registerUser();
    const id = await c.createWorkspace("No Touch");

    await c.registerUser();
    const res = await c.api(`/api/v1/workspaces/${id}`, {
      method: "PATCH",
      body: { name: "Hacked" },
    });
    expect(res.status).toBe(403);
  });
});

describe("invites", () => {
  test("owner invites, member accepts, roles enforced", async () => {
    c.clearJar();
    await c.registerUser();
    const workspaceId = await c.createWorkspace("Team");
    const joinerEmail = uniqueEmail("joiner");

    const token = await c.inviteAndGetToken(workspaceId, joinerEmail, "admin");
    const listRes = await c.api(`/api/v1/workspaces/${workspaceId}/invites`);
    const listBody = await c.asJson<{
      data: Array<{ status: string }>;
    }>(listRes);
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0]?.status).toBe("pending");

    await c.acceptInviteAs(token, joinerEmail);

    const membersRes = await c.api(`/api/v1/workspaces/${workspaceId}/members`);
    const membersBody = await c.asJson<{
      data: Array<{ email: string; role: string }>;
    }>(membersRes);
    expect(membersBody.data).toHaveLength(2);
    const joiner = membersBody.data.find((m) => m.email === joinerEmail);
    expect(joiner).toMatchObject({ role: "admin" });

    const invites = await c.api(`/api/v1/workspaces/${workspaceId}/invites`);
    const invitesBody = await c.asJson<{
      data: Array<{ status: string }>;
    }>(invites);
    expect(invitesBody.data[0]?.status).toBe("accepted");
  });

  test("member cannot create invites, revoked invite is rejected", async () => {
    c.clearJar();
    await c.registerUser();
    const workspaceId = await c.createWorkspace("Invites");
    const revokeEmail = uniqueEmail("revoked");

    const inviteRes = await c.api(`/api/v1/workspaces/${workspaceId}/invites`, {
      method: "POST",
      body: { email: revokeEmail },
    });
    const inviteBody = await c.asJson<{
      data: { invite: { id: string }; token: string };
    }>(inviteRes);
    const inviteId = inviteBody.data.invite.id;
    const token = inviteBody.data.token;

    const revoke = await c.api(
      `/api/v1/workspaces/${workspaceId}/invites/${inviteId}`,
      { method: "DELETE" },
    );
    expect(revoke.status).toBe(204);

    await c.registerUserWith(revokeEmail);
    const accept = await c.api(`/api/v1/invites/${token}/accept`, {
      method: "POST",
    });
    expect(accept.status).toBe(403);
  });

  test("expired invite is rejected", async () => {
    c.clearJar();
    await c.registerUser();
    const workspaceId = await c.createWorkspace("Expiry");
    const expiredEmail = uniqueEmail("expired");

    const inviteRes = await c.api(`/api/v1/workspaces/${workspaceId}/invites`, {
      method: "POST",
      body: { email: expiredEmail },
    });
    const inviteBody = await c.asJson<{
      data: { invite: { id: string }; token: string };
    }>(inviteRes);
    const token = inviteBody.data.token;

    const invite = await prisma.invite.findUniqueOrThrow({
      where: { id: inviteBody.data.invite.id },
    });
    await prisma.invite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await c.registerUserWith(expiredEmail);
    const accept = await c.api(`/api/v1/invites/${token}/accept`, {
      method: "POST",
    });
    expect(accept.status).toBe(403);
  });

  test("accepting an invite works without a collector device", async () => {
    c.clearJar();
    await c.registerUser();
    const workspaceId = await c.createWorkspace("No Gate");
    const joinerEmail = uniqueEmail("joiner");

    const token = await c.inviteAndGetToken(workspaceId, joinerEmail);

    await c.registerUserWith(joinerEmail);
    const accept = await c.api(`/api/v1/invites/${token}/accept`, {
      method: "POST",
    });
    expect(accept.status).toBe(200);
    const body = await c.asJson<{ data: { id: string } }>(accept);
    expect(body.data.id).toBe(workspaceId);
  });
});

describe("repository assignment", () => {
  const originalFetch = globalThis.fetch;
  // Random start: rows persist in the shared dev DB across runs and both
  // githubId / githubRepoId are unique — mirror github.test.ts.
  let githubIdCounter = randomInt(100_000, 2_000_000_000);

  function stubGithubRepo(payload: Record<string, unknown> | null): void {
    globalThis.fetch = (async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const url = String(input);
      if (url.startsWith("https://api.github.com")) {
        return new Response(JSON.stringify(payload ?? {}), {
          status: payload ? 200 : 404,
          headers: { "content-type": "application/json" },
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;
  }

  async function linkGithubAccount(userId: string): Promise<void> {
    await prisma.gitHubAccount.create({
      data: {
        userId,
        githubId: ++githubIdCounter,
        login: `octo-${githubIdCounter}`,
        accessToken: encryptSecret("tok-test"),
      },
    });
  }

  async function userIdOfWorkspaceOwner(workspaceId: string): Promise<string> {
    return (
      await prisma.workspaceMember.findFirstOrThrow({
        where: { workspaceId, role: "OWNER" },
        select: { userId: true },
      })
    ).userId;
  }

  test("creating a workspace with a GitHub repo id imports and links it", async () => {
    c.clearJar();
    const email = await c.registerUser();
    await linkGithubAccount(
      (await prisma.user.findUniqueOrThrow({ where: { email } })).id,
    );

    const ghId = String(++githubIdCounter);
    const fullName = `acme-${ghId}/app`;
    stubGithubRepo({
      id: Number(ghId),
      name: "app",
      full_name: fullName,
      html_url: `https://github.com/${fullName}`,
      private: false,
      default_branch: "main",
      permissions: { admin: true },
    });
    try {
      // This is the exact flow that used to fail with
      // 404 "Repository not found": the picker sends GitHub's numeric id.
      const res = await c.api("/api/v1/workspaces", {
        method: "POST",
        body: { name: "Hooked", repositoryId: ghId },
      });
      expect(res.status, await res.clone().text()).toBe(201);

      const row = await prisma.repository.findFirstOrThrow({
        where: { githubRepoId: Number(ghId) },
      });
      expect(row.githubFullName).toBe(fullName);
      expect(row.provider).toBe(RepositoryProvider.GITHUB);
      expect(row.workspaceId).toBeTruthy();

      const list = await c.api("/api/v1/workspaces");
      const listBody = await c.asJson<{
        data: Array<{ id: string }>;
      }>(list);
      const ws = listBody.data[0]!.id;
      expect(row.workspaceId).toBe(ws);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("assigning a repo the caller cannot administer is rejected", async () => {
    c.clearJar();
    await c.registerUser();
    const workspaceId = await c.createWorkspace("Forbidden Repo");
    await linkGithubAccount(await userIdOfWorkspaceOwner(workspaceId));

    stubGithubRepo({
      id: 1,
      name: "app",
      full_name: "someone/app",
      html_url: null,
      private: true,
      default_branch: "main",
      permissions: { admin: false },
    });
    try {
      const res = await c.api(
        `/api/v1/workspaces/${workspaceId}/settings/assign-repo`,
        { method: "POST", body: { repositoryId: String(++githubIdCounter) } },
      );
      expect(res.status).toBe(403);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("existing Repository rows still assign by their own id", async () => {
    c.clearJar();
    await c.registerUser();
    const workspaceId = await c.createWorkspace("Legacy Link");

    const repo = await prisma.repository.create({
      data: {
        name: `local-repo-${++githubIdCounter}`,
        provider: RepositoryProvider.OTHER,
      },
    });

    const res = await c.api(
      `/api/v1/workspaces/${workspaceId}/settings/assign-repo`,
      { method: "POST", body: { repositoryId: repo.id } },
    );
    expect(res.status).toBe(204);

    const updated = await prisma.repository.findUniqueOrThrow({
      where: { id: repo.id },
    });
    expect(updated.workspaceId).toBe(workspaceId);
  });
});

describe("members", () => {
  test("admin can change roles and remove a member", async () => {
    c.clearJar();
    await c.registerUser();
    const workspaceId = await c.createWorkspace("Members");
    const promoteEmail = uniqueEmail("promote");
    const ownerJar = c.saveJar();

    const token = await c.inviteAndGetToken(workspaceId, promoteEmail);
    await c.acceptInviteAs(token, promoteEmail);

    c.restoreJar(ownerJar);
    const members = await c.api(`/api/v1/workspaces/${workspaceId}/members`);
    const membersBody = await c.asJson<{
      data: Array<{ email: string; userId: string }>;
    }>(members);
    const joiner = membersBody.data.find((m) => m.email === promoteEmail)!;

    const promote = await c.api(
      `/api/v1/workspaces/${workspaceId}/members/${joiner.userId}`,
      { method: "PATCH", body: { role: "admin" } },
    );
    expect(promote.status).toBe(204);

    const mid = await c.api(`/api/v1/workspaces/${workspaceId}/members`);
    const midBody = await c.asJson<{
      data: Array<{ email: string; role: string }>;
    }>(mid);
    const promoted = midBody.data.find((m) => m.email === promoteEmail);
    expect(promoted).toMatchObject({ role: "admin" });

    const remove = await c.api(
      `/api/v1/workspaces/${workspaceId}/members/${joiner.userId}`,
      { method: "DELETE" },
    );
    expect(remove.status).toBe(204);

    const after = await c.api(`/api/v1/workspaces/${workspaceId}/members`);
    const afterBody = await c.asJson<{ data: unknown[] }>(after);
    expect(afterBody.data).toHaveLength(1);
  });

  test("member cannot change roles, owner cannot be removed", async () => {
    c.clearJar();
    await c.registerUser();
    const workspaceId = await c.createWorkspace("Locked");
    const peonEmail = uniqueEmail("peon");

    const token = await c.inviteAndGetToken(workspaceId, peonEmail, "admin");
    await c.acceptInviteAs(token, peonEmail);

    const owner = await prisma.workspaceMember.findFirstOrThrow({
      where: { workspaceId },
      select: { userId: true },
    });

    const removeOwner = await c.api(
      `/api/v1/workspaces/${workspaceId}/members/${owner.userId}`,
      { method: "DELETE" },
    );
    expect(removeOwner.status).toBe(403);

    const changeOwner = await c.api(
      `/api/v1/workspaces/${workspaceId}/members/${owner.userId}`,
      { method: "PATCH", body: { role: "member" } },
    );
    expect(changeOwner.status).toBe(403);

    const members = await c.api(`/api/v1/workspaces/${workspaceId}/members`);
    const membersBody = await c.asJson<{ data: unknown[] }>(members);
    expect(membersBody.data).toHaveLength(2);
  });
});
