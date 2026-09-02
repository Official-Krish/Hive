import {
  prisma,
  PRStatus,
  RepositoryProvider,
  GitHubNotificationType,
  type GitHubAccount,
  type Repository,
} from "@hive/db";
import type { RealtimeEvent } from "@hive/types";
import { createHmac, randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { encryptSecret, decryptSecret } from "../../lib/encryption";
import {
  GitHubClient,
  GitHubAppClient,
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
import {
  WebAccountRequiredError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../core/errors";
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
    user?: { id?: number; login?: string };
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
  comment?: {
    id?: number;
    body?: string | null;
    html_url?: string | null;
    user?: { login?: string };
  };
}

interface GitHubReleasePayload {
  action?: string;
  repository?: GitHubRepoPayload;
  release?: {
    tag_name?: string;
    name?: string | null;
    body?: string | null;
    html_url?: string | null;
  };
}

interface GitHubPullRequestReviewPayload {
  action?: string;
  repository?: GitHubRepoPayload;
  pull_request?: {
    number?: number;
    title?: string | null;
    html_url?: string | null;
  };
  review?: {
    id?: number;
    state?: string;
    body?: string | null;
    html_url?: string | null;
    user?: { login?: string };
  };
}

interface GitHubPullRequestReviewCommentPayload {
  action?: string;
  repository?: GitHubRepoPayload;
  pull_request?: {
    number?: number;
    title?: string | null;
    html_url?: string | null;
  };
  comment?: {
    id?: number;
    body?: string | null;
    html_url?: string | null;
    user?: { login?: string };
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

  /* ── GitHub App installation (workspace / repository access) ──────────── */

  private appClient(): GitHubAppClient {
    if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
      throw new BadRequestError("GitHub App is not configured on the server.");
    }
    return new GitHubAppClient({
      appId: env.GITHUB_APP_ID,
      appSlug: env.GITHUB_APP_SLUG,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
    });
  }

  /** Build the GitHub App install URL for a workspace (state is signed). */
  buildAppInstallUrl(workspaceId: string): string {
    return this.appClient().buildInstallUrl(signOAuthState(workspaceId));
  }

  /**
   * Complete an App installation from GitHub's redirect: verify the signed
   * state, ensure the caller is an admin/owner of the target workspace, then
   * fetch the installation's repos and upsert them + the installation record.
   */
  async completeAppInstallation(input: {
    userId: string;
    installationId: string;
    state: string;
  }): Promise<{ workspaceId: string }> {
    const statePayload = verifyOAuthState(input.state);
    const workspaceId = statePayload.next;
    if (!workspaceId) {
      throw new BadRequestError("Missing workspace in install state.");
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: input.userId,
        role: { in: ["OWNER", "ADMIN"] },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenError(
        "You must be a workspace admin to install the GitHub App.",
      );
    }

    const client = this.appClient();
    await client.getInstallationToken(input.installationId);
    const repos = await client.listInstallationRepos(input.installationId);

    await prisma.$transaction(async (tx) => {
      for (const repo of repos) {
        await tx.repository.upsert({
          where: { githubRepoId: repo.id },
          create: {
            workspaceId,
            name: repo.name,
            url: repo.html_url,
            provider: RepositoryProvider.GITHUB,
            githubRepoId: repo.id,
            githubFullName: repo.full_name,
            lastSyncedAt: new Date(),
          },
          update: {
            workspaceId,
            name: repo.name,
            url: repo.html_url,
            provider: RepositoryProvider.GITHUB,
            githubFullName: repo.full_name,
            lastSyncedAt: new Date(),
          },
        });
      }

      const repoJson = repos.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
      }));

      await tx.gitHubInstallation.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          installationId: input.installationId,
          githubAppId: env.GITHUB_APP_ID,
          repositories: repoJson,
          webhookSecret: env.GITHUB_APP_WEBHOOK_SECRET,
        },
        update: {
          installationId: input.installationId,
          repositories: repoJson,
          webhookSecret: env.GITHUB_APP_WEBHOOK_SECRET,
          updatedAt: new Date(),
        },
      });
    });

    return { workspaceId };
  }

  /** List GitHub App installations for a workspace (at most one). */
  async listInstallations(workspaceId: string) {
    const installations = await prisma.gitHubInstallation.findMany({
      where: { workspaceId },
      select: {
        id: true,
        installationId: true,
        githubAppId: true,
        repositories: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return installations.map((inst) => ({
      id: inst.id,
      installationId: inst.installationId,
      githubAppId: inst.githubAppId,
      repositoryCount: Array.isArray(inst.repositories)
        ? inst.repositories.length
        : 0,
      createdAt: inst.createdAt,
      updatedAt: inst.updatedAt,
    }));
  }

  /** Remove a GitHub App installation from a workspace. */
  async deleteInstallation(workspaceId: string, installationDbId: string) {
    const installation = await prisma.gitHubInstallation.findFirst({
      where: { id: installationDbId, workspaceId },
      select: { id: true },
    });
    if (!installation) {
      throw new NotFoundError("GitHub App installation not found.");
    }
    await prisma.gitHubInstallation.delete({ where: { id: installation.id } });
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
      if (ws?.webhookSecret) return ws.webhookSecret;
      const instSecret = await this.installationSecretForWorkspace(
        existing.workspaceId,
      );
      if (instSecret) return instSecret;
    }

    // Only repos already linked to a workspace (via GitHub App install or
    // manual link) may resolve a webhook secret. Unlinked repos are ignored.
    return null;
  }

  private async installationSecretForWorkspace(
    workspaceId: string,
  ): Promise<string | null> {
    const installation = await prisma.gitHubInstallation.findFirst({
      where: { workspaceId },
      select: { webhookSecret: true },
    });
    return installation?.webhookSecret ?? null;
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
        await this.handleIssue(event, payload as GitHubIssuePayload);
        break;
      case "release":
        await this.handleRelease(payload as GitHubReleasePayload);
        break;
      case "pull_request_review":
        await this.handlePullRequestReview(
          payload as GitHubPullRequestReviewPayload,
        );
        break;
      case "pull_request_review_comment":
        await this.handlePullRequestReviewComment(
          payload as GitHubPullRequestReviewCommentPayload,
        );
        break;
      case "ping":
        break;
      default:
        break;
    }
  }

  private async handlePush(payload: GitHubPushPayload): Promise<void> {
    if (!payload.repository?.id) return;
    const repo = await this.findOrCreateRepository(payload.repository);
    if (!repo) return;

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
    const repo = await this.findOrCreateRepository(payload.repository);
    if (!repo) return;

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
      const author = pr.user
        ? await prisma.gitHubAccount.findFirst({
            where: {
              OR: [
                ...(pr.user.id ? [{ githubId: pr.user.id }] : []),
                ...(pr.user.login ? [{ login: pr.user.login }] : []),
              ],
            },
            select: { userId: true, login: true },
          })
        : null;
      const event: RealtimeEvent = {
        type: "pr.updated",
        workspaceId: repo.workspaceId,
        repositoryId: repo.id,
        repoName: repo.name,
        prNumber: pr.number,
        title: upserted.title,
        status: upserted.status,
        authorId: author?.userId ?? null,
        authorName: author?.login ?? pr.user?.login ?? null,
        timestamp: Date.now(),
      };
      realtimeBus.publish(repo.workspaceId, event);

      const ghType = this.mapPrAction(payload.action, pr.merged);
      if (ghType) {
        await this.notifyWorkspace(repo.workspaceId, account?.userId ?? null, {
          type: ghType,
          title: `PR #${pr.number}: ${upserted.title}`,
          body: null,
          repository: repo.githubFullName ?? repo.name,
          url: pr.html_url ?? null,
        });
      }
    }
  }

  private async handleIssue(
    event: string | undefined,
    payload: GitHubIssuePayload,
  ): Promise<void> {
    const ghIssue = payload.issue;
    if (!payload.repository?.id || !ghIssue?.number) return;

    const account = await this.resolveAccount(payload.repository);
    const repo = await this.findOrCreateRepository(payload.repository);
    if (!repo) return;

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

    if (repo.workspaceId) {
      const ghType = this.mapIssueAction(event, payload.action);
      if (ghType) {
        await this.notifyWorkspace(repo.workspaceId, account?.userId ?? null, {
          type: ghType,
          title: `Issue #${ghIssue.number}: ${ghIssue.title ?? ""}`,
          body: null,
          repository: repo.githubFullName ?? repo.name,
          url: ghIssue.html_url ?? null,
        });
      }

      if (event === "issue_comment" && payload.comment?.body) {
        await this.notifyMentions(repo.workspaceId, payload.comment.body, {
          type: GitHubNotificationType.ISSUE_MENTION,
          title: `You were mentioned on Issue #${ghIssue.number}: ${
            ghIssue.title ?? ""
          }`,
          body: payload.comment.body,
          repository: repo.githubFullName ?? repo.name,
          url: payload.comment.html_url ?? ghIssue.html_url ?? null,
        });
      }
    }
  }

  private async handleRelease(payload: GitHubReleasePayload): Promise<void> {
    const release = payload.release;
    if (!payload.repository?.id || !release?.tag_name) return;

    const account = await this.resolveAccount(payload.repository);
    const repo = await this.findOrCreateRepository(payload.repository);
    if (!repo) return;

    if (repo.workspaceId) {
      await this.notifyWorkspace(repo.workspaceId, account?.userId ?? null, {
        type: GitHubNotificationType.RELEASE_PUBLISHED,
        title: `Release ${release.tag_name}${
          release.name ? `: ${release.name}` : ""
        }`,
        body: release.body ?? null,
        repository: repo.githubFullName ?? repo.name,
        url: release.html_url ?? null,
      });
    }
  }

  private async handlePullRequestReview(
    payload: GitHubPullRequestReviewPayload,
  ): Promise<void> {
    const review = payload.review;
    const pr = payload.pull_request;
    if (!payload.repository?.id || !pr?.number || !review?.id) return;

    const account = await this.resolveAccount(payload.repository);
    const repo = await this.findOrCreateRepository(payload.repository);
    if (!repo) return;
    if (!repo.workspaceId) return;
    await this.notifyWorkspace(repo.workspaceId, account?.userId ?? null, {
      type: GitHubNotificationType.PR_REVIEW_SUBMITTED,
      title: `Review on PR #${pr.number}: ${
        pr.title ?? ""
      } (${review.state ?? "review"})`,
      body: review.body ?? null,
      repository: repo.githubFullName ?? repo.name,
      url: review.html_url ?? pr.html_url ?? null,
    });
    if (review.body) {
      await this.notifyMentions(repo.workspaceId, review.body, {
        type: GitHubNotificationType.ISSUE_MENTION,
        title: `You were mentioned in a review on PR #${pr.number}`,
        body: review.body,
        repository: repo.githubFullName ?? repo.name,
        url: review.html_url ?? pr.html_url ?? null,
      });
    }
  }

  private async handlePullRequestReviewComment(
    payload: GitHubPullRequestReviewCommentPayload,
  ): Promise<void> {
    const comment = payload.comment;
    const pr = payload.pull_request;
    if (!payload.repository?.id || !pr?.number || !comment?.id) return;

    const account = await this.resolveAccount(payload.repository);
    const repo = await this.findOrCreateRepository(payload.repository);
    if (!repo) return;
    if (!repo.workspaceId) return;
    await this.notifyWorkspace(repo.workspaceId, account?.userId ?? null, {
      type: GitHubNotificationType.PR_REVIEW_COMMENT,
      title: `Comment on PR #${pr.number}: ${pr.title ?? ""}`,
      body: comment.body ?? null,
      repository: repo.githubFullName ?? repo.name,
      url: comment.html_url ?? pr.html_url ?? null,
    });
    if (comment.body) {
      await this.notifyMentions(repo.workspaceId, comment.body, {
        type: GitHubNotificationType.ISSUE_MENTION,
        title: `You were mentioned in a review comment on PR #${pr.number}`,
        body: comment.body,
        repository: repo.githubFullName ?? repo.name,
        url: comment.html_url ?? pr.html_url ?? null,
      });
    }
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
  ): Promise<Repository | null> {
    const githubRepoId = payloadRepo.id;
    const githubFullName = payloadRepo.full_name ?? "";
    if (!githubRepoId && !githubFullName) return null;
    // Repos must be linked (GitHub App install or manual link) before their
    // webhooks are processed — never auto-provision an unlinked repo row here.
    return prisma.repository.findFirst({
      where: {
        OR: [
          ...(githubRepoId ? [{ githubRepoId }] : []),
          ...(githubFullName ? [{ githubFullName }] : []),
        ],
      },
    });
  }

  private safeDate(value?: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /**
   * Create a GitHubNotification row for every member of the workspace and
   * broadcast a live `github.notification` event so the worldmap bell updates
   * in real time. `accountUserId` is the GitHub connector (used as the event's
   * recipient hint); falls back to the first member when unknown.
   */
  private async notifyWorkspace(
    workspaceId: string | null,
    accountUserId: string | null,
    input: {
      type: GitHubNotificationType;
      title: string;
      body: string | null;
      repository: string;
      url: string | null;
    },
  ): Promise<void> {
    if (!workspaceId) return;
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    });
    if (members.length === 0) return;

    const now = new Date();
    await prisma.gitHubNotification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        workspaceId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: { repository: input.repository, url: input.url },
        createdAt: now,
      })),
    });

    const event: RealtimeEvent = {
      type: "github.notification",
      workspaceId,
      developerId: accountUserId ?? members[0]!.userId,
      notification: {
        id: randomUUID(),
        type: input.type,
        title: input.title,
        body: input.body,
        repository: input.repository,
        url: input.url ?? "",
        createdAt: now.toISOString(),
      },
      timestamp: Date.now(),
    };
    realtimeBus.publish(workspaceId, event);
  }

  private mapPrAction(
    action?: string,
    merged?: boolean | null,
  ): GitHubNotificationType | null {
    switch (action) {
      case "opened":
      case "reopened":
        return GitHubNotificationType.PR_OPENED;
      case "closed":
        return merged
          ? GitHubNotificationType.PR_MERGED
          : GitHubNotificationType.PR_CLOSED;
      case "review_requested":
        return GitHubNotificationType.PR_REVIEW_REQUESTED;
      default:
        return null;
    }
  }

  private mapIssueAction(
    event: string | undefined,
    action?: string,
  ): GitHubNotificationType | null {
    if (event === "issue_comment") return GitHubNotificationType.ISSUE_COMMENT;
    switch (action) {
      case "assigned":
        return GitHubNotificationType.ISSUE_ASSIGNED;
      case "closed":
        return GitHubNotificationType.ISSUE_CLOSED;
      default:
        return null;
    }
  }

  /**
   * Notify only the workspace members whose GitHub login is @mentioned in the
   * given text. Used for `ISSUE_MENTION` notifications derived from comment
   * and review bodies (GitHub has no dedicated "mention" webhook event).
   */
  private async notifyMentions(
    workspaceId: string,
    text: string,
    input: {
      type: GitHubNotificationType;
      title: string;
      body: string | null;
      repository: string;
      url: string | null;
    },
  ): Promise<void> {
    const logins = this.extractMentions(text);
    if (logins.length === 0) return;

    const accounts = await prisma.gitHubAccount.findMany({
      where: { login: { in: logins } },
      select: { userId: true },
    });
    const userIds = accounts
      .map((a) => a.userId)
      .filter((id): id is string => Boolean(id));
    if (userIds.length === 0) return;

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: userIds } },
      select: { userId: true },
    });
    const targets = members.map((m) => m.userId);
    if (targets.length === 0) return;

    const now = new Date();
    await prisma.gitHubNotification.createMany({
      data: targets.map((userId) => ({
        userId,
        workspaceId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: { repository: input.repository, url: input.url },
        createdAt: now,
      })),
    });

    for (const userId of targets) {
      const event: RealtimeEvent = {
        type: "github.notification",
        workspaceId,
        developerId: userId,
        notification: {
          id: randomUUID(),
          type: input.type,
          title: input.title,
          body: input.body,
          repository: input.repository,
          url: input.url ?? "",
          createdAt: now.toISOString(),
        },
        timestamp: Date.now(),
      };
      realtimeBus.publish(workspaceId, event);
    }
  }

  private extractMentions(text: string): string[] {
    const matches = text.match(/@([a-zA-Z0-9-]+)/g) ?? [];
    return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
  }
}
