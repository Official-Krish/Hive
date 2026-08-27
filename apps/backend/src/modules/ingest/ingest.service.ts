import {
  AgentStatus,
  AgentType,
  ActivityStatus,
  ActivityType,
  EventType,
  OutcomeStatus,
  PRStatus,
  RepositoryProvider,
  TestStatus,
  prisma,
  type Prisma,
} from "@hive/db";
import type { IngestBatch, TelemetryEvent } from "@hive/events";
import type { RealtimeEvent } from "@hive/types";
import type { DeviceContext } from "../../core/context";
import { ForbiddenError } from "../../core/errors";
import { queue } from "../../lib/queue";
import { aiEnabled } from "../ai/ai-client";
import { realtimeBus } from "../realtime/realtime.bus";
import { IssueLinksService } from "../issues/issue-links";

const AGENT_TYPE_MAP: Record<
  "claude" | "codex" | "cursor" | "opencode" | "generic",
  AgentType
> = {
  claude: AgentType.CLAUDE,
  codex: AgentType.CODEX,
  cursor: AgentType.CURSOR,
  opencode: AgentType.OPENCODE,
  generic: AgentType.GENERIC,
};

const AGENT_STATUS_MAP: Record<
  "completed" | "error" | "blocked" | "stopped" | "waiting_approval",
  AgentStatus
> = {
  completed: AgentStatus.COMPLETED,
  error: AgentStatus.ERROR,
  blocked: AgentStatus.BLOCKED,
  stopped: AgentStatus.STOPPED,
  waiting_approval: AgentStatus.WAITING_APPROVAL,
};

const ACTIVITY_TYPE_MAP: Record<
  "coding" | "agent" | "review" | "testing" | "debugging" | "research" | "idle",
  ActivityType
> = {
  coding: ActivityType.CODING,
  agent: ActivityType.AGENT,
  review: ActivityType.REVIEW,
  testing: ActivityType.TESTING,
  debugging: ActivityType.DEBUGGING,
  research: ActivityType.RESEARCH,
  idle: ActivityType.IDLE,
};

const ACTIVITY_STATUS_MAP: Record<
  "in_progress" | "completed" | "cancelled" | "blocked",
  ActivityStatus
> = {
  in_progress: ActivityStatus.IN_PROGRESS,
  completed: ActivityStatus.COMPLETED,
  cancelled: ActivityStatus.CANCELLED,
  blocked: ActivityStatus.BLOCKED,
};

const OUTCOME_STATUS_MAP: Record<
  "success" | "failed" | "blocked" | "cancelled",
  OutcomeStatus
> = {
  success: OutcomeStatus.SUCCESS,
  failed: OutcomeStatus.FAILED,
  blocked: OutcomeStatus.BLOCKED,
  cancelled: OutcomeStatus.CANCELLED,
};

const PR_STATUS_MAP: Record<"draft" | "open" | "merged" | "closed", PRStatus> =
  {
    draft: PRStatus.DRAFT,
    open: PRStatus.OPEN,
    merged: PRStatus.MERGED,
    closed: PRStatus.CLOSED,
  };

const TEST_STATUS_MAP: Record<"passed" | "failed" | "skipped", TestStatus> = {
  passed: TestStatus.PASSED,
  failed: TestStatus.FAILED,
  skipped: TestStatus.SKIPPED,
};

export interface IngestResult {
  accepted: boolean;
  eventCount: number;
  failures: number;
}

