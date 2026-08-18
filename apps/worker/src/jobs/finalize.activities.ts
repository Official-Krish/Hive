import { z } from "zod";
import { prisma } from "@hive/db";
import { logger } from "../lib/logger";

export const schema = z.object({});

export async function handler(): Promise<void> {
  const activities = await prisma.activity.findMany({
    where: { endedAt: { not: null }, status: "IN_PROGRESS" },
    include: {
      agentSessions: { include: { tokenUsages: true } },
      commits: {
        select: { filesChanged: true, insertions: true, deletions: true },
      },
      testRuns: { select: { status: true } },
      tasks: { select: { status: true } },
      pullRequests: { select: { status: true } },
    },
  });

  for (const activity of activities) {
    const usage = activity.agentSessions.flatMap(
      (session) => session.tokenUsages,
    );
    const inputTokens = usage.reduce((sum, u) => sum + u.inputTokens, 0);
    const outputTokens = usage.reduce((sum, u) => sum + u.outputTokens, 0);
    const costCents = usage.reduce((sum, u) => sum + (u.costCents ?? 0), 0);

    const filesChanged = sumNullable(
      activity.commits.map((c) => c.filesChanged),
    );
    const linesChanged = sumNullable(
      activity.commits.map((c) => addNullable(c.insertions, c.deletions)),
    );

    await prisma.tokenUsage.upsert({
      where: { activityId: activity.id },
      create: {
        activityId: activity.id,
        inputTokens,
        outputTokens,
        costCents: costCents > 0 ? costCents : null,
        measuredAt: new Date(),
      },
      update: {
        inputTokens,
        outputTokens,
        costCents: costCents > 0 ? costCents : null,
      },
    });

    await prisma.activity.update({
      where: { id: activity.id },
      data: {
        status: "COMPLETED",
        outcomeStatus: outcomeFor(
          activity.testRuns,
          activity.tasks,
          activity.pullRequests,
        ),
        filesChanged,
        linesChanged,
      },
    });
  }

  logger.info(
    `[finalize.activities] finalized ${activities.length} activities`,
  );
}

function outcomeFor(
  testRuns: { status: string }[],
  tasks: { status: string }[],
  pullRequests: { status: string }[],
): "SUCCESS" | "FAILED" | null {
  if (testRuns.some((t) => t.status === "FAILED")) return "FAILED";
  const hasPassedTests = testRuns.some((t) => t.status === "PASSED");
  const hasMergedPr = pullRequests.some((p) => p.status === "MERGED");
  const hasCompletedTask = tasks.some((t) => t.status === "COMPLETED");
  if (hasMergedPr || hasCompletedTask || hasPassedTests) return "SUCCESS";
  return null;
}

function sumNullable(values: Array<number | null>): number | null {
  let total = 0;
  for (const value of values) total += value ?? 0;
  return total > 0 ? total : null;
}

function addNullable(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  let total = 0;
  total += a ?? 0;
  total += b ?? 0;
  return total > 0 ? total : null;
}
