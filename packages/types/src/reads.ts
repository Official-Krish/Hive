import { z } from "zod";
import { paginationSchema } from "./api";

export const activityFilterSchema = paginationSchema.extend({
  status: z
    .enum(["in_progress", "completed", "cancelled", "blocked"])
    .optional(),
  type: z
    .enum([
      "coding",
      "agent",
      "review",
      "testing",
      "debugging",
      "research",
      "idle",
    ])
    .optional(),
  developerId: z.string().optional(),
});
export type ActivityFilter = z.infer<typeof activityFilterSchema>;

export const sessionFilterSchema = paginationSchema.extend({
  status: z
    .enum([
      "idle",
      "running",
      "blocked",
      "waiting_approval",
      "completed",
      "error",
      "stopped",
    ])
    .optional(),
  agentId: z.string().optional(),
});
export type SessionFilter = z.infer<typeof sessionFilterSchema>;

export const prFilterSchema = paginationSchema.extend({
  status: z.enum(["draft", "open", "merged", "closed"]).optional(),
});
export type PrFilter = z.infer<typeof prFilterSchema>;

export const issueFilterSchema = paginationSchema.extend({
  state: z.enum(["open", "closed"]).optional(),
  repositoryId: z.string().optional(),
});
export type IssueFilter = z.infer<typeof issueFilterSchema>;

export const alertFilterSchema = paginationSchema.extend({
  status: z.enum(["open", "acknowledged", "resolved"]).optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
});
export type AlertFilter = z.infer<typeof alertFilterSchema>;

export const taskFilterSchema = paginationSchema.extend({
  status: z
    .enum(["open", "in_progress", "blocked", "completed", "cancelled"])
    .optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  developerId: z.string().optional(),
});
export type TaskFilter = z.infer<typeof taskFilterSchema>;

export const metricFilterSchema = z.object({
  period: z.enum(["day", "week", "month"]).default("week"),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
});
export type MetricFilter = z.infer<typeof metricFilterSchema>;

export const testRunFilterSchema = paginationSchema.extend({
  status: z.enum(["running", "passed", "failed", "skipped"]).optional(),
});
export type TestRunFilter = z.infer<typeof testRunFilterSchema>;

export interface DeveloperRef {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface RepositoryRef {
  id: string;
  name: string;
}

export interface MapRead {
  mapId: string;
  name: string;
  version: number;
  members: Array<{
    userId: string;
    name: string;
    avatarUrl: string | null;
    status: "online" | "away" | "offline" | null;
    position: { x: number; y: number; roomId: string | null } | null;
  }>;
}

export interface ActivitySummary {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  status: string | null;
  outcomeStatus: string | null;
  filesChanged: number | null;
  linesChanged: number | null;
  startedAt: string;
  endedAt: string | null;
  developer: DeveloperRef;
  repository: RepositoryRef | null;
}

export interface ActivityEventRead {
  id: string;
  type: string;
  sequence: number;
  payload: unknown;
  occurredAt: string;
}

export interface SessionRef {
  id: string;
  agentName: string;
  title: string | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
}

export interface TestRunRef {
  id: string;
  status: string;
  command: string | null;
  totalTests: number | null;
  passedTests: number | null;
  failedTests: number | null;
  startedAt: string;
  endedAt: string | null;
}

export interface TokenUsageRead {
  id: string;
  modelName: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number | null;
  costCents: number | null;
  measuredAt: string;
}

export interface ActivityDetail extends ActivitySummary {
  events: ActivityEventRead[];
  sessions: SessionRef[];
  testRuns: TestRunRef[];
  commits: Array<{ sha: string; message: string; authoredAt: string }>;
  pullRequests: Array<{ number: number; title: string; status: string }>;
  tokenUsage: TokenUsageRead | null;
}

export interface SessionSummary {
  id: string;
  agent: { id: string; name: string; type: string; model: string | null };
  developer: DeveloperRef;
  title: string | null;
  status: string | null;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
  inputTokens: number;
  outputTokens: number;
  costCents: number | null;
}

export interface SessionDetail extends SessionSummary {
  events: ActivityEventRead[];
  tokenUsage: TokenUsageRead[];
}

export interface RepositorySummary {
  id: string;
  name: string;
  url: string | null;
  provider: string;
  defaultBranch: string | null;
  branchCount: number;
  openPrCount: number;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface RepositoryDetail extends RepositorySummary {
  branches: Array<{ id: string; name: string; lastCommitSha: string | null }>;
  commits: Array<{
    sha: string;
    message: string;
    authoredAt: string;
    insertions: number | null;
    deletions: number | null;
  }>;
  pullRequests: Array<{
    number: number;
    title: string;
    status: string;
    authorName: string | null;
    createdAt: string;
  }>;
}

export interface PullRequestSummary {
  id: string;
  repository: RepositoryRef;
  number: number;
  title: string;
  status: string;
  url: string | null;
  authorName: string | null;
  additions: number | null;
  deletions: number | null;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
}

export interface IssueSummary {
  id: string;
  repository: RepositoryRef;
  number: number;
  title: string;
  state: string;
  url: string | null;
  authorLogin: string | null;
  labels: string[];
  openedAt: string;
  closedAt: string | null;
  updatedAt: string;
  sessionCount: number;
  branchCount: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number | null;
}

export interface IssueDetail extends IssueSummary {
  body: string | null;
  assignees: string[];
  branches: Array<{ id: string; name: string; lastCommitSha: string | null }>;
  commits: Array<{
    sha: string;
    message: string;
    authoredAt: string;
    insertions: number | null;
    deletions: number | null;
  }>;
  sessions: SessionSummary[];
}

export interface MetricSummary {
  id: string;
  period: string;
  periodStart: string;
  tokensPerTask: string | null;
  costPerPrCents: number | null;
  agentSuccessRate: string | null;
  retryRate: string | null;
  tasksCompleted: number | null;
  prsMerged: number | null;
  agentsTotal: number | null;
  tokensTotal: number | null;
  costTotalCents: number | null;
  computedAt: string;
}

export interface AlertSummary {
  id: string;
  severity: string;
  type: string;
  message: string;
  status: string;
  developerId: string | null;
  agentSessionId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface TaskSummary {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  developer: DeveloperRef;
  activity: { id: string; title: string } | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ModelRead {
  id: string;
  provider: string;
  name: string;
  inputPricePerMillion: string | null;
  outputPricePerMillion: string | null;
  contextWindow: number | null;
}

export interface TestRunSummary {
  id: string;
  status: string;
  command: string | null;
  durationMs: number | null;
  totalTests: number | null;
  passedTests: number | null;
  failedTests: number | null;
  skippedTests: number | null;
  developer: DeveloperRef | null;
  activity: { id: string; title: string } | null;
  repository: RepositoryRef | null;
  branch: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface DeveloperStats {
  developer: DeveloperRef;
  inputTokens: number;
  outputTokens: number;
  costCents: number | null;
  sessionCount: number;
  activityCount: number;
  tasksCompleted: number;
  prsMerged: number;
}