export class IngestService {
  async process(
    batch: IngestBatch,
    device: DeviceContext,
  ): Promise<IngestResult> {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: batch.workspaceId,
          userId: device.userId,
        },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenError("Not a member of this workspace");
    }

    let failures = 0;
    for (const event of batch.events) {
      try {
        await this.apply(batch.workspaceId, device.userId, event);
      } catch {
        // A single bad event must not drop the rest of the batch. Every row
        // write is idempotent (client-generated ids + upserts), so retries are
        // safe.
        failures++;
      }
    }
    return { accepted: true, eventCount: batch.events.length, failures };
  }

  private async apply(
    workspaceId: string,
    userId: string,
    event: TelemetryEvent,
  ): Promise<void> {
    switch (event.type) {
      case "agent.started":
        await this.handleAgentStarted(workspaceId, userId, event);
        break;
      case "agent.stopped":
        await this.handleAgentStopped(workspaceId, userId, event);
        break;
      case "agent.token_usage":
        await this.handleTokenUsage(workspaceId, event);
        break;
      case "agent.summary":
        await prisma.agentSession.updateMany({
          where: { id: event.sessionId },
          data: { summary: event.summary },
        });
        break;
      case "activity.started":
        await this.handleActivityStarted(workspaceId, userId, event);
        break;
      case "activity.updated":
        await this.handleActivityUpdated(workspaceId, event);
        break;
      case "activity.stopped":
        await this.handleActivityStopped(workspaceId, event);
        break;
      case "git.commit":
        await this.handleGitCommit(workspaceId, event);
        break;
      case "git.pull_request":
        await this.handleGitPullRequest(workspaceId, event);
        break;
      case "git.branch":
        await this.handleGitBranch(workspaceId, event);
        break;
      case "test.started":
        await this.handleTestStarted(workspaceId, userId, event);
        break;
      case "test.finished":
        await this.handleTestFinished(workspaceId, userId, event);
        break;
      case "agent.status":
        await this.handleAgentStatus(workspaceId, userId, event);
        break;
      case "process.started":
      case "process.stopped":
      case "terminal.command":
      case "file.modified":
        await this.attachEnvironmentEvent(workspaceId, userId, event);
        break;
    }
  }

  private async handleAgentStarted(
    workspaceId: string,
    userId: string,
    event: Extract<TelemetryEvent, { type: "agent.started" }>,
  ): Promise<void> {
    const agent = await this.resolveAgent(
      workspaceId,
      event.agent,
      AGENT_TYPE_MAP[event.agent],
    );
    const repositoryId = event.repository
      ? (await this.resolveRepository(workspaceId, event.repository)).id
      : null;

    await prisma.agentSession.upsert({
      where: { id: event.sessionId },
      create: {
        id: event.sessionId,
        developerId: userId,
        agentId: agent.id,
        workspaceId,
        repositoryId,
        branch: event.branch,
        title: event.title,
        status: AgentStatus.RUNNING,
        startedAt: this.date(event.timestamp),
      },
      // Re-point drifted sessions: the device may have re-registered against
      // a different workspace since the row was first created (e.g. a session
      // born before registration completed). Latest device wins.
      update: {
        workspaceId,
        developerId: userId,
        agentId: agent.id,
        repositoryId,
        branch: event.branch ?? undefined,
      },
    });
    await IssueLinksService.linkSession(
      repositoryId,
      event.branch ?? null,
      event.sessionId,
    );
    if (aiEnabled() && repositoryId) {
      void queue.enqueue("issue.match", { sessionId: event.sessionId });
    }
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        status: AgentStatus.RUNNING,
        lastHeartbeatAt: new Date(),
        model: event.model ?? agent.model,
        version: event.version ?? agent.version,
      },
    });

    this.broadcast({
      type: "agent.started",
      workspaceId,
      developerId: userId,
      sessionId: event.sessionId,
      agent: event.agent,
      title: event.title ?? null,
      timestamp: Date.now(),
    });
  }

  private async handleAgentStopped(
    workspaceId: string,
    userId: string,
    event: Extract<TelemetryEvent, { type: "agent.stopped" }>,
  ): Promise<void> {
    await prisma.agentSession.updateMany({
      where: { id: event.sessionId },
      data: { status: AGENT_STATUS_MAP[event.status], endedAt: new Date() },
    });
    await prisma.agent.updateMany({
      where: { sessions: { some: { id: event.sessionId } } },
      data: { status: AgentStatus.IDLE, lastHeartbeatAt: new Date() },
    });
    if (aiEnabled()) {
      void queue.enqueue("issue.match", { sessionId: event.sessionId });
    }

    this.broadcast({
      type: "agent.stopped",
      workspaceId,
      developerId: userId,
      sessionId: event.sessionId,
      timestamp: Date.now(),
    });
  }

  private async handleTokenUsage(
    workspaceId: string,
    event: Extract<TelemetryEvent, { type: "agent.token_usage" }>,
  ): Promise<void> {
    const model = await prisma.model.upsert({
      where: {
        provider_name: { provider: event.provider, name: event.model },
      },
      create: { provider: event.provider, name: event.model },
      update: {},
    });
    await prisma.tokenUsage.create({
      data: {
        sessionId: event.sessionId,
        modelId: model.id,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        cachedInputTokens: event.cachedInputTokens,
        costCents: this.costCents(model, event.inputTokens, event.outputTokens),
        measuredAt: this.date(event.timestamp),
      },
    });
  }

  private async handleActivityStarted(
    workspaceId: string,
    userId: string,
    event: Extract<TelemetryEvent, { type: "activity.started" }>,
  ): Promise<void> {
    const repositoryId = event.repository
      ? (await this.resolveRepository(workspaceId, event.repository)).id
      : null;

    await prisma.activity.upsert({
      where: { id: event.activityId },
      create: {
        id: event.activityId,
        developerId: userId,
        workspaceId,
        repositoryId,
        type: ACTIVITY_TYPE_MAP[event.activityType],
        title: event.title,
        summary: event.summary,
        status: ActivityStatus.IN_PROGRESS,
        startedAt: this.date(event.timestamp),
      },
      update: {},
    });

    this.broadcastActivityUpdated(
      workspaceId,
      event.activityId,
      userId,
      "in_progress",
      event.summary ?? null,
    );
  }

  private async handleActivityUpdated(
    workspaceId: string,
    event: Extract<TelemetryEvent, { type: "activity.updated" }>,
  ): Promise<void> {
    const data: {
      status?: ActivityStatus;
      summary?: string | null;
      filesChanged?: number;
      linesChanged?: number;
    } = {};
    if (event.status) data.status = ACTIVITY_STATUS_MAP[event.status];
    if (event.summary !== undefined) data.summary = event.summary;
    if (event.filesChanged !== undefined)
      data.filesChanged = event.filesChanged;
    if (event.linesChanged !== undefined)
      data.linesChanged = event.linesChanged;

    const updated = await prisma.activity.updateMany({
      where: { id: event.activityId },
      data,
    });
    if (updated.count === 0) return;

    const activity = await prisma.activity.findFirst({
      where: { id: event.activityId },
      select: { status: true, summary: true, developerId: true },
    });
    if (!activity) return;
    this.broadcastActivityUpdated(
      workspaceId,
      event.activityId,
      activity.developerId,
      activity.status.toLowerCase(),
      activity.summary,
    );
  }

  private async handleActivityStopped(
    workspaceId: string,
    event: Extract<TelemetryEvent, { type: "activity.stopped" }>,
  ): Promise<void> {
    const outcome = event.outcome ? OUTCOME_STATUS_MAP[event.outcome] : null;
    const status = this.activityStatusForOutcome(event.outcome);

    await prisma.activity.updateMany({
      where: { id: event.activityId },
      data: { endedAt: new Date(), outcomeStatus: outcome, status },
    });

    const activity = await prisma.activity.findFirst({
      where: { id: event.activityId },
      select: { developerId: true },
    });
    this.broadcastActivityUpdated(
      workspaceId,
      event.activityId,
      activity?.developerId ?? "",
      status.toLowerCase(),
      null,
    );
  }

  private async handleGitCommit(
    workspaceId: string,
    event: Extract<TelemetryEvent, { type: "git.commit" }>,
  ): Promise<void> {
    const repo = await this.resolveRepository(workspaceId, event.repository);
    const branchName = event.branch ?? "HEAD";

    const branch = await prisma.branch.upsert({
      where: {
        repositoryId_name: { repositoryId: repo.id, name: branchName },
      },
      create: {
        repositoryId: repo.id,
        name: branchName,
        lastCommitSha: event.sha,
      },
      update: { lastCommitSha: event.sha },
    });
    await IssueLinksService.linkBranch(repo.id, branchName);

    await prisma.commit.upsert({
      where: { repositoryId_sha: { repositoryId: repo.id, sha: event.sha } },
      create: {
        repositoryId: repo.id,
        branchId: branch.id,
        sha: event.sha,
        message: event.message,
        authoredAt: event.authoredAt ? this.date(event.authoredAt) : undefined,
        insertions: event.insertions,
        deletions: event.deletions,
        filesChanged: event.filesChanged,
      },
      update: {
        message: event.message,
        insertions: event.insertions,
        deletions: event.deletions,
        filesChanged: event.filesChanged,
      },
    });
    await IssueLinksService.linkCommit(repo.id, event.sha, event.message);

    this.broadcast({
      type: "repo.push",
      workspaceId,
      repositoryId: repo.id,
      repoName: repo.name,
      branch: branchName,
      commitCount: 1,
      headSha: event.sha,
      timestamp: Date.now(),
    });
  }

  private async handleGitPullRequest(
    workspaceId: string,
    event: Extract<TelemetryEvent, { type: "git.pull_request" }>,
  ): Promise<void> {
    const repo = await this.resolveRepository(workspaceId, event.repository);
    const status = PR_STATUS_MAP[event.status];

    const upserted = await prisma.pullRequest.upsert({
      where: {
        repositoryId_number: { repositoryId: repo.id, number: event.number },
      },
      create: {
        repositoryId: repo.id,
        number: event.number,
        title: event.title,
        status,
        url: event.url,
        headBranch: event.headBranch,
        baseBranch: event.baseBranch,
        additions: event.additions,
        deletions: event.deletions,
        commits: event.commits,
        mergedAt: event.mergedAt ? this.date(event.mergedAt) : undefined,
        closedAt: event.closedAt ? this.date(event.closedAt) : undefined,
      },
      update: {
        title: event.title,
        status,
        url: event.url,
        headBranch: event.headBranch,
        baseBranch: event.baseBranch,
        additions: event.additions,
        deletions: event.deletions,
        commits: event.commits,
        mergedAt: event.mergedAt ? this.date(event.mergedAt) : undefined,
        closedAt: event.closedAt ? this.date(event.closedAt) : undefined,
      },
    });

    this.broadcast({
      type: "pr.updated",
      workspaceId,
      repositoryId: repo.id,
      repoName: repo.name,
      prNumber: event.number,
      title: upserted.title,
      status: upserted.status,
      timestamp: Date.now(),
    });
  }

  private async handleGitBranch(
    workspaceId: string,
    event: Extract<TelemetryEvent, { type: "git.branch" }>,
  ): Promise<void> {
    const repo = await this.resolveRepository(workspaceId, event.repository);
    await prisma.branch.upsert({
      where: {
        repositoryId_name: { repositoryId: repo.id, name: event.name },
      },
      create: {
        repositoryId: repo.id,
        name: event.name,
        lastCommitSha: event.lastCommitSha,
      },
      update: { lastCommitSha: event.lastCommitSha },
    });
    await IssueLinksService.linkBranch(repo.id, event.name);
  }

  private async handleTestStarted(
    workspaceId: string,
    userId: string,
    event: Extract<TelemetryEvent, { type: "test.started" }>,
  ): Promise<void> {
    const repositoryId = event.repository
      ? (await this.resolveRepository(workspaceId, event.repository)).id
      : null;
    await prisma.testRun.upsert({
      where: { id: event.testRunId },
      create: {
        id: event.testRunId,
        developerId: userId,
        activityId: event.activityId,
        repositoryId,
        branch: event.branch,
        command: event.command,
        status: TestStatus.RUNNING,
        startedAt: this.date(event.timestamp),
      },
      update: {},
    });
  }

  private async handleAgentStatus(
    workspaceId: string,
    userId: string,
    event: Extract<TelemetryEvent, { type: "agent.status" }>,
  ): Promise<void> {
    const status =
      event.status === "blocked"
        ? AgentStatus.BLOCKED
        : event.status === "waiting_approval"
          ? AgentStatus.WAITING_APPROVAL
          : AgentStatus.RUNNING;
    await prisma.agentSession.updateMany({
      where: { id: event.sessionId },
      data: { status },
    });

    this.broadcast({
      type: "agent.status",
      workspaceId,
      developerId: userId,
      sessionId: event.sessionId,
      status: event.status,
      timestamp: Date.now(),
    });
  }

  private async handleTestFinished(
    workspaceId: string,
    userId: string,
    event: Extract<TelemetryEvent, { type: "test.finished" }>,
  ): Promise<void> {
    await prisma.testRun.updateMany({
      where: { id: event.testRunId },
      data: {
        status: TEST_STATUS_MAP[event.status],
        durationMs: event.durationMs,
        totalTests: event.totalTests,
        passedTests: event.passedTests,
        failedTests: event.failedTests,
        skippedTests: event.skippedTests,
        endedAt: new Date(),
      },
    });

    // Broadcast so the office reacts (ticker + nameplate pulse).
    const row = await prisma.testRun.findUnique({
      where: { id: event.testRunId },
      select: {
        developerId: true,
        repository: { select: { githubFullName: true, name: true } },
      },
    });
    if (!row || row.developerId !== userId) return;

    this.broadcast({
      type: "test.finished",
      workspaceId,
      developerId: userId,
      repositoryName:
        row.repository?.githubFullName ?? row.repository?.name ?? null,
      passed: event.status === "passed",
      durationMs: event.durationMs ?? null,
      timestamp: Date.now(),
    });
  }

  private async attachEnvironmentEvent(
    workspaceId: string,
    userId: string,
    event: Extract<
      TelemetryEvent,
      | { type: "process.started" }
      | { type: "process.stopped" }
      | { type: "terminal.command" }
      | { type: "file.modified" }
    >,
  ): Promise<void> {
    const eventType = this.eventTypeFor(event.type);

    const running = await prisma.agentSession.findFirst({
      where: { workspaceId, developerId: userId, status: AgentStatus.RUNNING },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    if (running) {
      const sequence = await this.nextAgentSequence(running.id);
      await prisma.agentEvent.create({
        data: {
          agentSessionId: running.id,
          type: eventType,
          payload: event as unknown as Prisma.InputJsonValue,
          sequence,
          occurredAt: this.date(event.timestamp),
        },
      });
      return;
    }

    const activity = await prisma.activity.findFirst({
      where: {
        workspaceId,
        developerId: userId,
        status: ActivityStatus.IN_PROGRESS,
      },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    if (activity) {
      const sequence = await this.nextActivitySequence(activity.id);
      await prisma.activityEvent.create({
        data: {
          activityId: activity.id,
          type: eventType,
          payload: event as unknown as Prisma.InputJsonValue,
          sequence,
          occurredAt: this.date(event.timestamp),
        },
      });
    }
  }

  private async resolveAgent(
    workspaceId: string,
    name: string,
    type: AgentType,
  ): Promise<{ id: string; model: string | null; version: string | null }> {
    const existing = await prisma.agent.findFirst({
      where: { workspaceId, name },
      select: { id: true, model: true, version: true },
    });
    if (existing) return existing;
    return prisma.agent.create({
      data: { workspaceId, name, type },
      select: { id: true, model: true, version: true },
    });
  }

  private async resolveRepository(
    workspaceId: string,
    name: string,
  ): Promise<{ id: string; name: string }> {
    return prisma.repository.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      create: {
        workspaceId,
        name,
        provider: RepositoryProvider.OTHER,
      },
      update: {},
      select: { id: true, name: true },
    });
  }

  private async nextAgentSequence(sessionId: string): Promise<number> {
    const last = await prisma.agentEvent.findFirst({
      where: { agentSessionId: sessionId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    return (last?.sequence ?? 0) + 1;
  }

  private async nextActivitySequence(activityId: string): Promise<number> {
    const last = await prisma.activityEvent.findFirst({
      where: { activityId },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    return (last?.sequence ?? 0) + 1;
  }

  private eventTypeFor(
    type:
      | "process.started"
      | "process.stopped"
      | "terminal.command"
      | "file.modified",
  ): EventType {
    switch (type) {
      case "process.started":
        return EventType.PROCESS_STARTED;
      case "process.stopped":
        return EventType.PROCESS_STOPPED;
      case "terminal.command":
        return EventType.TERMINAL_COMMAND;
      case "file.modified":
        return EventType.FILE_MODIFIED;
    }
  }

  private activityStatusForOutcome(
    outcome?: "success" | "failed" | "blocked" | "cancelled",
  ): ActivityStatus {
    switch (outcome) {
      case "blocked":
        return ActivityStatus.BLOCKED;
      case "cancelled":
        return ActivityStatus.CANCELLED;
      default:
        return ActivityStatus.COMPLETED;
    }
  }

  private costCents(
    model: { inputPricePerMillion: unknown; outputPricePerMillion: unknown },
    inputTokens: number,
    outputTokens: number,
  ): number | null {
    const inputPrice = model.inputPricePerMillion
      ? Number(model.inputPricePerMillion)
      : 0;
    const outputPrice = model.outputPricePerMillion
      ? Number(model.outputPricePerMillion)
      : 0;
    if (inputPrice === 0 && outputPrice === 0) return null;
    const costUsd =
      (inputTokens / 1_000_000) * inputPrice +
      (outputTokens / 1_000_000) * outputPrice;
    return Math.round(costUsd * 100);
  }

  private broadcastActivityUpdated(
    workspaceId: string,
    activityId: string,
    developerId: string,
    status: string,
    summary: string | null,
  ): void {
    this.broadcast({
      type: "activity.updated",
      workspaceId,
      developerId,
      activityId,
      status,
      summary,
      timestamp: Date.now(),
    });
  }

  private broadcast(event: RealtimeEvent): void {
    realtimeBus.publish(event.workspaceId, event);
  }

  private date(value: string): Date {
    return new Date(value);
  }
}
