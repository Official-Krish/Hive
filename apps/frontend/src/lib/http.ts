import type {
  ChatMessageDto,
  ConversationSummary,
  GitHubNotificationsResponse,
  PairSession,
  PairSessionCreate,
} from "@hive/types";
import { API_BASE_URL } from "./config";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: object;
  headers?: Record<string, string>;
}

/* Silent session renewal: the access cookie is short-lived, so any 401 from
   a protected endpoint triggers one single-flight POST /auth/refresh (which
   rotates both cookies) and retries the original request exactly once.
   Without this, a backend restart or 15 idle minutes would log the user out. */
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, headers } = options;
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const doFetch = () =>
    fetch(url.toString(), {
      method,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await doFetch();

  // Auth endpoints manage their own cookies; refreshing there would loop.
  const isAuthPath = path.startsWith("/api/v1/auth/");
  if (res.status === 401 && !isAuthPath && (await refreshSession())) {
    res = await doFetch();
  }

  const json = (await res.json().catch(() => null)) as
    (ApiErrorBody & { data?: T }) | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error?.code ?? "REQUEST_FAILED",
      json?.error?.message ?? `Request failed with status ${res.status}`,
      json?.error?.details,
    );
  }

  return json?.data as T;
}

/* ------------------------------------------------------------------ */
/* Shared types                                                        */
/* ------------------------------------------------------------------ */

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  mapAvatarModel: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
}

export interface MeData {
  user: PublicUser;
  organizations: OrganizationSummary[];
}

export interface AuthData {
  user: PublicUser;
  accessTokenExpiresIn: number;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
  memberCount: number;
  createdAt: string;
  /** Full webhook secret, only present on create/rotate responses. */
  webhookSecret?: string;
}

export interface WorkspaceRepository {
  id: string;
  name: string;
  fullName: string | null;
  url: string | null;
  provider: string;
}

export interface WorkspaceSettings {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  webhookSecretMasked: string;
  repositories: WorkspaceRepository[];
}

export interface GitHubRepoOption {
  id: number;
  name: string;
  fullName: string;
  url: string | null;
  private: boolean;
  admin: boolean;
}

