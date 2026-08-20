import { prisma, type AgentStatus } from "@hive/db";
import type {
  DeveloperRef,
  IssueDetail,
  IssueFilter,
  IssueSummary,
  Paginated,
  SessionSummary,
} from "@hive/types";
import { NotFoundError } from "../../core/errors";
import { PrivacyGate } from "../privacy/privacy-gate";

const DEFAULT_PRIVACY = {
  allowActivitySummaries: true,
  allowAgentStatus: true,
  allowTokenUsage: true,
  allowGitMetadata: true,
  allowExactCommands: true,
  allowFilePaths: true,
  allowPromptMetadata: true,
};

export class IssuesService {
  async listIssues(
    workspaceId: string,
    filter: IssueFilter,
  ): Promise<Paginated<IssueSummary>> {
    const where = {
      repository: { workspaceId },
      ...(filter.state ? { state: filter.state } : {}),
      ...(filter.repositoryId ? { repositoryId: filter.repositoryId } : {}),
    };

    const [total, issues] = await Promise.all([
      prisma.issue.count({ where }),
      prisma.issue.findMany({
        where,
        include: {
          repository: { select: { id: true, name: true } },
          _count: { select: { sessions: true, branches: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);

    const rollups = await this.rollupForIssues(issues.map((i) => i.id));

    const privacy = await this.privacyOf(workspaceId);
    return {
      items: issues.map((issue) =>
        PrivacyGate.issueSummary(
          {
            id: issue.id,
            repository: issue.repository,
            number: issue.number,
            title: issue.title,
            state: issue.state,
            url: issue.url,
            authorLogin: issue.authorLogin,
            labels: this.labels(issue.labels),
            openedAt: issue.openedAt.toISOString(),
            closedAt: issue.closedAt?.toISOString() ?? null,
            updatedAt: issue.updatedAt.toISOString(),
            sessionCount: issue._count.sessions,
            branchCount: issue._count.branches,
            inputTokens: rollups.get(issue.id)?.inputTokens ?? 0,
            outputTokens: rollups.get(issue.id)?.outputTokens ?? 0,
            costCents: rollups.get(issue.id)?.costCents ?? null,
          },
          privacy,
        ),
      ),
      page: filter.page,
      pageSize: filter.pageSize,
      total,
      hasMore: filter.page * filter.pageSize < total,
    };
  }

  async getIssue(workspaceId: string, issueId: string): Promise<IssueDetail> {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        repository: { select: { id: true, name: true, workspaceId: true } },
        branches: { orderBy: { name: "asc" } },
        commits: { orderBy: { authoredAt: "desc" }, take: 50 },
        sessions: {
          include: {
            agent: {
              select: { id: true, name: true, type: true, model: true },
            },
            developer: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
            tokenUsages: {
              select: {
                inputTokens: true,
                outputTokens: true,
                costCents: true,
              },
            },
          },
          orderBy: { startedAt: "desc" },
        },
      },
    });
    if (!issue || issue.repository.workspaceId !== workspaceId) {
      throw new NotFoundError("Issue not found");
    }

    const { inputTokens, outputTokens, costCents } = this.rollupSessions(
      issue.sessions,
    );
    const sessions: SessionSummary[] = issue.sessions.map((s) =>
      this.toSessionSummary(s),
    );

    const detail: IssueDetail = {
      id: issue.id,
      repository: issue.repository,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      url: issue.url,
      authorLogin: issue.authorLogin,
      labels: this.labels(issue.labels),
      assignees: this.labels(issue.assignees),
      body: issue.body,
      openedAt: issue.openedAt.toISOString(),
      closedAt: issue.closedAt?.toISOString() ?? null,
      updatedAt: issue.updatedAt.toISOString(),
      branchCount: issue.branches.length,
      sessionCount: issue.sessions.length,
      inputTokens,
      outputTokens,
      costCents,
      branches: issue.branches.map((b) => ({
        id: b.id,
        name: b.name,
        lastCommitSha: b.lastCommitSha,
      })),
      commits: issue.commits.map((c) => ({
        sha: c.sha,
        message: c.message,
        authoredAt: c.authoredAt.toISOString(),
        insertions: c.insertions,
        deletions: c.deletions,
      })),
      sessions,
    };

    const privacy = await this.privacyOf(workspaceId);
    return PrivacyGate.issueDetail(detail, privacy);
  }

  private async rollupForIssues(
    issueIds: string[],
  ): Promise<
    Map<
      string,
      { inputTokens: number; outputTokens: number; costCents: number | null }
    >
  > {
    const out = new Map<
      string,
      { inputTokens: number; outputTokens: number; costCents: number | null }
    >();
    if (issueIds.length === 0) return out;

    const usages = await prisma.tokenUsage.findMany({
      where: { session: { issueId: { in: issueIds } } },
      select: {
        sessionId: true,
        inputTokens: true,
        outputTokens: true,
        costCents: true,
      },
    });
    const sessionToIssue = await prisma.agentSession.findMany({
      where: { id: { in: [...new Set(usages.map((u) => u.sessionId ?? ""))] } },
      select: { id: true, issueId: true },
    });
    const map = new Map(sessionToIssue.map((s) => [s.id, s.issueId]));
    for (const u of usages) {
      const issueId = u.sessionId ? map.get(u.sessionId) : null;
      if (!issueId) continue;
      const acc = out.get(issueId) ?? {
        inputTokens: 0,
        outputTokens: 0,
        costCents: null,
      };
      acc.inputTokens += u.inputTokens;
      acc.outputTokens += u.outputTokens;
      if (u.costCents !== null)
        acc.costCents = (acc.costCents ?? 0) + u.costCents;
      out.set(issueId, acc);
    }
    return out;
  }

  private rollupSessions(
    sessions: Array<{
      tokenUsages: Array<{
        inputTokens: number;
        outputTokens: number;
        costCents: number | null;
      }>;
    }>,
  ): { inputTokens: number; outputTokens: number; costCents: number | null } {
    let inputTokens = 0;
    let outputTokens = 0;
    let costCents: number | null = null;
    for (const session of sessions) {
      for (const usage of session.tokenUsages) {
        inputTokens += usage.inputTokens;
        outputTokens += usage.outputTokens;
        if (usage.costCents !== null) {
          costCents = (costCents ?? 0) + usage.costCents;
        }
      }
    }
    return { inputTokens, outputTokens, costCents };
  }

  private toSessionSummary(s: {
    id: string;
    title: string | null;
    status: AgentStatus;
    startedAt: Date;
    endedAt: Date | null;
    summary: string | null;
    agent: { id: string; name: string; type: string; model: string | null };
    developer: DeveloperRef;
    tokenUsages: Array<{
      inputTokens: number;
      outputTokens: number;
      costCents: number | null;
    }>;
  }): SessionSummary {
    const { inputTokens, outputTokens, costCents } = this.rollupSessions([
      { tokenUsages: s.tokenUsages },
    ]);
    return {
      id: s.id,
      agent: {
        id: s.agent.id,
        name: s.agent.name,
        type: s.agent.type.toLowerCase(),
        model: s.agent.model,
      },
      developer: s.developer,
      title: s.title,
      status: s.status.toLowerCase(),
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
      summary: s.summary,
      inputTokens,
      outputTokens,
      costCents,
    };
  }

  private labels(raw: unknown): string[] {
    if (Array.isArray(raw))
      return raw.filter((x): x is string => typeof x === "string");
    return [];
  }

  private async privacyOf(
    workspaceId: string,
  ): Promise<typeof DEFAULT_PRIVACY> {
    const row = await prisma.privacySetting.findUnique({
      where: { workspaceId },
    });
    if (!row) return DEFAULT_PRIVACY;
    return {
      allowActivitySummaries: row.allowActivitySummaries,
      allowAgentStatus: row.allowAgentStatus,
      allowTokenUsage: row.allowTokenUsage,
      allowGitMetadata: row.allowGitMetadata,
      allowExactCommands: row.allowExactCommands,
      allowFilePaths: row.allowFilePaths,
      allowPromptMetadata: row.allowPromptMetadata,
    };
  }
}
