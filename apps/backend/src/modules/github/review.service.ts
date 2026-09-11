import { prisma, ReviewStatus } from "@hive/db";
import type { RealtimeEvent } from "@hive/types";
import { aiEnabled } from "../ai/ai-client";
import { realtimeBus } from "../realtime/realtime.bus";
import { queue } from "../../lib/queue";

/**
 * PR reviewer teammate — backend half (trigger). The pull_request webhook
 * lands here: per-PR lock, repo toggle + AI availability gates, Review row
 * upsert, `review.started` publish (this process owns the WS publisher),
 * then `review.request` onto the queue. The worker owns execution
 * (diff → scans → model → comment → spend) and completion surfaces back
 * through the review-comment webhook echo.
 */
export class ReviewService {
  /** Per-PR mutex: a synchronize during an in-flight trigger supersedes it. */
  private readonly locks = new Map<string, Promise<void>>();

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      key,
      prev.then(() => current),
    );
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(key) === current) this.locks.delete(key);
    }
  }

  /**
   * Called from the pull_request webhook (backend process — can publish).
   * Creates/refreshes the Review row, announces start, enqueues the job.
   */
  async requestReview(input: {
    workspaceId: string;
    repositoryId: string;
    prNumber: number;
    sha: string;
    title: string;
  }): Promise<void> {
    const lockKey = `${input.repositoryId}:${input.prNumber}`;
    await this.withLock(lockKey, async () => {
      const repo = await prisma.repository.findUnique({
        where: { id: input.repositoryId },
        select: { reviewEnabled: true },
      });
      if (!repo?.reviewEnabled) return;
      if (!aiEnabled()) return;
      const existing = await prisma.review.findUnique({
        where: {
          repositoryId_prNumber_sha: {
            repositoryId: input.repositoryId,
            prNumber: input.prNumber,
            sha: input.sha,
          },
        },
        select: { id: true, status: true },
      });
      if (
        existing &&
        (existing.status === ReviewStatus.DONE ||
          existing.status === ReviewStatus.QUEUED ||
          existing.status === ReviewStatus.RUNNING)
      ) {
        return;
      }
      const review = await prisma.review.upsert({
        where: {
          repositoryId_prNumber_sha: {
            repositoryId: input.repositoryId,
            prNumber: input.prNumber,
            sha: input.sha,
          },
        },
        create: {
          workspaceId: input.workspaceId,
          repositoryId: input.repositoryId,
          prNumber: input.prNumber,
          sha: input.sha,
          status: ReviewStatus.QUEUED,
        },
        update: { status: ReviewStatus.QUEUED, error: null },
      });
      const event: RealtimeEvent = {
        type: "review.started",
        workspaceId: input.workspaceId,
        repositoryId: input.repositoryId,
        prNumber: input.prNumber,
        title: input.title,
        timestamp: Date.now(),
      };
      realtimeBus.publish(input.workspaceId, event);
      await queue.enqueue("review.request", { reviewId: review.id });
    });
  }

  /** Digest inputs for the throughput tab: reviews, findings, spend. */
  async summary(
    workspaceId: string,
    from?: Date,
    to?: Date,
  ): Promise<{
    reviewed: number;
    findings: number;
    costCents: number | null;
  }> {
    const lte = to ?? new Date();
    const gte = from ?? new Date(lte.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rows = await prisma.review.findMany({
      where: {
        workspaceId,
        status: ReviewStatus.DONE,
        updatedAt: { gte, lte },
      },
      select: { findings: true, costCents: true },
    });
    let findings = 0;
    let costCents: number | null = null;
    for (const r of rows) {
      if (Array.isArray(r.findings)) findings += r.findings.length;
      if (r.costCents !== null) costCents = (costCents ?? 0) + r.costCents;
    }
    return { reviewed: rows.length, findings, costCents };
  }
}
