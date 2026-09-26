import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { makeClient, startServer, stopServer, uniqueEmail } from "./helpers";
import type { TestClient } from "./helpers";
import type { PRCostResponse } from "@hive/types";

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  baseUrl = started.baseUrl;
});

afterAll(async () => {
  await stopServer(server);
});

interface Fixture {
  owner: TestClient;
  member: TestClient;
  workspaceId: string;
  ownerId: string;
  memberId: string;
  agentId: string;
  modelId: string;
  repoId: string;
}

async function setup(tag: string): Promise<Fixture> {
  const owner = makeClient(baseUrl);
  await owner.registerUser();
  const workspaceId = await owner.createWorkspace(`Costs ${tag}`);
  const ownerMe = await owner.api("/api/v1/auth/me");
  const ownerId = (
    await owner.asJson<{ data: { user: { id: string } } }>(ownerMe)
  ).data.user.id;

  const email = uniqueEmail(`cost-member-${tag}`);
  const token = await owner.inviteAndGetToken(workspaceId, email);
  const member = makeClient(baseUrl);
  await member.registerUserWith(email);
  const me = await member.api("/api/v1/auth/me");
  const memberId = (await member.asJson<{ data: { user: { id: string } } }>(me))
    .data.user.id;
  const accept = await member.api(`/api/v1/invites/${token}/accept`, {
    method: "POST",
  });
  expect(accept.status).toBe(200);

  const model = await prisma.model.upsert({
    where: { provider_name: { provider: "anthropic", name: `claude-cost` } },
    create: {
      provider: "anthropic",
      name: "claude-cost",
      inputPricePerMillion: 3,
      outputPricePerMillion: 15,
    },
    update: {},
  });
  const agent = await prisma.agent.create({
    data: { workspaceId, name: `cost-agent-${tag}`, type: "CLAUDE" },
  });
  const repo = await prisma.repository.create({
    data: { workspaceId, name: `cost-repo-${tag}` },
  });
  return {
    owner,
    member,
    workspaceId,
    ownerId,
    memberId,
    agentId: agent.id,
    modelId: model.id,
    repoId: repo.id,
  };
}

async function spend(
  f: Fixture,
  opts: {
    costCents: number;
    repositoryId?: string | null;
    branch?: string | null;
    developerId?: string;
    startedAt?: Date;
    endedAt?: Date;
  },
): Promise<string> {
  const session = await prisma.agentSession.create({
    data: {
      developerId: opts.developerId ?? f.memberId,
      agentId: f.agentId,
      workspaceId: f.workspaceId,
      repositoryId: opts.repositoryId ?? null,
      branch: opts.branch ?? null,
      status: "COMPLETED",
      startedAt: opts.startedAt ?? new Date("2026-09-10T10:00:00Z"),
      endedAt: opts.endedAt ?? new Date("2026-09-10T12:00:00Z"),
    },
  });
  await prisma.tokenUsage.create({
    data: {
      sessionId: session.id,
      modelId: f.modelId,
      inputTokens: 100,
      outputTokens: 10,
      costCents: opts.costCents,
      measuredAt: new Date("2026-09-10T11:00:00Z"),
    },
  });
  return session.id;
}

async function pr(
  f: Fixture,
  opts: {
    number: number;
    headBranch?: string | null;
    status?: "DRAFT" | "OPEN" | "MERGED" | "CLOSED";
    title?: string;
  },
) {
  return prisma.pullRequest.create({
    data: {
      repositoryId: f.repoId,
      number: opts.number,
      title: opts.title ?? `Feature ${opts.number}`,
      status: opts.status ?? "OPEN",
      authorId: f.memberId,
      headBranch: opts.headBranch ?? null,
      createdAt: new Date("2026-09-09T10:00:00Z"),
      updatedAt: new Date("2026-09-11T10:00:00Z"),
      mergedAt:
        opts.status === "MERGED" ? new Date("2026-09-12T10:00:00Z") : null,
      closedAt:
        opts.status === "CLOSED" ? new Date("2026-09-12T10:00:00Z") : null,
    },
  });
}

async function getCosts(
  f: Fixture,
  query = "",
): Promise<{ status: number; body: { data: PRCostResponse } }> {
  const res = await f.owner.api(
    `/api/v1/workspaces/${f.workspaceId}/usage/costs${query}`,
  );
  const body = await f.owner.asJson<{ data: PRCostResponse }>(res);
  return { status: res.status, body };
}

