import {
  prisma,
  PRStatus,
  RepositoryProvider,
  type GitHubAccount,
  type Repository,
} from "@hive/db";
import type { RealtimeEvent } from "@hive/types";
import { createHmac } from "node:crypto";
import { env } from "../../config/env";
import { encryptSecret, decryptSecret } from "../../lib/encryption";
import {
  GitHubClient,
  OAUTH_SCOPES,
  type GitHubEmail,
  type GitHubRepo,
  type GitHubUser,
} from "../../lib/github";
import { signOAuthState, verifyOAuthState } from "../../lib/jwt";
import { safeEqual } from "../../lib/crypto";
import {
  AuthService,
  type SessionContext,
  type SessionResult,
} from "../auth/auth.service";
import { WebAccountRequiredError } from "../../core/errors";
import { realtimeBus } from "../realtime/realtime.bus";
import { IssueLinksService } from "../issues/issue-links";

interface GitHubPushPayload {
  ref?: string;
  after?: string;
  head_commit?: { id?: string } | null;
  commits?: { id?: string; message?: string; timestamp?: string }[];
  repository?: GitHubRepoPayload;
}

interface GitHubPullRequestPayload {
  action?: string;
  number?: number;
  repository?: GitHubRepoPayload;
  pull_request?: {
    number?: number;
    title?: string;
    html_url?: string | null;
    draft?: boolean;
    merged?: boolean;
    merged_at?: string | null;
    closed_at?: string | null;
    head?: { ref?: string | null };
    base?: { ref?: string | null };
  };
}

interface GitHubIssuePayload {
  action?: string;
  repository?: GitHubRepoPayload;
  issue?: {
    number?: number;
    title?: string;
    body?: string | null;
    html_url?: string | null;
    state?: string;
    created_at?: string;
    closed_at?: string | null;
    updated_at?: string;
    user?: { login?: string };
    labels?: { name?: string }[];
    assignees?: { login?: string }[];
  };
}

interface GitHubRepoPayload {
  id?: number;
  name?: string;
  full_name?: string;
  html_url?: string | null;
  default_branch?: string | null;
  owner?: { login?: string; id?: number };
}

export interface GitHubWebhookResult {
  statusCode: number;
}

export class GitHubService {
  constructor(
    private readonly client: GitHubClient = new GitHubClient({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      redirectUri: env.GITHUB_OAUTH_REDIRECT_URI,
    }),
    private readonly authService = new AuthService(),
  ) {}

  buildLoginUrl(next: string): string {
    return this.client.buildAuthorizeUrl(signOAuthState(next));
  }

  async handleCallback(input: {
    code: string;
    state: string;
    existingUserId?: string;
    ctx: SessionContext;
  }): Promise<{ session: SessionResult; next: string }> {
    const statePayload = verifyOAuthState(input.state);
    const token = await this.client.exchangeCodeForToken(input.code);
    const session = await this.exchangeUserToken(
      token.access_token,
      input.ctx,
      {
        existingUserId: input.existingUserId,
        scopes: token.scope.split(" ").filter(Boolean),
      },
    );
    return { session, next: statePayload.next };
  }

  /**
   * Turn a GitHub user access token (from the browser flow or the CLI device
   * flow) into a Hive session: resolve the GitHub user, link or provision the
   * Hive account, and store the token for webhooks. The device flow is a
   * public client, so `existingUserId` is undefined and `scopes` falls back to
   * the app's default scopes.
   */
  async exchangeUserToken(
    githubAccessToken: string,
    ctx: SessionContext,
    opts: {
      existingUserId?: string;
      scopes?: string[];
      provisionIfMissing?: boolean;
    } = {},
  ): Promise<SessionResult> {
    const [ghUser, emails] = await Promise.all([
      this.client.getUser(githubAccessToken),
      this.client.getUserEmails(githubAccessToken),
    ]);

    const userId = await this.linkOrProvisionUser(
      ghUser,
      emails,
      opts.existingUserId,
      opts.provisionIfMissing ?? true,
    );
    await this.upsertAccount(
      ghUser,
      emails,
      userId,
      opts.scopes ?? OAUTH_SCOPES,
      githubAccessToken,
    );

    return this.authService.issueSession(userId, ctx);
  }

