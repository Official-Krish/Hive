import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { makeClient, startServer, stopServer, uniqueEmail } from "./helpers";
import type { TestClient } from "./helpers";
import { ReviewService } from "../src/modules/github/review.service";
import { aiEnabled } from "../src/modules/ai/ai-client";

let server: Server;
let baseUrl = "";
let owner: TestClient;
let member: TestClient;
let workspaceId = "";
let repositoryId = "";

beforeAll(async () => {
  const started = await startServer();
  server = started.server;
  baseUrl = started.baseUrl;

  owner = makeClient(baseUrl);
  await owner.registerUser();
  workspaceId = await owner.createWorkspace("Review Co");

  const email = uniqueEmail("reviewee");
  const token = await owner.inviteAndGetToken(workspaceId, email);
  member = makeClient(baseUrl);
  await member.registerUserWith(email);
  const accept = await member.api(`/api/v1/invites/${token}/accept`, {
    method: "POST",
  });
  expect(accept.status).toBe(200);

  const stamp = Date.now();
  const repo = await prisma.repository.create({
    data: {
      workspaceId,
      name: `review-me-${stamp}`,
      githubRepoId: 900000 + (stamp % 100000),
      githubFullName: `acme/review-me-${stamp}`,
    },
  });
  repositoryId = repo.id;
});

afterAll(async () => {
  await stopServer(server);
});

describe("reviewer trigger + toggle", () => {
  test("requestReview triggers when AI is configured, else skips", async () => {
    const service = new ReviewService();
    await service.requestReview({
      workspaceId,
      repositoryId,
      prNumber: 12,
      sha: "abc123",
      title: "Add thing",
    });
    const rows = await prisma.review.findMany({
      where: { repositoryId, prNumber: 12 },
    });
    if (aiEnabled()) {
      // Local dev env has an AI key: trigger path creates a QUEUED row.
      expect(rows).toHaveLength(1);
      expect(rows[0]!.status).toBe("QUEUED");
    } else {
      // CI has no AI key: silent skip, no row, no crash.
      expect(rows).toHaveLength(0);
    }
  });

  test("recent reviews feed lists passes with findings", async () => {
    await prisma.review.create({
      data: {
        workspaceId,
        repositoryId,
        prNumber: 42,
        sha: "def456",
        status: "DONE",
        findings: [
          {
            severity: "major",
            file: "src/x.ts",
            line: 3,
            title: "No test",
            detail: "Add one.",
          },
        ],
        costCents: 7,
      },
    });
    const res = await member.api(
      `/api/v1/github/${workspaceId}/reviews/recent`,
    );
    expect(res.status).toBe(200);
    const body = await member.asJson<{
      data: {
        reviews: Array<{
          prNumber: number;
          findingCount: number;
          findings: unknown[] | null;
        }>;
      };
    }>(res);
    const row = body.data.reviews.find((r) => r.prNumber === 42);
    expect(row).toBeDefined();
    expect(row!.findingCount).toBe(1);
    expect(row!.findings).toHaveLength(1);

    // Git metadata off → rows stay, findings masked.
    await prisma.privacySetting.upsert({
      where: { workspaceId },
      create: { workspaceId, allowGitMetadata: false },
      update: { allowGitMetadata: false },
    });
    const masked = await member.api(
      `/api/v1/github/${workspaceId}/reviews/recent`,
    );
    const maskedBody = await member.asJson<{
      data: {
        reviews: Array<{ prNumber: number; findings: unknown[] | null }>;
      };
    }>(masked);
    const maskedRow = maskedBody.data.reviews.find((r) => r.prNumber === 42);
    expect(maskedRow!.findings).toBeNull();
  });

  test("repo review toggle is maintainer+ only", async () => {
    const path = `/api/v1/workspaces/${workspaceId}/settings/repositories/${repositoryId}/review`;
    const denied = await member.api(path, {
      method: "PATCH",
      body: { reviewEnabled: false },
    });
    expect(denied.status).toBe(403);

    const ok = await owner.api(path, {
      method: "PATCH",
      body: { reviewEnabled: false },
    });
    expect(ok.status).toBe(200);
    const body = await owner.asJson<{
      data: { repository: { reviewEnabled: boolean } };
    }>(ok);
    expect(body.data.repository.reviewEnabled).toBe(false);

    const back = await owner.api(path, {
      method: "PATCH",
      body: { reviewEnabled: true },
    });
    expect(back.status).toBe(200);
  });
});
