import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { makeClient, startServer, stopServer, uniqueEmail } from "./helpers";
import type { TestClient } from "./helpers";
import type { VendingAvailability, VendingCheckout } from "@hive/types";

let server: Server;
let owner: TestClient;
let member: TestClient;
let workspaceId = "";
const secretFor = (tag: string): string =>
  `sk-test-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let stockedSecret = "";

beforeAll(async () => {
  const started = await startServer();
  server = started.server;

  owner = makeClient(started.baseUrl);
  await owner.registerUser();
  workspaceId = await owner.createWorkspace("Vending Co");

  const email = uniqueEmail("vendee");
  const token = await owner.inviteAndGetToken(workspaceId, email);
  member = makeClient(started.baseUrl);
  await member.registerUserWith(email);
  const accept = await member.api(`/api/v1/invites/${token}/accept`, {
    method: "POST",
  });
  expect(accept.status).toBe(200);
});

afterAll(async () => {
  await stopServer(server);
});

describe("vending machine", () => {
  test("admin stocks keys; pool metadata never contains secrets", async () => {
    const secret = secretFor("claude-1");
    stockedSecret = secret;
    const res = await owner.api(
      `/api/v1/workspaces/${workspaceId}/vending/pool`,
      {
        method: "POST",
        body: {
          provider: "claude",
          label: "team-key-1",
          secret,
          maxCheckouts: null,
        },
      },
    );
    expect(res.status).toBe(201);
    const body = await owner.asJson<{ data: { entry: { keyHash: string } } }>(
      res,
    );
    expect(body.data.entry.keyHash).toHaveLength(64);

    const pool = await owner.api(
      `/api/v1/workspaces/${workspaceId}/vending/pool`,
    );
    const raw = await pool.text();
    expect(raw).not.toContain(secret);

    // Same secret twice → conflict (hash dedupe).
    const dup = await owner.api(
      `/api/v1/workspaces/${workspaceId}/vending/pool`,
      {
        method: "POST",
        body: {
          provider: "claude",
          label: "dup",
          secret,
          maxCheckouts: null,
        },
      },
    );
    expect(dup.status).toBe(409);
  });

  test("member checks out once, then hits the daily limit", async () => {
    const avail = await member.api(
      `/api/v1/workspaces/${workspaceId}/vending/availability`,
    );
    expect(avail.status).toBe(200);
    const providers = (
      await member.asJson<{ data: { providers: VendingAvailability[] } }>(avail)
    ).data.providers;
    expect(providers.find((p) => p.provider === "claude")?.canCheckout).toBe(
      true,
    );

    const out = await member.api(
      `/api/v1/workspaces/${workspaceId}/vending/checkout/claude`,
      { method: "POST" },
    );
    expect(out.status).toBe(200);
    const reveal = (await member.asJson<{ data: VendingCheckout }>(out)).data;
    expect(reveal.secret).toBe(stockedSecret);

    // Second checkout inside 24h → 429 with a retry hint.
    const again = await member.api(
      `/api/v1/workspaces/${workspaceId}/vending/checkout/claude`,
      { method: "POST" },
    );
    expect(again.status).toBe(429);

    // DB holds ciphertext + hash, never the secret.
    const row = await prisma.apiKeyPool.findFirst({
      where: { workspaceId, provider: "CLAUDE" },
    });
    expect(row!.secretEncrypted).not.toContain(stockedSecret);
    expect(row!.checkoutCount).toBe(1);
  });

  test("revoked keys leave the pool; members cannot manage stock", async () => {
    const pool = await owner.api(
      `/api/v1/workspaces/${workspaceId}/vending/pool`,
    );
    const entries = (
      await owner.asJson<{ data: { entries: Array<{ id: string }> } }>(pool)
    ).data.entries;
    const revoke = await owner.api(
      `/api/v1/workspaces/${workspaceId}/vending/pool/${entries[0]!.id}/revoke`,
      { method: "PATCH" },
    );
    expect(revoke.status).toBe(200);

    const forbidden = await member.api(
      `/api/v1/workspaces/${workspaceId}/vending/pool`,
      {
        method: "POST",
        body: {
          provider: "codex",
          label: "nope",
          secret: secretFor("nope"),
          maxCheckouts: null,
        },
      },
    );
    expect(forbidden.status).toBe(403);

    const avail = await member.api(
      `/api/v1/workspaces/${workspaceId}/vending/availability`,
    );
    const providers = (
      await member.asJson<{ data: { providers: VendingAvailability[] } }>(avail)
    ).data.providers;
    const claude = providers.find((p) => p.provider === "claude")!;
    expect(claude.available).toBe(0);
    expect(claude.canCheckout).toBe(false);
  });

  test("single-use keys retire after one reveal; rules are admin-only", async () => {
    await owner.api(`/api/v1/workspaces/${workspaceId}/vending/pool`, {
      method: "POST",
      body: {
        provider: "codex",
        label: "single",
        secret: secretFor("single"),
        maxCheckouts: 1,
      },
    });
    const first = await member.api(
      `/api/v1/workspaces/${workspaceId}/vending/checkout/codex`,
      { method: "POST" },
    );
    expect(first.status).toBe(200);

    const rules = await member.api(
      `/api/v1/workspaces/${workspaceId}/vending/rules`,
    );
    expect(rules.status).toBe(403);

    const set = await owner.api(
      `/api/v1/workspaces/${workspaceId}/vending/rules`,
      {
        method: "PATCH",
        body: {
          maxPerUserPerProviderPer24h: 2,
          cooldownHours: 0,
          minRole: null,
          providerMinRoles: {},
          lowPoolAlertPct: 20,
        },
      },
    );
    expect(set.status).toBe(200);
  });

  test("admin assigns a key; ledger shows taken keys, assignee reads it", async () => {
    const stock = await owner.api(
      `/api/v1/workspaces/${workspaceId}/vending/pool`,
      {
        method: "POST",
        body: {
          provider: "opencode",
          label: "assign-me",
          secret: secretFor("assign"),
          maxCheckouts: null,
        },
      },
    );
    expect(stock.status).toBe(201);
    const poolId = (
      await owner.asJson<{ data: { entry: { id: string } } }>(stock)
    ).data.entry.id;

    const me = await member.api("/api/v1/auth/me");
    const memberId = (
      await member.asJson<{ data: { user: { id: string } } }>(me)
    ).data.user.id;

    const assign = await owner.api(
      `/api/v1/workspaces/${workspaceId}/vending/assign`,
      { method: "POST", body: { poolId, userId: memberId } },
    );
    expect(assign.status).toBe(201);

    // Assignee reads the key back; secret never in the ledger.
    const mine = await member.api(
      `/api/v1/workspaces/${workspaceId}/vending/my-keys`,
    );
    expect(mine.status).toBe(200);
    const keys = (
      await member.asJson<{ data: { keys: Array<{ secret: string }> } }>(mine)
    ).data.keys;
    expect(keys.length).toBe(1);
    expect(keys[0]!.secret.length).toBeGreaterThan(8);

    const ledger = await owner.api(
      `/api/v1/workspaces/${workspaceId}/vending/checkouts`,
    );
    expect(ledger.status).toBe(200);
    const raw = await ledger.text();
    expect(raw).not.toContain(keys[0]!.secret);
    const rows = (
      JSON.parse(raw) as {
        data: {
          checkouts: Array<{ userId: string; assignedByName: string | null }>;
        };
      }
    ).data.checkouts;
    const row = rows.find((r) => r.userId === memberId);
    expect(row).toBeDefined();
    expect(row!.assignedByName).not.toBeNull();

    // Members cannot see the ledger or assign.
    expect(
      (await member.api(`/api/v1/workspaces/${workspaceId}/vending/checkouts`))
        .status,
    ).toBe(403);
    expect(
      (
        await member.api(`/api/v1/workspaces/${workspaceId}/vending/assign`, {
          method: "POST",
          body: { poolId, userId: memberId },
        })
      ).status,
    ).toBe(403);
  });
});