describe("cost attribution", () => {
  test("attributes direct branch spend to the PR", async () => {
    const f = await setup("direct");
    await spend(f, {
      costCents: 100,
      repositoryId: f.repoId,
      branch: "feat-x",
    });
    await pr(f, { number: 1, headBranch: "feat-x", status: "MERGED" });

    const { status, body } = await getCosts(f);
    expect(status).toBe(200);
    expect(body.data.total).toBe(1);
    const item = body.data.items[0]!;
    expect(item.number).toBe(1);
    expect(item.status).toBe("MERGED");
    expect(item.sessions).toBe(1);
    expect(item.directSessions).toBe(1);
    expect(item.inferredSessions).toBe(0);
    expect(item.directCostCents).toBe(100);
    expect(item.totalCostCents).toBe(100);
    expect(body.data.summary.totalCostCents).toBe(100);
    expect(body.data.summary.mergedCostCents).toBe(100);
    expect(body.data.summary.abandonedCostCents).toBe(0);
    expect(body.data.summary.unattributedCostCents).toBe(0);
  });

  test("infers author-window spend without double-counting", async () => {
    const f = await setup("inferred");
    await spend(f, {
      costCents: 100,
      repositoryId: f.repoId,
      branch: "feat-x",
    });
    await spend(f, {
      costCents: 50,
      repositoryId: f.repoId,
      branch: "spike-other",
    });
    await pr(f, { number: 7, headBranch: "feat-x", status: "OPEN" });

    const { body } = await getCosts(f);
    const item = body.data.items[0]!;
    expect(item.directCostCents).toBe(100);
    expect(item.inferredCostCents).toBe(50);
    expect(item.totalCostCents).toBe(150);
    expect(item.directSessions).toBe(1);
    expect(item.inferredSessions).toBe(1);
    // Totals must equal raw session spend — no double attribution.
    expect(body.data.summary.totalCostCents).toBe(150);
    expect(body.data.summary.directCostCents).toBe(100);
    expect(body.data.summary.inferredCostCents).toBe(50);
  });

  test("leaves orphan spend unattributed", async () => {
    const f = await setup("orphan");
    await spend(f, { costCents: 30 }); // no repo at all
    await spend(f, {
      costCents: 20,
      repositoryId: f.repoId,
      branch: "lonely",
      developerId: f.ownerId, // repo, but nobody's PR author
    });
    await pr(f, { number: 1, headBranch: "feat-x", status: "MERGED" });

    const { body } = await getCosts(f);
    expect(body.data.summary.unattributedCostCents).toBe(50);
    expect(body.data.summary.totalCostCents).toBe(0);
    expect(body.data.items[0]!.sessions).toBe(0);
  });

  test("counts closed-unmerged spend as abandoned", async () => {
    const f = await setup("abandoned");
    await spend(f, {
      costCents: 70,
      repositoryId: f.repoId,
      branch: "dead-end",
    });
    await pr(f, { number: 3, headBranch: "dead-end", status: "CLOSED" });

    const { body } = await getCosts(f);
    expect(body.data.summary.abandonedCostCents).toBe(70);
    expect(body.data.summary.mergedCostCents).toBe(0);
  });

  test("paginates across PRs", async () => {
    const f = await setup("pages");
    await pr(f, { number: 1, status: "MERGED" });
    await pr(f, { number: 2, status: "OPEN" });
    await pr(f, { number: 3, status: "CLOSED" });

    const first = await getCosts(f, "?page=1&pageSize=2");
    expect(first.body.data.total).toBe(3);
    expect(first.body.data.items).toHaveLength(2);
    expect(first.body.data.hasMore).toBe(true);

    const second = await getCosts(f, "?page=2&pageSize=2");
    expect(second.body.data.items).toHaveLength(1);
    expect(second.body.data.hasMore).toBe(false);
    // Summary always covers the full in-range set, not the page.
    expect(second.body.data.summary.prs).toBe(3);
  });

  test("masks costs when token visibility is off", async () => {
    const f = await setup("masked");
    await spend(f, {
      costCents: 100,
      repositoryId: f.repoId,
      branch: "feat-x",
    });
    await pr(f, { number: 1, headBranch: "feat-x", status: "MERGED" });

    const patch = await f.owner.api(
      `/api/v1/workspaces/${f.workspaceId}/privacy`,
      { method: "PATCH", body: { allowTokenUsage: false } },
    );
    expect(patch.status).toBe(200);

    const { body } = await getCosts(f);
    const item = body.data.items[0]!;
    expect(item.hiddenByPrivacy).toBe(true);
    expect(item.totalCostCents).toBeNull();
    expect(item.sessions).toBe(1);
    expect(body.data.summary.hiddenByPrivacy).toBe(true);
    expect(body.data.summary.totalCostCents).toBeNull();
  });

  test("rejects non-admin members", async () => {
    const f = await setup("forbidden");
    const res = await f.member.api(
      `/api/v1/workspaces/${f.workspaceId}/usage/costs`,
    );
    expect(res.status).toBe(403);
  });
});
