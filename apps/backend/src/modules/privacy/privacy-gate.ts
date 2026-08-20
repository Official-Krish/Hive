import type {
  ActivityDetail,
  ActivityEventRead,
  ActivitySummary,
  DeveloperStats,
  IssueDetail,
  IssueSummary,
  MapRead,
  MetricSummary,
  PrivacySetting,
  RepositoryDetail,
  SessionDetail,
  SessionSummary,
} from "@hive/types";

type EventPayload = Record<string, unknown>;

function gateEvent(
  event: ActivityEventRead,
  p: PrivacySetting,
): ActivityEventRead {
  const payload = (event.payload ?? {}) as EventPayload;
  const next: EventPayload = { ...payload };
  if (!p.allowFilePaths && typeof next.path === "string") next.path = null;
  if (!p.allowExactCommands && typeof next.command === "string") {
    next.command = null;
  }
  if (!p.allowPromptMetadata) {
    if (typeof next.title === "string") next.title = null;
    if (typeof next.prompt === "string") next.prompt = null;
  }
  return { ...event, payload: next };
}

function gateEvents(
  events: ActivityEventRead[],
  p: PrivacySetting,
): ActivityEventRead[] {
  return events.map((e) => gateEvent(e, p));
}

/**
 * Pure privacy gating over already-shaped read API objects. Masked values are
 * nulled/emptied so response structure stays stable.
 */
export class PrivacyGate {
  static activitySummary(
    a: ActivitySummary,
    p: PrivacySetting,
  ): ActivitySummary {
    if (!p.allowActivitySummaries) a = { ...a, summary: null };
    if (!p.allowAgentStatus) a = { ...a, status: null };
    return a;
  }

  static activityDetail(d: ActivityDetail, p: PrivacySetting): ActivityDetail {
    let out: ActivityDetail = { ...d };
    if (!p.allowActivitySummaries) out = { ...out, summary: null };
    if (!p.allowAgentStatus) out = { ...out, status: null };
    if (!p.allowGitMetadata) {
      out = { ...out, commits: [], pullRequests: [] };
    }
    if (!p.allowTokenUsage) out = { ...out, tokenUsage: null };
    if (!p.allowExactCommands || !p.allowFilePaths || !p.allowPromptMetadata) {
      out = { ...out, events: gateEvents(d.events, p) };
    }
    return out;
  }

  static sessionSummary(s: SessionSummary, p: PrivacySetting): SessionSummary {
    let out: SessionSummary = { ...s };
    if (!p.allowPromptMetadata) out = { ...out, title: null };
    if (!p.allowActivitySummaries) out = { ...out, summary: null };
    if (!p.allowAgentStatus) out = { ...out, status: null };
    if (!p.allowTokenUsage) {
      out = { ...out, inputTokens: 0, outputTokens: 0, costCents: null };
    }
    return out;
  }

  static sessionDetail(d: SessionDetail, p: PrivacySetting): SessionDetail {
    let out: SessionDetail = { ...d };
    if (!p.allowPromptMetadata) out = { ...out, title: null };
    if (!p.allowActivitySummaries) out = { ...out, summary: null };
    if (!p.allowAgentStatus) out = { ...out, status: null };
    if (!p.allowTokenUsage) {
      out = { ...out, inputTokens: 0, outputTokens: 0, costCents: null };
      out = { ...out, tokenUsage: [] };
    }
    if (!p.allowExactCommands || !p.allowFilePaths || !p.allowPromptMetadata) {
      out = { ...out, events: gateEvents(d.events, p) };
    }
    return out;
  }

  static repositoryDetail(
    r: RepositoryDetail,
    p: PrivacySetting,
  ): RepositoryDetail {
    if (p.allowGitMetadata) return r;
    return {
      ...r,
      branches: [],
      commits: [],
      pullRequests: [],
    };
  }

  static issueSummary(i: IssueSummary, p: PrivacySetting): IssueSummary {
    let out: IssueSummary = { ...i };
    if (!p.allowTokenUsage) {
      out = { ...out, inputTokens: 0, outputTokens: 0, costCents: null };
    }
    if (!p.allowGitMetadata) {
      out = { ...out, branchCount: 0, sessionCount: 0 };
    }
    return out;
  }

  static issueDetail(d: IssueDetail, p: PrivacySetting): IssueDetail {
    let out: IssueDetail = { ...d };
    if (!p.allowTokenUsage) {
      out = { ...out, inputTokens: 0, outputTokens: 0, costCents: null };
      out = {
        ...out,
        sessions: d.sessions.map((s) => PrivacyGate.sessionSummary(s, p)),
      };
    }
    if (!p.allowGitMetadata) {
      out = {
        ...out,
        branches: [],
        commits: [],
        branchCount: 0,
        sessionCount: 0,
      };
    }
    if (!p.allowActivitySummaries) {
      out = {
        ...out,
        sessions: d.sessions.map((s) => PrivacyGate.sessionSummary(s, p)),
      };
    }
    if (!p.allowAgentStatus) {
      out = {
        ...out,
        sessions: d.sessions.map((s) => PrivacyGate.sessionSummary(s, p)),
      };
    }
    if (!p.allowPromptMetadata) {
      out = {
        ...out,
        sessions: d.sessions.map((s) => PrivacyGate.sessionSummary(s, p)),
      };
    }
    return out;
  }

  static metric(m: MetricSummary, p: PrivacySetting): MetricSummary {
    if (p.allowTokenUsage) return m;
    return { ...m, tokensTotal: null, costTotalCents: null };
  }

  static developerStats(s: DeveloperStats, p: PrivacySetting): DeveloperStats {
    if (p.allowTokenUsage) return s;
    return { ...s, inputTokens: 0, outputTokens: 0, costCents: null };
  }

  static map(m: MapRead, p: PrivacySetting): MapRead {
    if (p.allowAgentStatus) return m;
    return {
      ...m,
      members: m.members.map((member) => ({ ...member, status: null })),
    };
  }
}