  private async linkOrProvisionUser(
    ghUser: GitHubUser,
    emails: GitHubEmail[],
    existingUserId?: string,
    provisionIfMissing = true,
  ): Promise<string> {
    const primaryEmail =
      emails.find((email) => email.primary && email.verified)?.email ??
      ghUser.email;

    let userId = existingUserId;
    if (!userId) {
      if (primaryEmail) {
        const byEmail = await prisma.user.findUnique({
          where: { email: primaryEmail.toLowerCase() },
        });
        userId = byEmail?.id;
      }
      if (!userId && !provisionIfMissing) {
        throw new WebAccountRequiredError(
          primaryEmail ?? ghUser.login,
          env.clientOrigins[0] ?? env.API_URL,
        );
      }
      if (!userId) {
        userId = await this.authService.provisionUser({
          email:
            primaryEmail ??
            `${ghUser.id}+${ghUser.login}@users.noreply.github.com`,
          name: ghUser.name ?? ghUser.login,
          avatarUrl: ghUser.avatar_url,
        });
      }
    }
    return userId;
  }

  private async upsertAccount(
    ghUser: GitHubUser,
    emails: GitHubEmail[],
    userId: string,
    scopes: string[],
    accessToken: string,
  ): Promise<void> {
    const primaryEmail =
      emails.find((email) => email.primary && email.verified)?.email ??
      ghUser.email;
    await prisma.gitHubAccount.upsert({
      where: { githubId: ghUser.id },
      create: {
        userId,
        githubId: ghUser.id,
        login: ghUser.login,
        name: ghUser.name,
        email: primaryEmail,
        avatarUrl: ghUser.avatar_url,
        accessToken: encryptSecret(accessToken),
        scopes,
      },
      update: {
        userId,
        login: ghUser.login,
        name: ghUser.name,
        email: primaryEmail,
        avatarUrl: ghUser.avatar_url,
        accessToken: encryptSecret(accessToken),
        scopes,
        lastSyncedAt: new Date(),
      },
    });
  }

  async disconnect(userId: string): Promise<void> {
    await prisma.gitHubAccount.deleteMany({ where: { userId } });
  }

  /**
   * List the user's GitHub repos where they have admin access. Requires the
   * user to have connected GitHub. Returns an empty array if not connected.
   */
  async listUserRepos(userId: string): Promise<GitHubRepo[]> {
    const account = await prisma.gitHubAccount.findFirst({
      where: { userId },
    });
    if (!account) return [];
    const accessToken = decryptSecret(account.accessToken);
    return this.client.listAdminRepos(accessToken);
  }

  async handleWebhook(input: {
    event?: string;
    deliveryId?: string;
    signature?: string;
    rawBody: Buffer;
  }): Promise<GitHubWebhookResult> {
    let payload: unknown;
    try {
      payload = JSON.parse(input.rawBody.toString("utf8"));
    } catch {
      await this.recordDelivery(input, "ERROR", "Malformed JSON body", null);
      return { statusCode: 400 };
    }

    const verified = await this.verifyAndResolve(payload, input);
    if (!verified) {
      await this.recordDelivery(
        input,
        "REJECTED",
        "Invalid signature",
        payload,
      );
      return { statusCode: 401 };
    }

    try {
      await this.dispatch(input.event, payload);
      await this.recordDelivery(input, "VERIFIED", null, payload);
      return { statusCode: 204 };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Webhook handler failed";
      await this.recordDelivery(input, "ERROR", message, payload);
      return { statusCode: 500 };
    }
  }

  /**
   * Verify the webhook signature against the per-workspace secret. Falls
   * back to the deprecated global `GITHUB_WEBHOOK_SECRET` env var for
   * backward compatibility.
   */
  private async verifyAndResolve(
    payload: unknown,
    input: { signature?: string; rawBody: Buffer },
  ): Promise<boolean> {
    if (!input.signature) return false;

    const repoPayload = (payload as { repository?: GitHubRepoPayload })
      ?.repository;
    if (repoPayload) {
      const secret = await this.findSecretForRepo(repoPayload);
      if (
        secret &&
        this.verifyWithSecret(input.rawBody, input.signature, secret)
      ) {
        return true;
      }
    }

    return this.verifyWithSecret(
      input.rawBody,
      input.signature,
      env.GITHUB_WEBHOOK_SECRET,
    );
  }

