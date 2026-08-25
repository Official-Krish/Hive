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

describe("orgs access", () => {
  test("returns 401 without a session", async () => {
    c.clearJar();
    const res = await c.api("/api/v1/orgs/some-org");
    expect(res.status).toBe(401);
  });

  test("returns 403 for a non-member", async () => {
    const ownerEmail = await c.registerUser();
    const orgId = await primaryOrgId(ownerEmail);
    await c.registerUser();
    const res = await c.api(`/api/v1/orgs/${orgId}`);
    expect(res.status).toBe(403);
  });
});

describe("org detail + update", () => {
  test("reads and updates an org as its owner", async () => {
    const ownerEmail = await c.registerUser();
    const orgId = await primaryOrgId(ownerEmail);

    const get = await c.api(`/api/v1/orgs/${orgId}`);
    expect(get.status).toBe(200);
    const getBody = await c.asJson<{
      data: {
        name: string;
        slug: string;
        plan: string;
        role: string;
        memberCount: number;
        workspaceCount: number;
      };
    }>(get);
    expect(getBody.data).toMatchObject({
      name: "Test User's Organization",
      plan: "free",
      role: "owner",
      memberCount: 1,
    });
    expect(getBody.data.workspaceCount).toBeGreaterThanOrEqual(1);

    const slug = `acme-${Date.now()}`;
    const patch = await c.api(`/api/v1/orgs/${orgId}`, {
      method: "PATCH",
      body: { name: "Acme", slug },
    });
    expect(patch.status).toBe(200);
    const patchBody = await c.asJson<{ data: { name: string; slug: string } }>(
      patch,
    );
    expect(patchBody.data).toMatchObject({ name: "Acme", slug });
  });
});

describe("org admin role", () => {
  test("admin can read/rename but not change plan, roles or members", async () => {
    const ownerEmail = await c.registerUser();
    const orgId = await primaryOrgId(ownerEmail);
    await c.createWorkspace("Orgs");
    const workspaceId = await c.primaryWorkspaceId();
    const ownerId = await userIdFor(ownerEmail);

    const adminEmail = uniqueEmail("admin");
    const token = await c.inviteAndGetToken(workspaceId, adminEmail, "admin");
    await c.acceptInviteAs(token, adminEmail);
    await loginAs(adminEmail);

    const get = await c.api(`/api/v1/orgs/${orgId}`);
    const getBody = await c.asJson<{
      data: { role: string; memberCount: number };
    }>(get);
    expect(getBody.data).toMatchObject({ role: "admin", memberCount: 2 });

    const rename = await c.api(`/api/v1/orgs/${orgId}`, {
      method: "PATCH",
      body: { name: "Acme Admin" },
    });
    expect(rename.status).toBe(200);

    const planPatch = await c.api(`/api/v1/orgs/${orgId}`, {
      method: "PATCH",
      body: { plan: "team" },
    });
    expect(planPatch.status).toBe(403);

    const rolePatch = await c.api(
      `/api/v1/orgs/${orgId}/members/${ownerId}/role`,
      { method: "PATCH", body: { role: "admin" } },
    );
    expect(rolePatch.status).toBe(403);
  });
});

describe("org member management (owner)", () => {
  test("lists members/workspaces, demotes, removes and blocks self-changes", async () => {
    const ownerEmail = await c.registerUser();
    const orgId = await primaryOrgId(ownerEmail);
    await c.createWorkspace("Orgs");
    const workspaceId = await c.primaryWorkspaceId();
    const ownerId = await userIdFor(ownerEmail);

    const memberEmail = uniqueEmail("member");
    const token = await c.inviteAndGetToken(workspaceId, memberEmail, "admin");
    await c.acceptInviteAs(token, memberEmail);
    const memberId = await userIdFor(memberEmail);
    await loginAs(ownerEmail);

    const membersRes = await c.api(`/api/v1/orgs/${orgId}/members`);
    const membersBody = await c.asJson<{
      data: Array<{ userId: string; role: string; status: string }>;
    }>(membersRes);
    expect(membersBody.data).toHaveLength(2);
    expect(membersBody.data.map((m) => m.userId)).toContain(memberId);
    expect(membersBody.data.find((m) => m.userId === memberId)).toMatchObject({
      role: "admin",
      status: "active",
    });

    const workspacesRes = await c.api(`/api/v1/orgs/${orgId}/workspaces`);
    const workspacesBody = await c.asJson<{ data: Array<{ id: string }> }>(
      workspacesRes,
    );
    expect(workspacesBody.data.map((w) => w.id)).toContain(workspaceId);

    const selfRole = await c.api(
      `/api/v1/orgs/${orgId}/members/${ownerId}/role`,
      {
        method: "PATCH",
        body: { role: "member" },
      },
    );
    expect(selfRole.status).toBe(403);

    const selfRemove = await c.api(`/api/v1/orgs/${orgId}/members/${ownerId}`, {
      method: "DELETE",
    });
    expect(selfRemove.status).toBe(403);

    const demote = await c.api(
      `/api/v1/orgs/${orgId}/members/${memberId}/role`,
      {
        method: "PATCH",
        body: { role: "member" },
      },
    );
    expect(demote.status).toBe(204);

    const remove = await c.api(`/api/v1/orgs/${orgId}/members/${memberId}`, {
      method: "DELETE",
    });
    expect(remove.status).toBe(204);

    const after = await c.api(`/api/v1/orgs/${orgId}/members`);
    const afterBody = await c.asJson<{ data: Array<{ userId: string }> }>(
      after,
    );
    expect(afterBody.data.map((m) => m.userId)).not.toContain(memberId);
  });
});
