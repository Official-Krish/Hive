import { prisma } from "@hive/db";
import { DEFAULT_PRIVACY_SETTING } from "@hive/types";
import type {
  PRCostItem,
  PRCostResponse,
  PRCostStatus,
  PRCostSummary,
} from "@hive/types";

interface SessionSpend {
  sessionId: string;
  repositoryId: string | null;
  branch: string | null;
  developerId: string;
  startedAt: Date;
  endedAt: Date | null;
  costCents: number;
}

/**
 * Tokens → shipped: attributes in-range agent token spend to pull requests.
 *
 * A session links DIRECTLY when its repo + branch match the PR's repo +
 * head branch. Otherwise it links by INFERENCE (same repo + author +
 * overlapping windows) to at most one PR — the one created closest to the
 * session start — so totals never double-count. Everything else lands in
 * `unattributedCostCents`.
 */
export class CostAttributionService {
  async getPRCosts(
    workspaceId: string,
    from?: Date,
    to?: Date,
    page = 1,
    pageSize = 20,
  ): Promise<PRCostResponse> {
    const lte = to ?? new Date();
    const gte = from ?? new Date(lte.getTime() - 30 * 24 * 60 * 60 * 1000);
    const privacyRow = await prisma.privacySetting.findUnique({
      where: { workspaceId },
    });
    const masked = !(
      privacyRow?.allowTokenUsage ?? DEFAULT_PRIVACY_SETTING.allowTokenUsage
    );

    const prs = await prisma.pullRequest.findMany({
      where: {
        repository: { workspaceId },
        updatedAt: { gte, lte },
      },
      include: {
        repository: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const usages = await prisma.tokenUsage.findMany({
      where: {
        session: { workspaceId },
        measuredAt: { gte, lte },
        costCents: { not: null },
      },
      select: {
        costCents: true,
        session: {
          select: {
            id: true,
            repositoryId: true,
            branch: true,
            developerId: true,
            startedAt: true,
            endedAt: true,
          },
        },
      },
    });

    const bySession = new Map<string, SessionSpend>();
    for (const u of usages) {
      if (!u.session || u.costCents == null) continue;
      const s = u.session;
      const prev = bySession.get(s.id);
      if (prev) {
        prev.costCents += u.costCents;
      } else {
        bySession.set(s.id, {
          sessionId: s.id,
          repositoryId: s.repositoryId,
          branch: s.branch,
          developerId: s.developerId,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          costCents: u.costCents,
        });
      }
    }

    // Per-PR accumulators, keyed by PR id.
    const acc = new Map<
      string,
      {
        directSessions: Set<string>;
        inferredSessions: Set<string>;
        direct: number;
        inferred: number;
      }
    >();
    for (const pr of prs) {
      acc.set(pr.id, {
        directSessions: new Set(),
        inferredSessions: new Set(),
        direct: 0,
        inferred: 0,
      });
    }
    let unattributedCostCents = 0;

    for (const s of bySession.values()) {
      if (!s.repositoryId) {
        unattributedCostCents += s.costCents;
        continue;
      }
      // Direct: repo + branch match the PR's head branch. A branch rarely
      // feeds two PRs; the most recently updated wins so spend isn't doubled.
      const direct = prs
        .filter(
          (pr) =>
            pr.repositoryId === s.repositoryId &&
            pr.headBranch != null &&
            s.branch != null &&
            pr.headBranch === s.branch,
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
      if (direct) {
        const a = acc.get(direct.id);
        if (a) {
          a.directSessions.add(s.sessionId);
          a.direct += s.costCents;
        }
        continue;
      }
      // Inferred: same repo + author, session window overlaps the PR's life.
      const sessionEnd = s.endedAt ?? lte;
      const inferred = prs
        .filter((pr) => {
          if (pr.repositoryId !== s.repositoryId) return false;
          if (pr.authorId == null || pr.authorId !== s.developerId) {
            return false;
          }
          const prEnd = pr.mergedAt ?? pr.closedAt ?? lte;
          return s.startedAt <= prEnd && sessionEnd >= pr.createdAt;
        })
        .sort((a, b) => {
          const da = Math.abs(a.createdAt.getTime() - s.startedAt.getTime());
          const db = Math.abs(b.createdAt.getTime() - s.startedAt.getTime());
          return da - db || a.number - b.number;
        })[0];
      if (inferred) {
        const a = acc.get(inferred.id);
        if (a) {
          a.inferredSessions.add(s.sessionId);
          a.inferred += s.costCents;
        }
      } else {
        unattributedCostCents += s.costCents;
      }
    }

    const all: PRCostItem[] = prs.map((pr) => {
      const a = acc.get(pr.id) ?? {
        directSessions: new Set<string>(),
        inferredSessions: new Set<string>(),
        direct: 0,
        inferred: 0,
      };
      return {
        repositoryId: pr.repositoryId,
        repositoryName: pr.repository.name,
        number: pr.number,
        title: pr.title,
        status: pr.status as PRCostStatus,
        authorName: pr.author?.name ?? null,
        headBranch: pr.headBranch,
        sessions: a.directSessions.size + a.inferredSessions.size,
        directSessions: a.directSessions.size,
        inferredSessions: a.inferredSessions.size,
        directCostCents: masked ? null : a.direct,
        inferredCostCents: masked ? null : a.inferred,
        totalCostCents: masked ? null : a.direct + a.inferred,
        mergedAt: pr.mergedAt?.toISOString() ?? null,
        updatedAt: pr.updatedAt.toISOString(),
        hiddenByPrivacy: masked,
      };
    });

    // Attribution runs over the full in-range set; only the page ships.
    const total = all.length;
    const items = all.slice((page - 1) * pageSize, page * pageSize);
    return {
      items,
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      summary: this.summarize(all, masked, unattributedCostCents),
    };
  }

  private summarize(
    items: PRCostItem[],
    masked: boolean,
    unattributedCostCents: number,
  ): PRCostSummary {
    const sum = (pick: (i: PRCostItem) => number | null): number | null => {
      if (masked) return null;
      return items.reduce((t, i) => t + (pick(i) ?? 0), 0);
    };
    const merged = items.filter((i) => i.status === "MERGED");
    const abandoned = items.filter((i) => i.status === "CLOSED");
    return {
      prs: items.length,
      sessionsAttributed: items.reduce((t, i) => t + i.sessions, 0),
      directCostCents: sum((i) => i.directCostCents),
      inferredCostCents: sum((i) => i.inferredCostCents),
      totalCostCents: sum((i) => i.totalCostCents),
      mergedCostCents: masked
        ? null
        : merged.reduce((t, i) => t + (i.totalCostCents ?? 0), 0),
      abandonedCostCents: masked
        ? null
        : abandoned.reduce((t, i) => t + (i.totalCostCents ?? 0), 0),
      unattributedCostCents: masked ? null : unattributedCostCents,
      hiddenByPrivacy: masked,
    };
  }
}
