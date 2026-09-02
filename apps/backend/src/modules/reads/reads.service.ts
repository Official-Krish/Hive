import {
  prisma,
  AgentStatus,
  EventType,
  TestStatus,
  type ActivityStatus,
  type ActivityType,
  type AgentType,
  type AlertSeverity,
  type AlertStatus,
  type MetricPeriod,
  type OutcomeStatus,
  type PRStatus,
  type Prisma,
  type TaskPriority,
  type TaskStatus,
} from "@hive/db";
import type {
  ActivityDetail,
  ActivityFilter,
  ActivitySummary,
  AlertFilter,
  AlertSummary,
  DeveloperStats,
  MapRead,
  MapOverlay,
  MetricFilter,
  MetricSummary,
  ModelRead,
  Paginated,
  PrFilter,
  PullRequestSummary,
  RepositoryDetail,
  RepositorySummary,
  SessionDetail,
  SessionFilter,
  SessionSummary,
  TaskFilter,
  TaskSummary,
  TestRunFilter,
  TestRunSummary,
  PrivacySetting,
} from "@hive/types";
import { DEFAULT_PRIVACY_SETTING } from "@hive/types";
import { NotFoundError } from "../../core/errors";
import { PrivacyGate } from "../privacy/privacy-gate";
import { RealtimeService } from "../realtime/realtime.service";

function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): Paginated<T> {
  return { items, page, pageSize, total, hasMore: page * pageSize < total };
}

const lower = (v: string): string => v.toLowerCase();

export class ReadsService {
  private readonly realtime = new RealtimeService();

  async getMap(workspaceId: string): Promise<MapRead> {
    const map = await prisma.workspaceMap.upsert({
      where: { workspaceId },
      create: { workspaceId, name: "Default", version: 1 },
      update: {},
    });
    const members = await this.realtime.getSnapshot(workspaceId, map.id);
    const privacy = await this.privacyOf(workspaceId);
    return PrivacyGate.map(
      { mapId: map.id, name: map.name, version: map.version, members },
      privacy,
    );
  }

