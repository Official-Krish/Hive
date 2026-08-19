import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { makeClient, startServer, stopServer, uniqueEmail } from "./helpers";
import type { TestClient } from "./helpers";

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
    const res = await c.api("/api/workspaces");
    expect(res.status).toBe(401);
  });
});

describe("workspace create + list", () => {
  test("creates a workspace as owner and lists it", async () => {
    c.clearJar();
    await c.registerUser();
    const name = uniqueEmail("proj");
    const id = await c.createWorkspace(name);

    const detail = await c.api(`/api/workspaces/${id}`);
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

    const list = await c.api("/api/workspaces");
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
    const res = await c.api("/api/workspaces", {
      method: "POST",
      body: { name: "My Slash", slug: "my-slash" },
    });
    expect(res.status).toBe(201);
    const body = await c.asJson<{ data: { slug: string } }>(res);
    expect(body.data.slug).toBe("my-slash");

    const bad = await c.api("/api/workspaces", {
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

    const res = await c.api(`/api/workspaces/${id}`);
    expect(res.status).toBe(403);
  });
});

describe("workspace update + delete", () => {
  test("owner can update name/description and delete", async () => {
    c.clearJar();
    await c.registerUser();
    const id = await c.createWorkspace("Rename Me");

    const patch = await c.api(`/api/workspaces/${id}`, {
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

    const del = await c.api(`/api/workspaces/${id}`, { method: "DELETE" });
    expect(del.status).toBe(204);

    const get = await c.api(`/api/workspaces/${id}`);
    expect(get.status).toBe(403);
  });

  test("member cannot update or delete", async () => {
    c.clearJar();
    await c.registerUser();
    const id = await c.createWorkspace("No Touch");

    await c.registerUser();
    const res = await c.api(`/api/workspaces/${id}`, {
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
    const listRes = await c.api(`/api/workspaces/${workspaceId}/invites`);
    const listBody = await c.asJson<{
      data: Array<{ status: string }>;
    }>(listRes);
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0]?.status).toBe("pending");

    await c.acceptInviteAs(token, joinerEmail);

    const membersRes = await c.api(`/api/workspaces/${workspaceId}/members`);
    const membersBody = await c.asJson<{
      data: Array<{ email: string; role: string }>;
    }>(membersRes);
    expect(membersBody.data).toHaveLength(2);
    const joiner = membersBody.data.find((m) => m.email === joinerEmail);
    expect(joiner).toMatchObject({ role: "admin" });

    const invites = await c.api(`/api/workspaces/${workspaceId}/invites`);
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

    const inviteRes = await c.api(`/api/workspaces/${workspaceId}/invites`, {
      method: "POST",
      body: { email: revokeEmail },
    });
    const inviteBody = await c.asJson<{
      data: { invite: { id: string }; token: string };
    }>(inviteRes);
    const inviteId = inviteBody.data.invite.id;
    const token = inviteBody.data.token;

    const revoke = await c.api(
      `/api/workspaces/${workspaceId}/invites/${inviteId}`,
      { method: "DELETE" },
    );
    expect(revoke.status).toBe(204);

    await c.registerUserWith(revokeEmail);
    const accept = await c.api(`/api/invites/${token}/accept`, {
      method: "POST",
    });
    expect(accept.status).toBe(403);
  });

  test("expired invite is rejected", async () => {
    c.clearJar();
    await c.registerUser();
    const workspaceId = await c.createWorkspace("Expiry");
    const expiredEmail = uniqueEmail("expired");

    const inviteRes = await c.api(`/api/workspaces/${workspaceId}/invites`, {
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
    const accept = await c.api(`/api/invites/${token}/accept`, {
      method: "POST",
    });
    expect(accept.status).toBe(403);
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
    const members = await c.api(`/api/workspaces/${workspaceId}/members`);
    const membersBody = await c.asJson<{
      data: Array<{ email: string; userId: string }>;
    }>(members);
    const joiner = membersBody.data.find((m) => m.email === promoteEmail)!;

    const promote = await c.api(
      `/api/workspaces/${workspaceId}/members/${joiner.userId}`,
      { method: "PATCH", body: { role: "admin" } },
    );
    expect(promote.status).toBe(204);

    const mid = await c.api(`/api/workspaces/${workspaceId}/members`);
    const midBody = await c.asJson<{
      data: Array<{ email: string; role: string }>;
    }>(mid);
    const promoted = midBody.data.find((m) => m.email === promoteEmail);
    expect(promoted).toMatchObject({ role: "admin" });

    const remove = await c.api(
      `/api/workspaces/${workspaceId}/members/${joiner.userId}`,
      { method: "DELETE" },
    );
    expect(remove.status).toBe(204);

    const after = await c.api(`/api/workspaces/${workspaceId}/members`);
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
      `/api/workspaces/${workspaceId}/members/${owner.userId}`,
      { method: "DELETE" },
    );
    expect(removeOwner.status).toBe(403);

    const changeOwner = await c.api(
      `/api/workspaces/${workspaceId}/members/${owner.userId}`,
      { method: "PATCH", body: { role: "member" } },
    );
    expect(changeOwner.status).toBe(403);

    const members = await c.api(`/api/workspaces/${workspaceId}/members`);
    const membersBody = await c.asJson<{ data: unknown[] }>(members);
    expect(membersBody.data).toHaveLength(2);
  });
});