export interface GitHubInstallationView {
  id: string;
  installationId: string;
  githubAppId: string;
  repositoryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberPublic {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

export interface InviteCreatedResult {
  invite: {
    id: string;
    email: string;
    role: string;
    status: "pending" | "accepted" | "revoked" | "expired";
    expiresAt: string;
    createdAt: string;
  };
  /** Raw invite token — returned once, used in the accept link. */
  token: string;
}

export interface ReceivedInvite {
  id: string;
  role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  } | null;
  org: { id: string; name: string };
  invitedBy: { name: string; email: string; avatarUrl: string | null } | null;
  expiresAt: string;
  createdAt: string;
}

export interface HealthData {
  status: string;
  uptime: number;
  timestamp: string;
  db: string;
  redis: string;
  wsPort: number;
  githubClientId: string;
  clientUrl: string;
}

export interface DeviceSummary {
  id: string;
  name: string;
  type: string;
  os: string | null;
  arch: string | null;
  status: string;
  online: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface DeviceRegistered {
  device: DeviceSummary;
  token: string;
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
  memberCount: number;
  workspaceCount: number;
  createdAt: string;
}

export interface OrgMemberPublic {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  joinedAt: string;
}

export interface TeamSummary {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  createdById: string;
  memberCount: number;
  createdAt: string;
}

export interface TeamMemberPublic {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

export interface CreateTeamInput {
  name: string;
  slug?: string;
}

export interface UpdateTeamInput {
  name?: string;
  slug?: string;
}

export interface AddTeamMemberInput {
  userId: string;
  role: string;
}

export interface PrivacySettingRead {
  workspaceId: string;
  updatedById: string | null;
  updatedAt: string | null;
  allowActivitySummaries: boolean;
  allowAgentStatus: boolean;
  allowTokenUsage: boolean;
  allowGitMetadata: boolean;
  allowExactCommands: boolean;
  allowFilePaths: boolean;
  allowPromptMetadata: boolean;
}

export interface ModelSummary {
  id: string;
  name: string;
  provider: string;
  inputCostPerMillion: number | null;
  outputCostPerMillion: number | null;
}

export interface RepositoryRef {
  id: string;
  name: string;
}

export interface RepositorySummary {
  id: string;
  name: string;
  provider: string;
  workspaceId: string;
  defaultBranch: string | null;
  lastCommitSha: string | null;
  branchCount: number;
  commitCount: number;
  prCount: number;
  updatedAt: string;
}

export interface ActivitySummary {
  id: string;
  activityType: string;
  status: string;
  title: string | null;
  summary: string | null;
  repository: RepositoryRef | null;
  branch: string | null;
  startedAt: string;
  endedAt: string | null;
  inputTokens: number;
  outputTokens: number;
  costCents: number | null;
}

export interface AgentSessionSummary {
  id: string;
  agent: { id: string; name: string; type: string; model: string | null };
  status: string;
  title: string | null;
  summary: string | null;
  repository: RepositoryRef | null;
  branch: string | null;
  startedAt: string;
  endedAt: string | null;
  inputTokens: number;
  outputTokens: number;
  costCents: number | null;
}

export interface PullRequestSummary {
  id: string;
  number: number;
  title: string;
  state: string;
  authorLogin: string | null;
  repository: RepositoryRef;
  createdAt: string;
  updatedAt: string;
}

export interface MetricSummary {
  id: string;
  name: string;
  value: number;
  recordedAt: string;
}

export interface AlertSummary {
  id: string;
  title: string;
  status: string;
  severity: string;
  message: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
}

export interface TestRunSummary {
  id: string;
  status: string;
  totalTests: number | null;
  passed: number | null;
  failed: number | null;
  durationMs: number | null;
  startedAt: string;
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
  sessions: Array<{
    id: string;
    agentName: string;
    status: string;
    title: string | null;
    startedAt: string;
    inputTokens: number;
    outputTokens: number;
  }>;
}

export interface RealtimeMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  position: { x: number; y: number; z: number } | null;
}

export interface WorkspaceMapSnapshot {
  mapId: string;
  name: string;
  version: number;
  members: RealtimeMember[];
}

export interface MapOverlay {
  developer: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    /** Presence (world overlay only). */
    status?: string | null;
    label?: string | null;
    workingOn?: string | null;
  };
  /** Repo (owner/name) of their current/latest agent session. */
  project?: string | null;
  currentSession: {
    id: string;
    agent: { id: string; name: string; type: string; model: string | null };
    title: string | null;
    status: string | null;
    startedAt: string;
    branch?: string | null;
  } | null;
  issue: {
    id: string;
    number: number;
    title: string;
    state: string;
  } | null;
  inputTokens: number;
  outputTokens: number;
  costCents: number | null;
  stats?: {
    sessionsToday: number;
    activeMinutesToday: number;
    costCentsToday: number | null;
    testsPassedToday: number;
    testsFailedToday: number;
    modelMix: Array<{ model: string; share: number }> | null;
    recentEvents: Array<{ label: string; at: string }> | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/* Input types                                                         */
/* ------------------------------------------------------------------ */

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string | null;
  mapAvatarModel?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  webhookSecret?: string;
  repositoryId?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string | null;
}

export interface UpdateMemberRoleInput {
  role: "admin" | "maintainer" | "developer" | "member" | "viewer";
}

export interface CreateInviteInput {
  email: string;
  role?: "admin" | "maintainer" | "developer" | "member" | "viewer";
}

export interface CreateGithubInviteInput {
  githubLogin: string;
  role?: "admin" | "maintainer" | "developer" | "member" | "viewer";
}

export interface RegisterDeviceInput {
  name: string;
}

export interface UpdateOrgInput {
  name?: string;
  slug?: string;
  plan?: string;
}

export interface UpdateOrgMemberRoleInput {
  role: string;
}

export type UpdatePrivacySettingInput = Partial<
  Omit<PrivacySettingRead, "workspaceId" | "updatedById" | "updatedAt">
>;

export interface SessionFilterParams extends PaginationParams {
  status?: string;
  repositoryId?: string;
  agentType?: string;
  from?: string;
  to?: string;
}

export interface ActivityFilterParams extends PaginationParams {
  status?: string;
  type?: string;
  developerId?: string;
  from?: string;
  to?: string;
}

export interface IssueFilterParams extends PaginationParams {
  state?: string;
  repositoryId?: string;
}

export interface PrFilterParams extends PaginationParams {
  state?: string;
}

export interface AlertFilterParams extends PaginationParams {
  status?: string;
  severity?: string;
}

export interface TaskFilterParams extends PaginationParams {
  status?: string;
  priority?: string;
  developerId?: string;
}

export interface TestRunFilterParams extends PaginationParams {
  status?: string;
}

export interface MetricFilterParams extends PaginationParams {
  metric?: string;
}

/* ------------------------------------------------------------------ */
/* API client                                                          */
/* ------------------------------------------------------------------ */

export const http = {
  health: (): Promise<HealthData> => request("/api/v1/health"),

  auth: {
    register: (input: RegisterInput): Promise<AuthData> =>
      request("/api/v1/auth/register", { method: "POST", body: input }),

    login: (input: LoginInput): Promise<AuthData> =>
      request("/api/v1/auth/login", { method: "POST", body: input }),

    refresh: (): Promise<AuthData> =>
      request("/api/v1/auth/refresh", { method: "POST" }),

    logout: (): Promise<{ success: boolean }> =>
      request("/api/v1/auth/logout", { method: "POST" }),

    logoutAll: (): Promise<{ success: boolean }> =>
      request("/api/v1/auth/logout-all", { method: "POST" }),

    me: (): Promise<MeData> => request("/api/v1/auth/me"),

    updateProfile: (input: UpdateProfileInput): Promise<{ user: PublicUser }> =>
      request("/api/v1/auth/profile", { method: "PATCH", body: input }),

    changePassword: (
      input: ChangePasswordInput,
    ): Promise<{ success: boolean }> =>
      request("/api/v1/auth/change-password", { method: "POST", body: input }),
  },

  devices: {
    register: (input: RegisterDeviceInput): Promise<DeviceRegistered> =>
      request("/api/v1/devices", { method: "POST", body: input }),

    list: (): Promise<DeviceSummary[]> => request("/api/v1/devices"),

    status: (): Promise<{ hasOnlineDevice: boolean }> =>
      request("/api/v1/devices/me/status"),

    heartbeat: (id: string): Promise<DeviceSummary> =>
      request(`/api/v1/devices/${id}/heartbeat`, { method: "POST" }),

    stop: (id: string): Promise<{ stopped: boolean }> =>
      request(`/api/v1/devices/${id}/stop`, { method: "POST" }),

    revoke: (id: string): Promise<{ success: boolean }> =>
      request(`/api/v1/devices/${id}`, { method: "DELETE" }),
  },

  github: {
    loginUrl: (): Promise<{ url: string }> =>
      request("/api/v1/github/auth/url"),
    disconnect: (): Promise<{ success: boolean }> =>
      request("/api/v1/github/disconnect", { method: "POST" }),
    listRepos: (): Promise<{ repos: GitHubRepoOption[] }> =>
      request("/api/v1/github/repos"),
    notifications: (params?: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    }): Promise<GitHubNotificationsResponse> =>
      request("/api/v1/github/notifications", { query: params }),
    markRead: (id: string): Promise<{ success: boolean }> =>
      request(`/api/v1/github/notifications/${id}/read`, { method: "POST" }),
    markAllRead: (): Promise<{ success: boolean }> =>
      request("/api/v1/github/notifications/read-all", { method: "POST" }),
    installUrl: (workspaceId: string): Promise<{ url: string }> =>
      request(`/api/v1/github/${workspaceId}/app/install/url`),
    listInstallations: (
      workspaceId: string,
    ): Promise<{ installations: GitHubInstallationView[] }> =>
      request(`/api/v1/github/${workspaceId}/installations`),
    deleteInstallation: (
      workspaceId: string,
      installationId: string,
    ): Promise<{ success: boolean }> =>
      request(`/api/v1/github/${workspaceId}/installations/${installationId}`, {
        method: "DELETE",
      }),
  },

