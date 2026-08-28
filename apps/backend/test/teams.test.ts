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

async function primaryOrgId(email: string): Promise<string> {
  const member = await prisma.organizationMember.findFirst({
    where: { user: { email } },
    select: { orgId: true },
  });
  return member!.orgId;
}

async function userIdFor(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email } });
  return user!.id;
}

async function loginAs(email: string): Promise<void> {
  c.clearJar();
  const res = await c.api("/api/v1/auth/login", {
    method: "POST",
    body: { email, password: "Password123" },
  });
  expect(res.status).toBe(200);
}

describe("teams access", () => {
  test("returns 401 without a session", async () => {
    c.clearJar();
    const res = await c.api("/api/v1/orgs/some-org/teams");
    expect(res.status).toBe(401);
  });

  test("returns 403 for a non-member", async () => {
    const ownerEmail = await c.registerUser();
    const orgId = await primaryOrgId(ownerEmail);
    await c.registerUser();
    const res = await c.api(`/api/v1/orgs/${orgId}/teams`);
    expect(res.status).toBe(403);
  });
});

describe("team CRUD (owner)", () => {
  test("creates, lists, reads, updates, deletes and keeps slugs unique", async () => {
    const ownerEmail = await c.registerUser();
    const orgId = await primaryOrgId(ownerEmail);

    const create = await c.api(`/api/v1/orgs/${orgId}/teams`, {
      method: "POST",
      body: { name: "Platform" },
    });
    expect(create.status).toBe(201);
    const created = await c.asJson<{
      data: { id: string; name: string; slug: string; memberCount: number };
    }>(create);
    expect(created.data).toMatchObject({ name: "Platform", memberCount: 0 });
    const teamId = created.data.id;
    expect(created.data.slug).toBe("platform");

    const list = await c.api(`/api/v1/orgs/${orgId}/teams`);
    expect(list.status).toBe(200);
    const listBody = await c.asJson<{ data: Array<{ id: string }> }>(list);
    expect(listBody.data.map((t) => t.id)).toContain(teamId);

    const get = await c.api(`/api/v1/orgs/${orgId}/teams/${teamId}`);
    expect(get.status).toBe(200);

    const update = await c.api(`/api/v1/orgs/${orgId}/teams/${teamId}`, {
      method: "PATCH",
      body: { name: "Platform Eng" },
    });
    expect(update.status).toBe(200);
    const updateBody = await c.asJson<{ data: { name: string } }>(update);
    expect(updateBody.data.name).toBe("Platform Eng");

    const createDup = await c.api(`/api/v1/orgs/${orgId}/teams`, {
      method: "POST",
      body: { name: "Shared", slug: "shared" },
    });
    expect(createDup.status).toBe(201);
    const dup = await c.asJson<{ data: { slug: string } }>(createDup);
    expect(dup.data.slug).toBe("shared");

    const createDup2 = await c.api(`/api/v1/orgs/${orgId}/teams`, {
      method: "POST",
      body: { name: "Shared Too", slug: "shared" },
    });
    expect(createDup2.status).toBe(201);
    const dup2 = await c.asJson<{ data: { slug: string } }>(createDup2);
    expect(dup2.data.slug).not.toBe("shared");

    const del = await c.api(`/api/v1/orgs/${orgId}/teams/${teamId}`, {
      method: "DELETE",
    });
    expect(del.status).toBe(204);

    const after = await c.api(`/api/v1/orgs/${orgId}/teams`);
    const afterBody = await c.asJson<{ data: Array<{ id: string }> }>(after);
    expect(afterBody.data.map((t) => t.id)).not.toContain(teamId);
  });
});

