import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { closeRedis, ensureConnected } from "@hive/queue";
import { createApp } from "../src/app";

let server: Server;
let baseUrl: string;

const jar = new Map<string, string>();
let emailCounter = 0;

const uniqueEmail = (): string =>
  `ws-${++emailCounter}-${Date.now()}@hive.test`;

function saveJar(): Map<string, string> {
  return new Map(jar);
}

function restoreJar(saved: Map<string, string>): void {
  jar.clear();
  for (const [name, value] of saved) jar.set(name, value);
}

function captureCookies(res: Response): void {
  for (const cookie of res.headers.getSetCookie()) {
    const pair = cookie.split(";")[0] ?? "";
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = pair.slice(0, idx);
    const value = pair.slice(idx + 1);
    if (value === "") {
      jar.delete(name);
    } else {
      jar.set(name, value);
    }
  }
}

function cookieHeader(): string {
  return [...jar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function api(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<Response> {
  const { method = "GET", body, headers = {} } = options;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(jar.size > 0 ? { cookie: cookieHeader() } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  captureCookies(res);
  return res;
}

const asJson = async (res: Response): Promise<{ data: unknown }> =>
  (await res.json()) as { data: unknown };

async function registerUser(): Promise<string> {
  const email = uniqueEmail();
  const res = await api("/api/auth/register", {
    method: "POST",
    body: { email, password: "Password123", name: "Workspace User" },
  });
  expect(res.status).toBe(201);
  return email;
}

async function registerUserWith(email: string): Promise<void> {
  const res = await api("/api/auth/register", {
    method: "POST",
    body: { email, password: "Password123", name: "Invited User" },
  });
  expect(res.status).toBe(201);
}

async function createWorkspace(name: string): Promise<string> {
  const res = await api("/api/workspaces", {
    method: "POST",
    body: { name },
  });
  expect(res.status).toBe(201);
  const body = await asJson(res);
  return (body.data as { id: string }).id;
}

async function inviteAndGetToken(
  workspaceId: string,
  email: string,
  role?: string,
): Promise<string> {
  const res = await api(`/api/workspaces/${workspaceId}/invites`, {
    method: "POST",
    body: { email, ...(role ? { role } : {}) },
  });
  expect(res.status).toBe(201);
  const body = await asJson(res);
  return (body.data as { token: string }).token;
}

async function acceptInviteAs(token: string, email: string): Promise<void> {
  await registerUserWith(email);
  const res = await api(`/api/invites/${token}/accept`, { method: "POST" });
  expect(res.status).toBe(200);
}

beforeAll(async () => {
  await ensureConnected();
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (address && typeof address === "object") {
    baseUrl = `http://localhost:${address.port}`;
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
  closeRedis();
});

describe("workspace auth", () => {
  test("returns 401 without a session", async () => {
    jar.clear();
    const res = await api("/api/workspaces");
    expect(res.status).toBe(401);
  });
});

describe("workspace create + list", () => {
  test("creates a workspace as owner and lists it", async () => {
    jar.clear();
    await registerUser();
    const name = `Project ${emailCounter}`;
    const id = await createWorkspace(name);

    const detail = await api(`/api/workspaces/${id}`);
    expect(detail.status).toBe(200);
    const body = await asJson(detail);
    expect(body.data).toMatchObject({
      id,
      name,
      role: "owner",
      memberCount: 1,
    });

    const list = await api("/api/workspaces");
    const listBody = await asJson(list);
    const created = (listBody.data as Array<{ id: string }>).find(
      (w) => w.id === id,
    );
    expect(created).toMatchObject({ id, name, role: "owner", memberCount: 1 });
  });

  test("applies the custom slug and validates invalid input", async () => {
    jar.clear();
    await registerUser();
    const res = await api("/api/workspaces", {
      method: "POST",
      body: { name: "My Slash", slug: "my-slash" },
    });
    expect(res.status).toBe(201);
    const body = await asJson(res);
    expect((body.data as { slug: string }).slug).toBe("my-slash");

    const bad = await api("/api/workspaces", {
      method: "POST",
      body: { name: "" },
    });
    expect(bad.status).toBe(400);
  });

  test("member of another workspace cannot see a foreign workspace", async () => {
    jar.clear();
    await registerUser();
    const id = await createWorkspace("Private");
    await registerUser();

    const res = await api(`/api/workspaces/${id}`);
    expect(res.status).toBe(403);
  });
});

describe("workspace update + delete", () => {
  test("owner can update name/description and delete", async () => {
    jar.clear();
    await registerUser();
    const id = await createWorkspace("Rename Me");

    const patch = await api(`/api/workspaces/${id}`, {
      method: "PATCH",
      body: { name: "Renamed", description: "New desc" },
    });
    expect(patch.status).toBe(200);
    const body = await asJson(patch);
    expect(body.data).toMatchObject({
      name: "Renamed",
      description: "New desc",
    });

    const del = await api(`/api/workspaces/${id}`, { method: "DELETE" });
    expect(del.status).toBe(204);

    const get = await api(`/api/workspaces/${id}`);
    expect(get.status).toBe(403);
  });

  test("member cannot update or delete", async () => {
    jar.clear();
    await registerUser();
    const id = await createWorkspace("No Touch");

    await registerUser();
    const res = await api(`/api/workspaces/${id}`, {
      method: "PATCH",
      body: { name: "Hacked" },
    });
    expect(res.status).toBe(403);
  });
});

describe("invites", () => {
  test("owner invites, member accepts, roles enforced", async () => {
    jar.clear();
    await registerUser();
    const workspaceId = await createWorkspace("Team");
    const joinerEmail = uniqueEmail();

    const token = await inviteAndGetToken(workspaceId, joinerEmail, "admin");
    const listRes = await api(`/api/workspaces/${workspaceId}/invites`);
    const listBody = await asJson(listRes);
    expect(listBody.data).toHaveLength(1);
    const pendingList = listBody.data as Array<{ status: string }>;
    expect(pendingList[0]?.status).toBe("pending");

    await acceptInviteAs(token, joinerEmail);

    const membersRes = await api(`/api/workspaces/${workspaceId}/members`);
    const membersBody = await asJson(membersRes);
    expect(membersBody.data).toHaveLength(2);
    const joiner = (membersBody.data as Array<{ email: string }>).find(
      (m) => m.email === joinerEmail,
    );
    expect(joiner).toMatchObject({ role: "admin" });

    const invites = await api(`/api/workspaces/${workspaceId}/invites`);
    const invitesBody = await asJson(invites);
    const inviteList = invitesBody.data as Array<{ status: string }>;
    expect(inviteList[0]?.status).toBe("accepted");
  });

  test("member cannot create invites, revoked invite is rejected", async () => {
    jar.clear();
    await registerUser();
    const workspaceId = await createWorkspace("Invites");
    const revokeEmail = uniqueEmail();

    const inviteRes = await api(`/api/workspaces/${workspaceId}/invites`, {
      method: "POST",
      body: { email: revokeEmail },
    });
    const inviteBody = await asJson(inviteRes);
    const inviteData = inviteBody.data as {
      invite: { id: string };
      token: string;
    };
    const inviteId = inviteData.invite.id;
    const token = inviteData.token;

    const revoke = await api(
      `/api/workspaces/${workspaceId}/invites/${inviteId}`,
      { method: "DELETE" },
    );
    expect(revoke.status).toBe(204);

    await registerUserWith(revokeEmail);
    const accept = await api(`/api/invites/${token}/accept`, {
      method: "POST",
    });
    expect(accept.status).toBe(403);
  });

  test("expired invite is rejected", async () => {
    jar.clear();
    await registerUser();
    const workspaceId = await createWorkspace("Expiry");
    const expiredEmail = uniqueEmail();

    const inviteRes = await api(`/api/workspaces/${workspaceId}/invites`, {
      method: "POST",
      body: { email: expiredEmail },
    });
    const inviteBody = await asJson(inviteRes);
    const inviteData = inviteBody.data as {
      invite: { id: string };
      token: string;
    };
    const token = inviteData.token;

    const invite = await prisma.invite.findUniqueOrThrow({
      where: { id: inviteData.invite.id },
    });
    await prisma.invite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await registerUserWith(expiredEmail);
    const accept = await api(`/api/invites/${token}/accept`, {
      method: "POST",
    });
    expect(accept.status).toBe(403);
  });
});

describe("members", () => {
  test("admin can change roles and remove a member", async () => {
    jar.clear();
    await registerUser();
    const workspaceId = await createWorkspace("Members");
    const promoteEmail = uniqueEmail();
    const ownerJar = saveJar();

    const token = await inviteAndGetToken(workspaceId, promoteEmail);
    await acceptInviteAs(token, promoteEmail);

    restoreJar(ownerJar);
    const members = await api(`/api/workspaces/${workspaceId}/members`);
    const membersBody = await asJson(members);
    const joiner = (
      membersBody.data as Array<{ email: string; userId: string }>
    ).find((m) => m.email === promoteEmail)!;

    const promote = await api(
      `/api/workspaces/${workspaceId}/members/${joiner.userId}`,
      { method: "PATCH", body: { role: "admin" } },
    );
    expect(promote.status).toBe(204);

    const mid = await api(`/api/workspaces/${workspaceId}/members`);
    const midBody = await asJson(mid);
    const promoted = (midBody.data as Array<{ email: string }>).find(
      (m) => m.email === promoteEmail,
    );
    expect(promoted).toMatchObject({ role: "admin" });

    const remove = await api(
      `/api/workspaces/${workspaceId}/members/${joiner.userId}`,
      { method: "DELETE" },
    );
    expect(remove.status).toBe(204);

    const after = await api(`/api/workspaces/${workspaceId}/members`);
    const afterBody = await asJson(after);
    expect(afterBody.data).toHaveLength(1);
  });

  test("member cannot change roles, owner cannot be removed", async () => {
    jar.clear();
    await registerUser();
    const workspaceId = await createWorkspace("Locked");
    const peonEmail = uniqueEmail();

    const token = await inviteAndGetToken(workspaceId, peonEmail, "admin");
    await acceptInviteAs(token, peonEmail);

    const owner = await prisma.workspaceMember.findFirstOrThrow({
      where: { workspaceId },
      select: { userId: true },
    });

    const removeOwner = await api(
      `/api/workspaces/${workspaceId}/members/${owner.userId}`,
      { method: "DELETE" },
    );
    expect(removeOwner.status).toBe(403);

    const changeOwner = await api(
      `/api/workspaces/${workspaceId}/members/${owner.userId}`,
      { method: "PATCH", body: { role: "member" } },
    );
    expect(changeOwner.status).toBe(403);

    const members = await api(`/api/workspaces/${workspaceId}/members`);
    const membersBody = await asJson(members);
    expect(membersBody.data).toHaveLength(2);
  });
});
