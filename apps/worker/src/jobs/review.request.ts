import { z } from "zod";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import { prisma, AgentStatus, AgentType, ReviewStatus } from "@hive/db";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import {
  extractJson,
  redactSecrets,
  renderComment,
  reviewCostCents,
  REVIEW_MARKER,
  REVIEW_SYSTEM_PROMPT,
  scanSecrets,
  type ReviewFinding,
} from "@hive/review";

export const schema = z.object({
  reviewId: z.string().min(1),
});

/** Reviews above this size get secret-scan only (no model pass). */
const MAX_DIFF_LINES = 400;
/** Max findings per review — noise cap. */
const MAX_FINDINGS = 8;

function appJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID },
    env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n").trim(),
    { algorithm: "RS256" },
  );
}

async function installationToken(installationId: string): Promise<string> {
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${appJwt()}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`installation token failed: ${response.status}`);
  }
  const data = (await response.json()) as { token: string };
  return data.token;
}

async function getPullDiff(
  token: string,
  fullName: string,
  prNumber: number,
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${fullName}/pulls/${prNumber}`,
    {
      headers: {
        Accept: "application/vnd.github.diff",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`pull diff failed: ${response.status}`);
  }
  return response.text();
}

async function postPullComment(
  token: string,
  fullName: string,
  prNumber: number,
  body: string,
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${fullName}/issues/${prNumber}/comments`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) {
    throw new Error(`post comment failed: ${response.status}`);
  }
  const data = (await response.json()) as { id: number };
  return String(data.id);
}

export async function handler(payload: z.infer<typeof schema>): Promise<void> {
  const review = await prisma.review.findUnique({
    where: { id: payload.reviewId },
    include: { repository: true },
  });
  if (!review || review.status === ReviewStatus.DONE) return;
  // Superseded by a newer push?
  const newer = await prisma.review.findFirst({
    where: {
      repositoryId: review.repositoryId,
      prNumber: review.prNumber,
      createdAt: { gt: review.createdAt },
    },
    select: { id: true },
  });
  if (newer) {
    await prisma.review.update({
      where: { id: review.id },
      data: { status: ReviewStatus.SKIPPED, error: "superseded" },
    });
    return;
  }
  await prisma.review.update({
    where: { id: review.id },
    data: { status: ReviewStatus.RUNNING },
  });
  try {
    await execute(review.id);
  } catch (err) {
    await prisma.review.update({
      where: { id: review.id },
      data: {
        status: ReviewStatus.FAILED,
        error: err instanceof Error ? err.message.slice(0, 300) : "failed",
      },
    });
    throw err;
  }
}

async function execute(reviewId: string): Promise<void> {
  const review = await prisma.review.findUniqueOrThrow({
    where: { id: reviewId },
    include: { repository: true },
  });
  if (
    !env.GITHUB_APP_ID ||
    !env.GITHUB_APP_PRIVATE_KEY ||
    !env.AI_API_KEY ||
    !env.AI_MODEL
  ) {
    throw new Error("reviewer not configured (GitHub App or AI key missing)");
  }
  const installation = await prisma.gitHubInstallation.findFirst({
    where: { workspaceId: review.workspaceId },
    select: { installationId: true },
  });
  const fullName = review.repository.githubFullName;
  if (!installation || !fullName) {
    throw new Error("no GitHub installation for this workspace");
  }
  const token = await installationToken(installation.installationId);
  const diff = await getPullDiff(token, fullName, review.prNumber);
  if (!diff.trim()) {
    await finish(reviewId, [], null);
    return;
  }
  // Deterministic pass first: secrets + size guard.
  const secretFindings = scanSecrets(diff);
  const lines = diff.split("\n").length;
  let findings: ReviewFinding[] = secretFindings;
  let usage: { input: number; output: number } | null = null;
  if (lines <= MAX_DIFF_LINES) {
    const client = new OpenAI({
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_BASE_URL,
    });
    const completion = await client.chat.completions.create({
      model: env.AI_MODEL,
      messages: [
        { role: "system", content: REVIEW_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Review this PR diff (PR #${review.prNumber}):\n\n${redactSecrets(diff).slice(0, 24000)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });
    const text = completion.choices[0]?.message?.content ?? "";
    const parsed = extractJson<{ findings?: ReviewFinding[] }>(text);
    if (Array.isArray(parsed?.findings)) {
      findings = [
        ...secretFindings,
        ...parsed!.findings
          .filter(
            (f) =>
              f &&
              typeof f.title === "string" &&
              typeof f.file === "string" &&
              ["critical", "major", "minor"].includes(f.severity),
          )
          .map((f) => ({
            severity: f.severity,
            file: f.file,
            line: typeof f.line === "number" ? f.line : null,
            title: f.title,
            detail: typeof f.detail === "string" ? f.detail : "",
          })),
      ].slice(0, MAX_FINDINGS);
    }
    const u = completion.usage;
    usage = u
      ? { input: u.prompt_tokens ?? 0, output: u.completion_tokens ?? 0 }
      : null;
  }
  const body = renderComment(review.prNumber, findings, lines);
  const commentId = await postPullComment(
    token,
    fullName,
    review.prNumber,
    `${REVIEW_MARKER} ${review.id} -->\n${body}`,
  );
  // Attribute spend: reviewer agent + per-review session under the owner.
  let costCents: number | null = null;
  if (usage) {
    const owner = await prisma.workspaceMember.findFirst({
      where: { workspaceId: review.workspaceId, role: "OWNER" },
      select: { userId: true },
    });
    const anyMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: review.workspaceId },
      select: { userId: true },
    });
    const developerId = owner?.userId ?? anyMember?.userId;
    if (developerId) {
      const agent = await prisma.agent.upsert({
        where: { id: `reviewer-${review.workspaceId}` },
        create: {
          id: `reviewer-${review.workspaceId}`,
          workspaceId: review.workspaceId,
          name: "Reviewer",
          type: AgentType.GENERIC,
          model: env.AI_MODEL,
        },
        update: {},
      });
      const session = await prisma.agentSession.create({
        data: {
          developerId,
          agentId: agent.id,
          workspaceId: review.workspaceId,
          title: `Review PR #${review.prNumber}`,
          status: AgentStatus.COMPLETED,
          endedAt: new Date(),
        },
      });
      const model = await prisma.model.upsert({
        where: {
          provider_name: { provider: "reviewer", name: env.AI_MODEL },
        },
        create: { provider: "reviewer", name: env.AI_MODEL },
        update: {},
      });
      costCents = reviewCostCents(
        model.inputPricePerMillion,
        model.outputPricePerMillion,
        usage.input,
        usage.output,
      );
      await prisma.tokenUsage.create({
        data: {
          sessionId: session.id,
          modelId: model.id,
          inputTokens: usage.input,
          outputTokens: usage.output,
          costCents,
        },
      });
    }
  }
  await finish(reviewId, findings, commentId, costCents);
  logger.info(
    `[review.request] PR #${review.prNumber} done (${findings.length} findings)`,
  );
}

async function finish(
  reviewId: string,
  findings: ReviewFinding[],
  commentId: string | null,
  costCents?: number | null,
): Promise<void> {
  await prisma.review.update({
    where: { id: reviewId },
    data: {
      status: ReviewStatus.DONE,
      findings: findings as unknown as object,
      commentId,
      costCents: costCents ?? null,
    },
  });
}
