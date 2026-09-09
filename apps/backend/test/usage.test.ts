import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { makeClient, startServer, stopServer, uniqueEmail } from "./helpers";
import type { TestClient } from "./helpers";
import type { MemberThroughput, MemberUsage, UsageSummary } from "@hive/types";

let server: Server;
let baseUrl = "";
let owner: TestClient;
let member: TestClient;
let workspaceId = "";
let memberId = "";

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  baseUrl = started.baseUrl;

  owner = makeClient(baseUrl);
  await owner.registerUser();
  workspaceId = await owner.createWorkspace("Usage Co");

  // Second user joins as a plain member (non-admin).
  const email = uniqueEmail("member");
  const token = await owner.inviteAndGetToken(workspaceId, email);
  member = makeClient(baseUrl);
  await member.registerUserWith(email);
  const me = await member.api("/api/v1/auth/me");
  memberId = (await member.asJson<{ data: { user: { id: string } } }>(me)).data
    .user.id;
  const accept = await member.api(`/api/v1/invites/${token}/accept`, {
    method: "POST",
  });
  expect(accept.status).toBe(200);

  // Seed: one model, one agent, one session + usage for the member.
  const model = await prisma.model.upsert({
    where: { provider_name: { provider: "anthropic", name: "claude-usage" } },
    create: {
      provider: "anthropic",
      name: "claude-usage",
      inputPricePerMillion: 3,
      outputPricePerMillion: 15,
    },
    update: {},
  });
  const agent = await prisma.agent.create({
    data: { workspaceId, name: "usage-agent", type: "CLAUDE" },
  });
  const session = await prisma.agentSession.create({
    data: {
      developerId: memberId,
      agentId: agent.id,
      workspaceId,
      status: "COMPLETED",
    },
  });
  await prisma.tokenUsage.create({
    data: {
      sessionId: session.id,
      modelId: model.id,
      inputTokens: 1000,
      outputTokens: 200,
      cachedInputTokens: 100,
      costCents: 42,
    },
  });
});

afterAll(async () => {
  await stopServer(server);
});

describe("admin usage dashboard", () => {
  test("owner sees summary + by-member with real totals", async () => {
    const res = await owner.api(
      `/api/v1/workspaces/${workspaceId}/usage/summary`,
    );
    expect(res.status).toBe(200);
    const summary = (await owner.asJson<{ data: UsageSummary }>(res)).data;
    expect(summary.hiddenByPrivacy).toBe(false);
    expect(summary.inputTokens).toBe(1000);
    expect(summary.outputTokens).toBe(200);
    expect(summary.cachedInputTokens).toBe(100);
    expect(summary.costCents).toBe(42);
    expect(summary.byModel).toHaveLength(1);
    expect(summary.byModel[0]!.model).toBe("claude-usage");

    const byMember = await owner.api(
      `/api/v1/workspaces/${workspaceId}/usage/by-member`,
    );
    expect(byMember.status).toBe(200);
    const members = (
      await owner.asJson<{ data: { members: MemberUsage[] } }>(byMember)
    ).data.members;
    const row = members.find((m) => m.userId === memberId);
    expect(row).toBeDefined();
    expect(row!.costCents).toBe(42);
    expect(row!.sessions).toBe(1);
    expect(row!.topModel).toBe("claude-usage");
  });

  test("throughput counts work without token data", async () => {
    const res = await owner.api(
      `/api/v1/workspaces/${workspaceId}/usage/throughput`,
    );
    expect(res.status).toBe(200);
    const members = (
      await owner.asJson<{ data: { members: MemberThroughput[] } }>(res)
    ).data.members;
    const row = members.find((m) => m.userId === memberId);
    expect(row).toBeDefined();
    expect(row!.sessions).toBe(1);
    expect(row!.costCents).toBe(42);
  });

  test("plain members get 403 on every usage route", async () => {
    for (const path of [
      `/api/v1/workspaces/${workspaceId}/usage/summary`,
      `/api/v1/workspaces/${workspaceId}/usage/by-member`,
      `/api/v1/workspaces/${workspaceId}/usage/throughput`,
      `/api/v1/workspaces/${workspaceId}/usage/budget`,
    ]) {
      const res = await member.api(path);
      expect(res.status).toBe(403);
    }
    const patch = await member.api(
      `/api/v1/workspaces/${workspaceId}/usage/budget`,
      { method: "PATCH", body: { monthlyCapCents: 100, alertAtPct: 80 } },
    );
    expect(patch.status).toBe(403);
  });

  test("budget round-trips for admins", async () => {
    const set = await owner.api(
      `/api/v1/workspaces/${workspaceId}/usage/budget`,
      { method: "PATCH", body: { monthlyCapCents: 5000, alertAtPct: 75 } },
    );
    expect(set.status).toBe(200);
    const saved = (
      await owner.asJson<{ data: { monthlyCapCents: number } }>(set)
    ).data;
    expect(saved.monthlyCapCents).toBe(5000);

    const get = await owner.api(
      `/api/v1/workspaces/${workspaceId}/usage/budget`,
    );
    expect(get.status).toBe(200);
    const budget = (
      await owner.asJson<{
        data: { monthlyCapCents: number; alertAtPct: number };
      }>(get)
    ).data;
    expect(budget).toMatchObject({ monthlyCapCents: 5000, alertAtPct: 75 });
  });

  test("privacy-off masks token fields but keeps counts", async () => {
    await prisma.privacySetting.upsert({
      where: { workspaceId },
      create: { workspaceId, allowTokenUsage: false },
      update: { allowTokenUsage: false },
    });
    const res = await owner.api(
      `/api/v1/workspaces/${workspaceId}/usage/summary`,
    );
    expect(res.status).toBe(200);
    const summary = (await owner.asJson<{ data: UsageSummary }>(res)).data;
    expect(summary.hiddenByPrivacy).toBe(true);
    expect(summary.costCents).toBeNull();

    const byMember = await owner.api(
      `/api/v1/workspaces/${workspaceId}/usage/by-member`,
    );
    const members = (
      await owner.asJson<{ data: { members: MemberUsage[] } }>(byMember)
    ).data.members;
    const row = members.find((m) => m.userId === memberId);
    expect(row!.hiddenByPrivacy).toBe(true);
    expect(row!.sessions).toBe(1);
    expect(row!.costCents).toBeNull();
  });
});