  workspaces: {
    list: (): Promise<WorkspaceSummary[]> => request("/api/v1/workspaces"),

    create: (input: CreateWorkspaceInput): Promise<WorkspaceSummary> =>
      request("/api/v1/workspaces", { method: "POST", body: input }),

    get: (workspaceId: string): Promise<WorkspaceSummary> =>
      request(`/api/v1/workspaces/${workspaceId}`),

    update: (
      workspaceId: string,
      input: UpdateWorkspaceInput,
    ): Promise<WorkspaceSummary> =>
      request(`/api/v1/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: input,
      }),

    remove: (workspaceId: string): Promise<{ success: boolean }> =>
      request(`/api/v1/workspaces/${workspaceId}`, { method: "DELETE" }),

    getSettings: (workspaceId: string): Promise<WorkspaceSettings> =>
      request(`/api/v1/workspaces/${workspaceId}/settings`),

    rotateSecret: (workspaceId: string): Promise<{ secret: string }> =>
      request(`/api/v1/workspaces/${workspaceId}/settings/rotate-secret`, {
        method: "POST",
      }),

    linkRepository: (
      workspaceId: string,
      repositoryId: string,
    ): Promise<{ success: boolean }> =>
      request(`/api/v1/workspaces/${workspaceId}/settings/repositories`, {
        method: "POST",
        body: { repositoryId },
      }),

    unlinkRepository: (
      workspaceId: string,
      repoId: string,
    ): Promise<{ success: boolean }> =>
      request(
        `/api/v1/workspaces/${workspaceId}/settings/repositories/${repoId}`,
        { method: "DELETE" },
      ),

    members: {
      list: (workspaceId: string): Promise<WorkspaceMemberPublic[]> =>
        request(`/api/v1/workspaces/${workspaceId}/members`),

      changeRole: (
        workspaceId: string,
        userId: string,
        input: UpdateMemberRoleInput,
      ): Promise<WorkspaceMemberPublic> =>
        request(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
          method: "PATCH",
          body: input,
        }),

      remove: (
        workspaceId: string,
        userId: string,
      ): Promise<{ success: boolean }> =>
        request(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
          method: "DELETE",
        }),
    },

    invites: {
      create: (
        workspaceId: string,
        input: CreateInviteInput,
      ): Promise<InviteCreatedResult> =>
        request(`/api/v1/workspaces/${workspaceId}/invites`, {
          method: "POST",
          body: input,
        }),

      createByGithub: (
        workspaceId: string,
        input: CreateGithubInviteInput,
      ): Promise<InviteCreatedResult> =>
        request(`/api/v1/workspaces/${workspaceId}/invites/github`, {
          method: "POST",
          body: input,
        }),

      list: (workspaceId: string): Promise<unknown[]> =>
        request(`/api/v1/workspaces/${workspaceId}/invites`),

      revoke: (
        workspaceId: string,
        inviteId: string,
      ): Promise<{ success: boolean }> =>
        request(`/api/v1/workspaces/${workspaceId}/invites/${inviteId}`, {
          method: "DELETE",
        }),
    },
  },

  invites: {
    listReceived: (): Promise<ReceivedInvite[]> => request("/api/v1/invites"),

    accept: (token: string): Promise<WorkspaceSummary> =>
      request(`/api/v1/invites/${token}/accept`, { method: "POST" }),

    acceptById: (inviteId: string): Promise<WorkspaceSummary> =>
      request(`/api/v1/invites/id/${inviteId}/accept`, { method: "POST" }),
  },

  orgs: {
    get: (orgId: string): Promise<OrgSummary> =>
      request(`/api/v1/orgs/${orgId}`),

    update: (orgId: string, input: UpdateOrgInput): Promise<OrgSummary> =>
      request(`/api/v1/orgs/${orgId}`, { method: "PATCH", body: input }),

    members: {
      list: (orgId: string): Promise<OrgMemberPublic[]> =>
        request(`/api/v1/orgs/${orgId}/members`),

      changeRole: (
        orgId: string,
        userId: string,
        input: UpdateOrgMemberRoleInput,
      ): Promise<OrgMemberPublic> =>
        request(`/api/v1/orgs/${orgId}/members/${userId}/role`, {
          method: "PATCH",
          body: input,
        }),

      remove: (orgId: string, userId: string): Promise<{ success: boolean }> =>
        request(`/api/v1/orgs/${orgId}/members/${userId}`, {
          method: "DELETE",
        }),
    },

    workspaces: (orgId: string): Promise<WorkspaceSummary[]> =>
      request(`/api/v1/orgs/${orgId}/workspaces`),
  },

  teams: {
    list: (orgId: string): Promise<TeamSummary[]> =>
      request(`/api/v1/orgs/${orgId}/teams`),

    create: (orgId: string, input: CreateTeamInput): Promise<TeamSummary> =>
      request(`/api/v1/orgs/${orgId}/teams`, { method: "POST", body: input }),

    get: (orgId: string, teamId: string): Promise<TeamSummary> =>
      request(`/api/v1/orgs/${orgId}/teams/${teamId}`),

    update: (
      orgId: string,
      teamId: string,
      input: UpdateTeamInput,
    ): Promise<TeamSummary> =>
      request(`/api/v1/orgs/${orgId}/teams/${teamId}`, {
        method: "PATCH",
        body: input,
      }),

    remove: (orgId: string, teamId: string): Promise<{ success: boolean }> =>
      request(`/api/v1/orgs/${orgId}/teams/${teamId}`, { method: "DELETE" }),

    members: {
      list: (orgId: string, teamId: string): Promise<TeamMemberPublic[]> =>
        request(`/api/v1/orgs/${orgId}/teams/${teamId}/members`),

      add: (
        orgId: string,
        teamId: string,
        input: AddTeamMemberInput,
      ): Promise<{ success: boolean }> =>
        request(`/api/v1/orgs/${orgId}/teams/${teamId}/members`, {
          method: "POST",
          body: input,
        }),

      changeRole: (
        orgId: string,
        teamId: string,
        userId: string,
        role: string,
      ): Promise<{ success: boolean }> =>
        request(
          `/api/v1/orgs/${orgId}/teams/${teamId}/members/${userId}/role`,
          { method: "PATCH", body: { role } },
        ),

      remove: (
        orgId: string,
        teamId: string,
        userId: string,
      ): Promise<{ success: boolean }> =>
        request(`/api/v1/orgs/${orgId}/teams/${teamId}/members/${userId}`, {
          method: "DELETE",
        }),
    },
  },

  privacy: {
    get: (workspaceId: string): Promise<PrivacySettingRead> =>
      request(`/api/v1/workspaces/${workspaceId}/privacy`),

    update: (
      workspaceId: string,
      input: UpdatePrivacySettingInput,
    ): Promise<PrivacySettingRead> =>
      request(`/api/v1/workspaces/${workspaceId}/privacy`, {
        method: "PATCH",
        body: input,
      }),
  },

  issues: {
    list: (
      workspaceId: string,
      params?: IssueFilterParams,
    ): Promise<Paginated<IssueSummary>> =>
      request(`/api/v1/workspaces/${workspaceId}/issues`, { query: params }),

    get: (workspaceId: string, issueId: string): Promise<IssueDetail> =>
      request(`/api/v1/workspaces/${workspaceId}/issues/${issueId}`),
  },

  reads: {
    map: (workspaceId: string): Promise<WorkspaceMapSnapshot> =>
      request(`/api/v1/workspaces/${workspaceId}/map`),

    activities: (
      workspaceId: string,
      params?: ActivityFilterParams,
    ): Promise<Paginated<ActivitySummary>> =>
      request(`/api/v1/workspaces/${workspaceId}/activities`, {
        query: params,
      }),

    activity: (
      workspaceId: string,
      activityId: string,
    ): Promise<ActivitySummary> =>
      request(`/api/v1/workspaces/${workspaceId}/activities/${activityId}`),

    sessions: (
      workspaceId: string,
      params?: SessionFilterParams,
    ): Promise<Paginated<AgentSessionSummary>> =>
      request(`/api/v1/workspaces/${workspaceId}/agent-sessions`, {
        query: params,
      }),

    session: (
      workspaceId: string,
      sessionId: string,
    ): Promise<AgentSessionSummary> =>
      request(`/api/v1/workspaces/${workspaceId}/agent-sessions/${sessionId}`),

    repositories: (workspaceId: string): Promise<RepositorySummary[]> =>
      request(`/api/v1/workspaces/${workspaceId}/repositories`),

    repository: (
      workspaceId: string,
      repositoryId: string,
    ): Promise<RepositorySummary> =>
      request(`/api/v1/workspaces/${workspaceId}/repositories/${repositoryId}`),

    pullRequests: (
      workspaceId: string,
      params?: PrFilterParams,
    ): Promise<Paginated<PullRequestSummary>> =>
      request(`/api/v1/workspaces/${workspaceId}/pull-requests`, {
        query: params,
      }),

    metrics: (
      workspaceId: string,
      params?: MetricFilterParams,
    ): Promise<Paginated<MetricSummary>> =>
      request(`/api/v1/workspaces/${workspaceId}/metrics`, { query: params }),

    alerts: (
      workspaceId: string,
      params?: AlertFilterParams,
    ): Promise<Paginated<AlertSummary>> =>
      request(`/api/v1/workspaces/${workspaceId}/alerts`, { query: params }),

    resolveAlert: (
      workspaceId: string,
      alertId: string,
    ): Promise<AlertSummary> =>
      request(`/api/v1/workspaces/${workspaceId}/alerts/${alertId}/resolve`, {
        method: "POST",
      }),

    tasks: (
      workspaceId: string,
      params?: TaskFilterParams,
    ): Promise<Paginated<TaskSummary>> =>
      request(`/api/v1/workspaces/${workspaceId}/tasks`, { query: params }),

    testRuns: (
      workspaceId: string,
      params?: TestRunFilterParams,
    ): Promise<Paginated<TestRunSummary>> =>
      request(`/api/v1/workspaces/${workspaceId}/test-runs`, { query: params }),

    developerStats: (
      workspaceId: string,
      developerId: string,
    ): Promise<Record<string, unknown>> =>
      request(
        `/api/v1/workspaces/${workspaceId}/developers/${developerId}/stats`,
      ),

    mapOverlay: (
      workspaceId: string,
      developerId: string,
    ): Promise<MapOverlay> =>
      request(`/api/v1/workspaces/${workspaceId}/map/overlay/${developerId}`),
  },

  models: {
    list: (): Promise<ModelSummary[]> => request("/api/v1/models"),
  },

  livekit: {
    token: (
      workspaceId: string,
    ): Promise<{ url: string; token: string; room: string }> =>
      request(`/api/v1/workspaces/${workspaceId}/livekit/token`, {
        method: "POST",
      }),
  },

  /* ── pair sessions ── */
  pairSessions: {
    active: (workspaceId: string): Promise<{ session: PairSession | null }> =>
      request(`/api/v1/workspaces/${workspaceId}/pair-sessions/active`),

    create: (
      workspaceId: string,
      input: PairSessionCreate,
    ): Promise<{ session: PairSession }> =>
      request(`/api/v1/workspaces/${workspaceId}/pair-sessions`, {
        method: "POST",
        body: input,
      }),

    end: (workspaceId: string, sessionId: string): Promise<{ session: null }> =>
      request(
        `/api/v1/workspaces/${workspaceId}/pair-sessions/${sessionId}/end`,
        { method: "PATCH" },
      ),
  },

  /* ── chat ── */
  chat: {
    list: (workspaceId: string): Promise<ConversationSummary[]> =>
      request(`/api/v1/workspaces/${workspaceId}/conversations`),

    create: (
      workspaceId: string,
      input: { memberIds: string[]; title?: string },
    ): Promise<ConversationSummary> =>
      request(`/api/v1/workspaces/${workspaceId}/conversations`, {
        method: "POST",
        body: input,
      }),

    messages: (
      workspaceId: string,
      conversationId: string,
      before?: string,
    ): Promise<ChatMessageDto[]> => {
      const q = before ? `?before=${encodeURIComponent(before)}` : "";
      return request(
        `/api/v1/workspaces/${workspaceId}/conversations/${conversationId}/messages${q}`,
      );
    },

    markRead: (workspaceId: string, conversationId: string): Promise<void> =>
      request(
        `/api/v1/workspaces/${workspaceId}/conversations/${conversationId}/read`,
        { method: "POST" },
      ),
  },
};

export type { RequestOptions };