  async listActivities(
    workspaceId: string,
    filter: ActivityFilter,
  ): Promise<Paginated<ActivitySummary>> {
    const where: Prisma.ActivityWhereInput = { workspaceId };
    if (filter.status) {
      where.status = filter.status.toUpperCase() as ActivityStatus;
    }
    if (filter.type) where.type = filter.type.toUpperCase() as ActivityType;
    if (filter.developerId) where.developerId = filter.developerId;

    const [total, activities] = await Promise.all([
      prisma.activity.count({ where }),
      prisma.activity.findMany({
        where,
        include: {
          developer: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          repository: { select: { id: true, name: true } },
        },
        orderBy: { startedAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    const privacy = await this.privacyOf(workspaceId);
    return paginate(
      activities.map((a) =>
        PrivacyGate.activitySummary(this.toActivitySummary(a), privacy),
      ),
      filter.page,
      filter.pageSize,
      total,
    );
  }

  async getActivity(
    workspaceId: string,
    activityId: string,
  ): Promise<ActivityDetail> {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        developer: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        repository: { select: { id: true, name: true } },
        events: { orderBy: { sequence: "asc" } },
        agentSessions: {
          include: { agent: { select: { name: true } } },
          orderBy: { startedAt: "desc" },
        },
        testRuns: { orderBy: { startedAt: "desc" } },
        commits: {
          select: { sha: true, message: true, authoredAt: true },
          orderBy: { authoredAt: "desc" },
          take: 20,
        },
        pullRequests: {
          select: { number: true, title: true, status: true },
          orderBy: { updatedAt: "desc" },
          take: 20,
        },
        tokenUsage: { include: { model: { select: { name: true } } } },
      },
    });
    if (!activity || activity.workspaceId !== workspaceId) {
      throw new NotFoundError("Activity not found");
    }

    const detail: ActivityDetail = {
      ...this.toActivitySummary(activity),
      events: activity.events.map((e) => ({
        id: e.id,
        type: lower(e.type),
        sequence: e.sequence,
        payload: e.payload,
        occurredAt: e.occurredAt.toISOString(),
      })),
      sessions: activity.agentSessions.map((s) => ({
        id: s.id,
        agentName: s.agent.name,
        title: s.title,
        status: lower(s.status),
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
      })),
      testRuns: activity.testRuns.map((t) => ({
        id: t.id,
        status: lower(t.status),
        command: t.command,
        totalTests: t.totalTests,
        passedTests: t.passedTests,
        failedTests: t.failedTests,
        startedAt: t.startedAt.toISOString(),
        endedAt: t.endedAt?.toISOString() ?? null,
      })),
      commits: activity.commits.map((c) => ({
        sha: c.sha,
        message: c.message,
        authoredAt: c.authoredAt.toISOString(),
      })),
      pullRequests: activity.pullRequests.map((p) => ({
        number: p.number,
        title: p.title,
        status: lower(p.status),
      })),
      tokenUsage: activity.tokenUsage
        ? {
            id: activity.tokenUsage.id,
            modelName: activity.tokenUsage.model?.name ?? null,
            inputTokens: activity.tokenUsage.inputTokens,
            outputTokens: activity.tokenUsage.outputTokens,
            cachedInputTokens: activity.tokenUsage.cachedInputTokens,
            costCents: activity.tokenUsage.costCents,
            measuredAt: activity.tokenUsage.measuredAt.toISOString(),
          }
        : null,
    };

    const privacy = await this.privacyOf(workspaceId);
    return PrivacyGate.activityDetail(detail, privacy);
  }

  async listSessions(
    workspaceId: string,
    filter: SessionFilter,
  ): Promise<Paginated<SessionSummary>> {
    const where: Prisma.AgentSessionWhereInput = { workspaceId };
    if (filter.status) {
      where.status = filter.status.toUpperCase() as AgentStatus;
    }
    if (filter.agentId) where.agentId = filter.agentId;

    const [total, sessions] = await Promise.all([
      prisma.agentSession.count({ where }),
      prisma.agentSession.findMany({
        where,
        include: {
          agent: { select: { id: true, name: true, type: true, model: true } },
          developer: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          tokenUsages: {
            select: { inputTokens: true, outputTokens: true, costCents: true },
          },
        },
        orderBy: { startedAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    const privacy = await this.privacyOf(workspaceId);
    return paginate(
      sessions.map((s) =>
        PrivacyGate.sessionSummary(this.toSessionSummary(s), privacy),
      ),
      filter.page,
      filter.pageSize,
      total,
    );
  }

  async getSession(
    workspaceId: string,
    sessionId: string,
  ): Promise<SessionDetail> {
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      include: {
        agent: { select: { id: true, name: true, type: true, model: true } },
        developer: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        events: { orderBy: { sequence: "asc" } },
        tokenUsages: { include: { model: { select: { name: true } } } },
      },
    });
    if (!session || session.workspaceId !== workspaceId) {
      throw new NotFoundError("Agent session not found");
    }

    const detail: SessionDetail = {
      ...this.toSessionSummary(session),
      events: session.events.map((e) => ({
        id: e.id,
        type: lower(e.type),
        sequence: e.sequence,
        payload: e.payload,
        occurredAt: e.occurredAt.toISOString(),
      })),
      tokenUsage: session.tokenUsages.map((t) => ({
        id: t.id,
        modelName: t.model?.name ?? null,
        inputTokens: t.inputTokens,
        outputTokens: t.outputTokens,
        cachedInputTokens: t.cachedInputTokens,
        costCents: t.costCents,
        measuredAt: t.measuredAt.toISOString(),
      })),
    };

    const privacy = await this.privacyOf(workspaceId);
    return PrivacyGate.sessionDetail(detail, privacy);
  }

  async listRepositories(workspaceId: string): Promise<RepositorySummary[]> {
    const repos = await prisma.repository.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: {
            branches: true,
            pullRequests: { where: { status: "OPEN" } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return repos.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      provider: lower(r.provider),
      defaultBranch: r.defaultBranch,
      branchCount: r._count.branches,
      openPrCount: r._count.pullRequests,
      lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getRepository(
    workspaceId: string,
    repositoryId: string,
  ): Promise<RepositoryDetail> {
    const repo = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        branches: { orderBy: { name: "asc" } },
        commits: { orderBy: { authoredAt: "desc" }, take: 20 },
        pullRequests: {
          where: { status: "OPEN" },
          include: { author: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
        },
        _count: {
          select: {
            branches: true,
            pullRequests: { where: { status: "OPEN" } },
          },
        },
      },
    });
    if (!repo || repo.workspaceId !== workspaceId) {
      throw new NotFoundError("Repository not found");
    }

    const detail: RepositoryDetail = {
      id: repo.id,
      name: repo.name,
      url: repo.url,
      provider: lower(repo.provider),
      defaultBranch: repo.defaultBranch,
      branchCount: repo._count.branches,
      openPrCount: repo._count.pullRequests,
      lastSyncedAt: repo.lastSyncedAt?.toISOString() ?? null,
      createdAt: repo.createdAt.toISOString(),
      branches: repo.branches.map((b) => ({
        id: b.id,
        name: b.name,
        lastCommitSha: b.lastCommitSha,
      })),
      commits: repo.commits.map((c) => ({
        sha: c.sha,
        message: c.message,
        authoredAt: c.authoredAt.toISOString(),
        insertions: c.insertions,
        deletions: c.deletions,
      })),
      pullRequests: repo.pullRequests.map((p) => ({
        number: p.number,
        title: p.title,
        status: lower(p.status),
        authorName: p.author?.name ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    };

    const privacy = await this.privacyOf(workspaceId);
    return PrivacyGate.repositoryDetail(detail, privacy);
  }

  async listPullRequests(
    workspaceId: string,
    filter: PrFilter,
  ): Promise<Paginated<PullRequestSummary>> {
    const where: Prisma.PullRequestWhereInput = {
      repository: { workspaceId },
    };
    if (filter.status) where.status = filter.status.toUpperCase() as PRStatus;

    const [total, prs] = await Promise.all([
      prisma.pullRequest.count({ where }),
      prisma.pullRequest.findMany({
        where,
        include: {
          repository: { select: { id: true, name: true } },
          author: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    const privacy = await this.privacyOf(workspaceId);
    if (!privacy.allowGitMetadata) {
      return paginate([], filter.page, filter.pageSize, total);
    }
    return paginate(
      prs.map((p) => ({
        id: p.id,
        repository: p.repository,
        number: p.number,
        title: p.title,
        status: lower(p.status),
        url: p.url,
        authorName: p.author?.name ?? null,
        additions: p.additions,
        deletions: p.deletions,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        mergedAt: p.mergedAt?.toISOString() ?? null,
        closedAt: p.closedAt?.toISOString() ?? null,
      })),
      filter.page,
      filter.pageSize,
      total,
    );
  }

  async listMetrics(
    workspaceId: string,
    filter: MetricFilter,
  ): Promise<MetricSummary[]> {
    const where: Prisma.EfficiencyMetricWhereInput = { workspaceId };
    if (filter.period)
      where.period = filter.period.toUpperCase() as MetricPeriod;
    if (filter.periodStart || filter.periodEnd) {
      where.AND = [
        ...(filter.periodStart
          ? [{ periodStart: { gte: filter.periodStart } }]
          : []),
        ...(filter.periodEnd
          ? [{ periodStart: { lte: filter.periodEnd } }]
          : []),
      ];
    }

    const metrics = await prisma.efficiencyMetric.findMany({
      where,
      orderBy: { periodStart: "desc" },
    });
    const privacy = await this.privacyOf(workspaceId);
    return metrics.map((m) =>
      PrivacyGate.metric(
        {
          id: m.id,
          period: lower(m.period),
          periodStart: m.periodStart.toISOString(),
          tokensPerTask: m.tokensPerTask?.toString() ?? null,
          costPerPrCents: m.costPerPrCents,
          agentSuccessRate: m.agentSuccessRate?.toString() ?? null,
          retryRate: m.retryRate?.toString() ?? null,
          tasksCompleted: m.tasksCompleted,
          prsMerged: m.prsMerged,
          agentsTotal: m.agentsTotal,
          tokensTotal: m.tokensTotal,
          costTotalCents: m.costTotalCents,
          computedAt: m.computedAt.toISOString(),
        },
        privacy,
      ),
    );
  }

  async listAlerts(
    workspaceId: string,
    filter: AlertFilter,
  ): Promise<Paginated<AlertSummary>> {
    const where: Prisma.AlertWhereInput = { workspaceId };
    if (filter.status)
      where.status = filter.status.toUpperCase() as AlertStatus;
    if (filter.severity) {
      where.severity = filter.severity.toUpperCase() as AlertSeverity;
    }

    const [total, alerts] = await Promise.all([
      prisma.alert.count({ where }),
      prisma.alert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return paginate(
      alerts.map((a) => ({
        id: a.id,
        severity: lower(a.severity),
        type: a.type,
        message: a.message,
        status: lower(a.status),
        developerId: a.developerId,
        agentSessionId: a.agentSessionId,
        createdAt: a.createdAt.toISOString(),
        resolvedAt: a.resolvedAt?.toISOString() ?? null,
      })),
      filter.page,
      filter.pageSize,
      total,
    );
  }

  async resolveAlert(
    workspaceId: string,
    alertId: string,
    resolvedById: string,
  ): Promise<void> {
    const alert = await prisma.alert.findUnique({ where: { id: alertId } });
    if (!alert || alert.workspaceId !== workspaceId) {
      throw new NotFoundError("Alert not found");
    }
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedById,
      },
    });
  }

  async listTasks(
    workspaceId: string,
    filter: TaskFilter,
  ): Promise<Paginated<TaskSummary>> {
    const where: Prisma.TaskWhereInput = { workspaceId };
    if (filter.status) where.status = filter.status.toUpperCase() as TaskStatus;
    if (filter.priority) {
      where.priority = filter.priority.toUpperCase() as TaskPriority;
    }
    if (filter.developerId) where.developerId = filter.developerId;

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: {
          developer: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          activity: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return paginate(
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: lower(t.status),
        priority: lower(t.priority),
        developer: t.developer,
        activity: t.activity,
        startedAt: t.startedAt?.toISOString() ?? null,
        completedAt: t.completedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
      })),
      filter.page,
      filter.pageSize,
      total,
    );
  }

  async listModels(): Promise<ModelRead[]> {
    const models = await prisma.model.findMany({
      orderBy: [{ provider: "asc" }, { name: "asc" }],
    });
    return models.map((m) => ({
      id: m.id,
      provider: m.provider,
      name: m.name,
      inputPricePerMillion: m.inputPricePerMillion?.toString() ?? null,
      outputPricePerMillion: m.outputPricePerMillion?.toString() ?? null,
      contextWindow: m.contextWindow,
    }));
  }

  async listTestRuns(
    workspaceId: string,
    filter: TestRunFilter,
  ): Promise<Paginated<TestRunSummary>> {
    const where: Prisma.TestRunWhereInput = {
      OR: [{ repository: { workspaceId } }, { activity: { workspaceId } }],
    };
    if (filter.status) where.status = filter.status.toUpperCase() as TestStatus;

    const [total, runs] = await Promise.all([
      prisma.testRun.count({ where }),
      prisma.testRun.findMany({
        where,
        include: {
          developer: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          activity: { select: { id: true, title: true } },
          repository: { select: { id: true, name: true } },
        },
        orderBy: { startedAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return paginate(
      runs.map((r) => ({
        id: r.id,
        status: lower(r.status),
        command: r.command,
        durationMs: r.durationMs,
        totalTests: r.totalTests,
        passedTests: r.passedTests,
        failedTests: r.failedTests,
        skippedTests: r.skippedTests,
        developer: r.developer,
        activity: r.activity,
        repository: r.repository,
        branch: r.branch,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt?.toISOString() ?? null,
      })),
      filter.page,
      filter.pageSize,
      total,
    );
  }

  async getDeveloperStats(
    workspaceId: string,
    developerId: string,
  ): Promise<DeveloperStats> {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: developerId } },
    });
    if (!membership) throw new NotFoundError("Developer not found");

    const developer = await prisma.user.findUnique({
      where: { id: developerId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    if (!developer) throw new NotFoundError("Developer not found");

    const [tokens, sessionCount, activityCount, tasksCompleted, prsMerged] =
      await Promise.all([
        prisma.tokenUsage.aggregate({
          where: { session: { developerId, workspaceId } },
          _sum: { inputTokens: true, outputTokens: true, costCents: true },
        }),
        prisma.agentSession.count({
          where: { developerId, workspaceId },
        }),
        prisma.activity.count({
          where: { developerId, workspaceId },
        }),
        prisma.task.count({
          where: { developerId, workspaceId, status: "COMPLETED" },
        }),
        prisma.pullRequest.count({
          where: {
            authorId: developerId,
            status: "MERGED",
            repository: { workspaceId },
          },
        }),
      ]);

    const privacy = await this.privacyOf(workspaceId);
    return PrivacyGate.developerStats(
      {
        developer,
        inputTokens: tokens._sum.inputTokens ?? 0,
        outputTokens: tokens._sum.outputTokens ?? 0,
        costCents: tokens._sum.costCents ?? null,
        sessionCount,
        activityCount,
        tasksCompleted,
        prsMerged,
      },
      privacy,
    );
  }

  async getMapOverlay(
    workspaceId: string,
    developerId: string,
  ): Promise<MapOverlay> {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: developerId } },
    });
    if (!membership) throw new NotFoundError("Developer not found");

    const developer = await prisma.user.findUnique({
      where: { id: developerId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });
    if (!developer) throw new NotFoundError("Developer not found");
    const presenceInfo = await prisma.presence.findFirst({
      where: { userId: developerId, workspaceId },
      select: { status: true, customLabel: true },
    });

    const activeSession = await prisma.agentSession.findFirst({
      where: {
        developerId,
        workspaceId,
        status: {
          in: [
            AgentStatus.RUNNING,
            AgentStatus.BLOCKED,
            AgentStatus.WAITING_APPROVAL,
          ],
        },
      },
      include: {
        agent: { select: { id: true, name: true, type: true, model: true } },
        issue: { select: { id: true, number: true, title: true, state: true } },
        repository: {
          select: { githubFullName: true, name: true },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    const session =
      activeSession ??
      (await prisma.agentSession.findFirst({
        where: { developerId, workspaceId },
        include: {
          agent: { select: { id: true, name: true, type: true, model: true } },
          issue: {
            select: { id: true, number: true, title: true, state: true },
          },
          repository: {
            select: { githubFullName: true, name: true },
          },
        },
        orderBy: { startedAt: "desc" },
      }));

    const tokens = await prisma.tokenUsage.aggregate({
      where: { session: { developerId, workspaceId } },
      _sum: { inputTokens: true, outputTokens: true, costCents: true },
    });

    // ── cockpit stats (privacy applied below) ────────────────────────────
    const privacy = await this.privacyOf(workspaceId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [sessionsTodayRows, testsToday, todayCost, mixRows] =
      await Promise.all([
        prisma.agentSession.findMany({
          where: { developerId, workspaceId, startedAt: { gte: startOfDay } },
          select: { startedAt: true, endedAt: true },
        }),
        prisma.testRun.groupBy({
          by: ["status"],
          where: { developerId, endedAt: { gte: startOfDay } },
          _count: true,
        }),
        prisma.tokenUsage.aggregate({
          where: {
            session: { developerId, workspaceId },
            measuredAt: { gte: startOfDay },
          },
          _sum: { costCents: true },
        }),
        prisma.tokenUsage.groupBy({
          by: ["modelId"],
          where: { session: { developerId, workspaceId } },
          _sum: { inputTokens: true, outputTokens: true },
        }),
      ]);

    const nowMs = Date.now();
    const activeMinutesToday = Math.round(
      sessionsTodayRows.reduce((acc, s) => {
        const end = s.endedAt?.getTime() ?? nowMs;
        return acc + Math.max(0, end - s.startedAt.getTime());
      }, 0) / 60_000,
    );

    let testsPassedToday = 0;
    let testsFailedToday = 0;
    for (const t of testsToday) {
      if (t.status === TestStatus.PASSED)
        testsPassedToday += t._count as number;
      if (t.status === TestStatus.FAILED)
        testsFailedToday += t._count as number;
    }

    // Model mix — top models by total tokens.
    const modelIds = mixRows
      .map((m) => m.modelId)
      .filter((id): id is string => !!id);
    const modelNames = modelIds.length
      ? await prisma.model.findMany({
          where: { id: { in: modelIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(modelNames.map((m) => [m.id, m.name]));
    const totalMixTokens = mixRows.reduce(
      (acc, m) => acc + (m._sum.inputTokens ?? 0) + (m._sum.outputTokens ?? 0),
      0,
    );
    const modelMix = mixRows
      .map((m) => ({
        model: m.modelId ? (nameById.get(m.modelId) ?? "unknown") : "unknown",
        total: (m._sum.inputTokens ?? 0) + (m._sum.outputTokens ?? 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
      .map(({ model, total }) => ({
        model,
        share: totalMixTokens > 0 ? total / totalMixTokens : 0,
      }));

    // Live feed — last terminal/file events on their active session.
    const runningSession =
      session && session.status === AgentStatus.RUNNING ? session : null;
    let recentEvents: Array<{ label: string; at: string }> | null = null;
    if (runningSession) {
      const events = await prisma.agentEvent.findMany({
        where: {
          agentSessionId: runningSession.id,
          type: { in: [EventType.TERMINAL_COMMAND, EventType.FILE_MODIFIED] },
        },
        orderBy: { sequence: "desc" },
        take: 3,
        select: { type: true, payload: true, occurredAt: true },
      });
      recentEvents = events.map((e) => {
        const payload = (e.payload ?? {}) as {
          command?: string;
          path?: string;
        };
        let label = "activity";
        if (e.type === EventType.TERMINAL_COMMAND) {
          label = privacy.allowExactCommands
            ? `$ ${String(payload.command ?? "").slice(0, 48)}`
            : "ran a command";
        } else if (e.type === EventType.FILE_MODIFIED) {
          const p = String(payload.path ?? "");
          label = privacy.allowFilePaths
            ? `edited ${p.split("/").pop() || p}`
            : "edited a file";
        }
        return { label, at: e.occurredAt.toISOString() };
      });
    }

    const overlay: MapOverlay = {
      developer: {
        ...developer,
        presences: undefined,
        status: presenceInfo ? presenceInfo.status.toLowerCase() : "offline",
        label: presenceInfo?.customLabel ?? null,
      } as MapOverlay["developer"],
      project: session?.repository
        ? (session.repository.githubFullName ?? session.repository.name)
        : null,
      currentSession: session
        ? {
            id: session.id,
            agent: {
              id: session.agent.id,
              name: session.agent.name,
              type: session.agent.type.toLowerCase(),
              model: session.agent.model,
            },
            title: session.title,
            status: session.status.toLowerCase(),
            startedAt: session.startedAt.toISOString(),
            branch: session.branch,
          }
        : null,
      issue: session?.issue
        ? {
            id: session.issue.id,
            number: session.issue.number,
            title: session.issue.title,
            state: session.issue.state,
          }
        : null,
      inputTokens: tokens._sum.inputTokens ?? 0,
      outputTokens: tokens._sum.outputTokens ?? 0,
      costCents: tokens._sum.costCents ?? null,
      stats: {
        sessionsToday: sessionsTodayRows.length,
        activeMinutesToday,
        costCentsToday: todayCost._sum.costCents ?? null,
        testsPassedToday,
        testsFailedToday,
        modelMix: modelMix.length > 0 ? modelMix : null,
        recentEvents,
      },
    };

    return PrivacyGate.mapOverlay(overlay, privacy);
  }

  private async privacyOf(workspaceId: string): Promise<PrivacySetting> {
    const row = await prisma.privacySetting.findUnique({
      where: { workspaceId },
    });
    if (!row) return DEFAULT_PRIVACY_SETTING;
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

  private toActivitySummary(a: {
    id: string;
    type: ActivityType;
    title: string;
    summary: string | null;
    status: ActivityStatus;
    outcomeStatus: OutcomeStatus | null;
    filesChanged: number | null;
    linesChanged: number | null;
    startedAt: Date;
    endedAt: Date | null;
    developer: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
    repository: { id: string; name: string } | null;
  }): ActivitySummary {
    return {
      id: a.id,
      type: lower(a.type),
      title: a.title,
      summary: a.summary,
      status: lower(a.status),
      outcomeStatus: a.outcomeStatus ? lower(a.outcomeStatus) : null,
      filesChanged: a.filesChanged,
      linesChanged: a.linesChanged,
      startedAt: a.startedAt.toISOString(),
      endedAt: a.endedAt?.toISOString() ?? null,
      developer: a.developer,
      repository: a.repository,
    };
  }

  private toSessionSummary(s: {
    id: string;
    title: string | null;
    status: AgentStatus;
    startedAt: Date;
    endedAt: Date | null;
    summary: string | null;
    agent: {
      id: string;
      name: string;
      type: AgentType;
      model: string | null;
    };
    developer: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
    tokenUsages: Array<{
      inputTokens: number;
      outputTokens: number;
      costCents: number | null;
    }>;
  }): SessionSummary {
    const inputTokens = s.tokenUsages.reduce(
      (sum, t) => sum + t.inputTokens,
      0,
    );
    const outputTokens = s.tokenUsages.reduce(
      (sum, t) => sum + t.outputTokens,
      0,
    );
    const costCents = s.tokenUsages.reduce<number | null>((sum, t) => {
      if (t.costCents === null) return sum;
      return (sum ?? 0) + t.costCents;
    }, null);
    return {
      id: s.id,
      agent: {
        id: s.agent.id,
        name: s.agent.name,
        type: lower(s.agent.type),
        model: s.agent.model,
      },
      developer: s.developer,
      title: s.title,
      status: lower(s.status),
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
      summary: s.summary,
      inputTokens,
      outputTokens,
      costCents,
    };
  }
}