  private async findSecretForRepo(
    repoPayload: GitHubRepoPayload,
  ): Promise<string | null> {
    const githubRepoId = repoPayload.id;
    const githubFullName = repoPayload.full_name ?? "";
    if (!githubRepoId && !githubFullName) return null;

    const existing = await prisma.repository.findFirst({
      where: {
        OR: [
          ...(githubRepoId ? [{ githubRepoId }] : []),
          ...(githubFullName ? [{ githubFullName }] : []),
        ],
      },
      select: { workspaceId: true },
    });

    if (existing?.workspaceId) {
      const ws = await prisma.workspace.findUnique({
        where: { id: existing.workspaceId },
        select: { webhookSecret: true },
      });
      if (ws) return ws.webhookSecret;
    }

    const account = await this.resolveAccount(repoPayload);
    if (!account) return null;
    const workspaceId = await this.primaryWorkspaceFor(account.userId);
    if (!workspaceId) return null;
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { webhookSecret: true },
    });
    return ws?.webhookSecret ?? null;
  }

  private verifyWithSecret(
    body: Buffer,
    signatureHeader: string,
    secret: string,
  ): boolean {
    if (!secret) return false;
    const expected =
      "sha256=" +
      createHmac("sha256", secret).update(new Uint8Array(body)).digest("hex");
    return safeEqual(expected, signatureHeader);
  }

  private async recordDelivery(
    input: { event?: string; deliveryId?: string; signature?: string },
    status: string,
    error: string | null,
    payload: unknown,
  ): Promise<void> {
    await prisma.webhookDelivery.create({
      data: {
        provider: "github",
        event: input.event ?? "unknown",
        deliveryId: input.deliveryId,
        signature: input.signature,
        status,
        error,
        payload: payload ?? undefined,
      },
    });
  }

  private async dispatch(
    event: string | undefined,
    payload: unknown,
  ): Promise<void> {
    switch (event) {
      case "push":
        await this.handlePush(payload as GitHubPushPayload);
        break;
      case "pull_request":
        await this.handlePullRequest(payload as GitHubPullRequestPayload);
        break;
      case "issues":
      case "issue_comment":
        await this.handleIssue(payload as GitHubIssuePayload);
        break;
      case "ping":
        break;
      default:
        break;
    }
  }

  private async handlePush(payload: GitHubPushPayload): Promise<void> {
    if (!payload.repository?.id) return;
    const account = await this.resolveAccount(payload.repository);
    const repo = await this.findOrCreateRepository(payload.repository, account);

    const branchName = (payload.ref ?? "").replace("refs/heads/", "") || "HEAD";
    const headSha = payload.head_commit?.id ?? payload.after ?? "";

    await prisma.branch.upsert({
      where: { repositoryId_name: { repositoryId: repo.id, name: branchName } },
      create: {
        repositoryId: repo.id,
        name: branchName,
        lastCommitSha: headSha || null,
      },
      update: { lastCommitSha: headSha || null },
    });
    await IssueLinksService.linkBranch(repo.id, branchName);

    for (const commit of payload.commits ?? []) {
      if (!commit.id) continue;
      await prisma.commit.upsert({
        where: { repositoryId_sha: { repositoryId: repo.id, sha: commit.id } },
        create: {
          repositoryId: repo.id,
          sha: commit.id,
          message: commit.message ?? "",
          authoredAt: this.safeDate(commit.timestamp) ?? undefined,
        },
        update: { message: commit.message ?? "" },
      });
      await IssueLinksService.linkCommit(
        repo.id,
        commit.id,
        commit.message ?? "",
      );
    }

    await prisma.repository.update({
      where: { id: repo.id },
      data: {
        lastSyncedAt: new Date(),
        defaultBranch: payload.repository.default_branch ?? repo.defaultBranch,
      },
    });

    if (repo.workspaceId) {
      const event: RealtimeEvent = {
        type: "repo.push",
        workspaceId: repo.workspaceId,
        repositoryId: repo.id,
        repoName: repo.name,
        branch: branchName,
        commitCount: payload.commits?.length ?? 0,
        headSha,
        timestamp: Date.now(),
      };
      realtimeBus.publish(repo.workspaceId, event);
    }
  }

  private async handlePullRequest(
    payload: GitHubPullRequestPayload,
  ): Promise<void> {
    const pr = payload.pull_request;
    if (!payload.repository?.id || !pr?.number) return;

    const account = await this.resolveAccount(payload.repository);
    const repo = await this.findOrCreateRepository(payload.repository, account);

    const status: PRStatus =
      payload.action === "closed"
        ? pr.merged
          ? PRStatus.MERGED
          : PRStatus.CLOSED
        : pr.draft
          ? PRStatus.DRAFT
          : PRStatus.OPEN;

    const upserted = await prisma.pullRequest.upsert({
      where: {
        repositoryId_number: { repositoryId: repo.id, number: pr.number },
      },
      create: {
        repositoryId: repo.id,
        number: pr.number,
        title: pr.title ?? "",
        status,
        url: pr.html_url ?? null,
        headBranch: pr.head?.ref ?? null,
        baseBranch: pr.base?.ref ?? null,
        mergedAt: this.safeDate(pr.merged_at),
        closedAt: this.safeDate(pr.closed_at),
      },
      update: {
        title: pr.title ?? "",
        status,
        url: pr.html_url ?? null,
        headBranch: pr.head?.ref ?? null,
        baseBranch: pr.base?.ref ?? null,
        mergedAt: this.safeDate(pr.merged_at),
        closedAt: this.safeDate(pr.closed_at),
      },
    });

    if (repo.workspaceId) {
      const event: RealtimeEvent = {
        type: "pr.updated",
        workspaceId: repo.workspaceId,
        repositoryId: repo.id,
        repoName: repo.name,
        prNumber: pr.number,
        title: upserted.title,
        status: upserted.status,
        timestamp: Date.now(),
      };
      realtimeBus.publish(repo.workspaceId, event);
    }
  }

  private async handleIssue(payload: GitHubIssuePayload): Promise<void> {
    const ghIssue = payload.issue;
    if (!payload.repository?.id || !ghIssue?.number) return;

    const account = await this.resolveAccount(payload.repository);
    const repo = await this.findOrCreateRepository(payload.repository, account);

    const state = ghIssue.state === "closed" ? "closed" : "open";
    await prisma.issue.upsert({
      where: {
        repositoryId_number: { repositoryId: repo.id, number: ghIssue.number },
      },
      create: {
        repositoryId: repo.id,
        number: ghIssue.number,
        title: ghIssue.title ?? "",
        state,
        body: ghIssue.body ?? null,
        url: ghIssue.html_url ?? null,
        authorLogin: ghIssue.user?.login ?? null,
        labels: (ghIssue.labels ?? [])
          .map((l) => l.name)
          .filter((n): n is string => Boolean(n)),
        assignees: (ghIssue.assignees ?? [])
          .map((a) => a.login)
          .filter((n): n is string => Boolean(n)),
        openedAt: this.safeDate(ghIssue.created_at) ?? new Date(),
        closedAt: this.safeDate(ghIssue.closed_at),
      },
      update: {
        title: ghIssue.title ?? "",
        state,
        body: ghIssue.body ?? null,
        url: ghIssue.html_url ?? null,
        authorLogin: ghIssue.user?.login ?? null,
        labels: (ghIssue.labels ?? [])
          .map((l) => l.name)
          .filter((n): n is string => Boolean(n)),
        assignees: (ghIssue.assignees ?? [])
          .map((a) => a.login)
          .filter((n): n is string => Boolean(n)),
        closedAt: this.safeDate(ghIssue.closed_at),
      },
    });

    await IssueLinksService.relinkIssue(repo.id, ghIssue.number);
  }

  private async resolveAccount(
    repo: GitHubRepoPayload,
  ): Promise<GitHubAccount | null> {
    const ownerLogin = repo.owner?.login;
    const ownerId = repo.owner?.id;
    if (!ownerLogin && !ownerId) return null;
    return prisma.gitHubAccount.findFirst({
      where: {
        OR: [
          ...(ownerId ? [{ githubId: ownerId }] : []),
          ...(ownerLogin ? [{ login: ownerLogin }] : []),
        ],
      },
    });
  }

  private async findOrCreateRepository(
    payloadRepo: GitHubRepoPayload,
    account: GitHubAccount | null,
  ): Promise<Repository> {
    const githubRepoId = payloadRepo.id;
    const githubFullName = payloadRepo.full_name ?? "";
    const existing = await prisma.repository.findFirst({
      where: {
        OR: [
          ...(githubRepoId ? [{ githubRepoId }] : []),
          ...(githubFullName ? [{ githubFullName }] : []),
        ],
      },
    });
    if (existing) return existing;

    const workspaceId = account
      ? await this.primaryWorkspaceFor(account.userId)
      : null;

    return prisma.repository.create({
      data: {
        workspaceId,
        name: payloadRepo.name ?? githubFullName.split("/").pop() ?? "repo",
        url: payloadRepo.html_url ?? null,
        provider: RepositoryProvider.GITHUB,
        defaultBranch: payloadRepo.default_branch ?? null,
        githubRepoId,
        githubFullName: githubFullName || null,
        githubAccountId: account?.id ?? null,
      },
    });
  }

  private async primaryWorkspaceFor(userId: string): Promise<string | null> {
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return membership?.workspaceId ?? null;
  }

  private safeDate(value?: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
