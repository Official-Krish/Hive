import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { prisma } from "@hive/db";
import { makeClient, startServer, stopServer, uniqueEmail } from "./helpers";
import type { TestClient } from "./helpers";
import { ReviewService } from "../src/modules/github/review.service";
import { aiEnabled } from "../src/modules/ai/ai-client";
import {
  redactSecrets,
  renderComment,
  scanSecrets,
} from "../src/modules/github/review-scan";

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

describe("reviewer scans (pure)", () => {
  const diff = `diff --git a/.env b/.env
new file mode 100644
+++ b/.env
@@ -0,0 +1,3 @@
+AWS_KEY=AKIAIOSFODNN7EXAMPLE
+PASSWORD="hunter2hunter"
+OK=1
diff --git a/src/app.ts b/src/app.ts
+++ b/src/app.ts
@@ -1,2 +1,3 @@
 context
+const x = 1;
-old`;

  test("finds leaked secrets with file + line", () => {
    const findings = scanSecrets(diff);
    expect(findings.length).toBe(2);
    expect(findings[0]).toMatchObject({
      severity: "critical",
      file: ".env",
      line: 1,
    });
    expect(findings[1]!.file).toBe(".env");
  });

  test("redacts before the model ever sees it", () => {
    const redacted = redactSecrets(diff);
    expect(redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(redacted).not.toContain("hunter2hunter");
    expect(redacted).toContain("***REDACTED***");
    expect(redacted).toContain("const x = 1;");
  });

  test("renders a findings comment and a clean comment", () => {
    const withFindings = renderComment(
      7,
      [
        {
          severity: "major",
          file: "src/app.ts",
          line: 2,
          title: "No test",
          detail: "Add one.",
        },
      ],
      10,
    );
    expect(withFindings).toContain("## Reviewer pass on #7");
    expect(withFindings).toContain("**major** `src/app.ts:2`");
    expect(renderComment(7, [], 3)).toContain("Clean");
  });
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