describe("team member management", () => {
  test("owner adds, lists, changes role and removes; admin is blocked from role/remove", async () => {
    const ownerEmail = await c.registerUser();
    const orgId = await primaryOrgId(ownerEmail);
    await c.createWorkspace("Teams");
    const workspaceId = await c.primaryWorkspaceId();

    const teamRes = await c.api(`/api/v1/orgs/${orgId}/teams`, {
      method: "POST",
      body: { name: "Core" },
    });
    const team = await c.asJson<{ data: { id: string } }>(teamRes);
    const teamId = team.data.id;

    const adminEmail = uniqueEmail("admin");
    const token = await c.inviteAndGetToken(workspaceId, adminEmail, "admin");
    await c.acceptInviteAs(token, adminEmail);
    const adminId = await userIdFor(adminEmail);
    await loginAs(ownerEmail);

    const add = await c.api(`/api/v1/orgs/${orgId}/teams/${teamId}/members`, {
      method: "POST",
      body: { userId: adminId, role: "admin" },
    });
    expect(add.status).toBe(204);

    const members = await c.api(
      `/api/v1/orgs/${orgId}/teams/${teamId}/members`,
    );
    const memberBody = await c.asJson<{
      data: Array<{ userId: string; role: string }>;
    }>(members);
    expect(memberBody.data.map((m) => m.userId)).toContain(adminId);
    expect(memberBody.data.find((m) => m.userId === adminId)?.role).toBe(
      "admin",
    );

    const changeRole = await c.api(
      `/api/v1/orgs/${orgId}/teams/${teamId}/members/${adminId}/role`,
      { method: "PATCH", body: { role: "member" } },
    );
    expect(changeRole.status).toBe(204);

    const changed = await c.api(
      `/api/v1/orgs/${orgId}/teams/${teamId}/members`,
    );
    const changedBody = await c.asJson<{
      data: Array<{ userId: string; role: string }>;
    }>(changed);
    expect(changedBody.data.find((m) => m.userId === adminId)?.role).toBe(
      "member",
    );

    // admin cannot change/remove team members (owner-only)
    await loginAs(adminEmail);
    const adminChange = await c.api(
      `/api/v1/orgs/${orgId}/teams/${teamId}/members/${adminId}/role`,
      { method: "PATCH", body: { role: "admin" } },
    );
    expect(adminChange.status).toBe(403);
    const adminRemove = await c.api(
      `/api/v1/orgs/${orgId}/teams/${teamId}/members/${adminId}`,
      { method: "DELETE" },
    );
    expect(adminRemove.status).toBe(403);

    // owner removes the member
    await loginAs(ownerEmail);
    const remove = await c.api(
      `/api/v1/orgs/${orgId}/teams/${teamId}/members/${adminId}`,
      { method: "DELETE" },
    );
    expect(remove.status).toBe(204);
  });

  test("rejects adding a user who is not an org member", async () => {
    const ownerEmail = await c.registerUser();
    const orgId = await primaryOrgId(ownerEmail);

    const teamRes = await c.api(`/api/v1/orgs/${orgId}/teams`, {
      method: "POST",
      body: { name: "Gated" },
    });
    const team = await c.asJson<{ data: { id: string } }>(teamRes);
    const teamId = team.data.id;

    const outsiderEmail = await c.registerUser();
    const outsiderId = await userIdFor(outsiderEmail);

    const add = await c.api(`/api/v1/orgs/${orgId}/teams/${teamId}/members`, {
      method: "POST",
      body: { userId: outsiderId, role: "member" },
    });
    expect(add.status).toBe(403);
  });

  test("blocks changing or removing your own team membership", async () => {
    const ownerEmail = await c.registerUser();
    const orgId = await primaryOrgId(ownerEmail);

    const teamRes = await c.api(`/api/v1/orgs/${orgId}/teams`, {
      method: "POST",
      body: { name: "Solo" },
    });
    const team = await c.asJson<{ data: { id: string } }>(teamRes);
    const teamId = team.data.id;
    const ownerId = await userIdFor(ownerEmail);

    const selfChange = await c.api(
      `/api/v1/orgs/${orgId}/teams/${teamId}/members/${ownerId}/role`,
      { method: "PATCH", body: { role: "member" } },
    );
    expect(selfChange.status).toBe(403);

    const selfRemove = await c.api(
      `/api/v1/orgs/${orgId}/teams/${teamId}/members/${ownerId}`,
      { method: "DELETE" },
    );
    expect(selfRemove.status).toBe(403);
  });
});
