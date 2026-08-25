import { prisma, RepositoryProvider, UserRole } from "@hive/db";
import type {
  CreateGithubInviteInput,
  CreateInviteInput,
  CreateWorkspaceInput,
  InviteCreated,
  InviteSummary,
  ReceivedInvite,
  UpdateMemberRoleInput,
  UpdateWorkspaceInput,
  WorkspaceMemberPublic,
  WorkspaceSettings,
  WorkspaceSummary,
} from "@hive/types";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../core/errors";
import { env } from "../../config/env";
import { generateRandomToken, hashToken } from "../../lib/crypto";
import { decryptSecret } from "../../lib/encryption";
import { GitHubClient, type GitHubRepoDetail } from "../../lib/github";
import { slugify, uniqueSlug } from "../../lib/slug";
import { roleFromString, roleToString } from "../../middleware/workspace";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type WorkspaceWithCount = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  _count: { members: number };
};

export class WorkspaceService {
  constructor() {}

  async listMy(userId: string): Promise<WorkspaceSummary[]> {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            createdAt: true,
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return memberships.map((m) => this.summarize(m.workspace, m.role));
  }

  async get(workspaceId: string, userId: string): Promise<WorkspaceSummary> {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            createdAt: true,
            _count: { select: { members: true } },
          },
        },
      },
    });
    if (!membership) throw new NotFoundError("Workspace not found");
    return this.summarize(membership.workspace, membership.role);
  }

  async create(
    userId: string,
    input: CreateWorkspaceInput,
  ): Promise<WorkspaceSummary> {
    const orgId = await this.primaryOrgId(userId);
    const slug = await this.uniqueWorkspaceSlug(
      orgId,
      input.slug ?? slugify(input.name),
    );
    const webhookSecret =
      input.webhookSecret ?? generateRandomToken(16).toLowerCase();

    const workspace = await prisma.workspace.create({
      data: {
        orgId,
        name: input.name,
        slug,
        description: input.description,
        webhookSecret,
        members: { create: { userId, role: UserRole.OWNER } },
        privacySetting: { create: {} },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        webhookSecret: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });

    if (input.repositoryId) {
      await this.assignRepositoryInternal(
        userId,
        workspace.id,
        input.repositoryId,
      );
    }

    const summary = this.summarize(workspace, UserRole.OWNER);
    summary.webhookSecret = workspace.webhookSecret;
    return summary;
  }

  async getSettings(workspaceId: string): Promise<WorkspaceSettings> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        repositories: {
          where: { githubRepoId: { not: null } },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!workspace) throw new NotFoundError("Workspace not found");

    const repo = workspace.repositories[0];
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      webhookSecretMasked: this.maskSecret(workspace.webhookSecret),
      repository: repo
        ? {
            id: repo.id,
            name: repo.name,
            fullName: repo.githubFullName ?? repo.name,
            url: repo.url,
          }
        : null,
    };
  }

  async rotateSecret(
    workspaceId: string,
    userId: string,
  ): Promise<{ secret: string }> {
    await this.assertAdminOrOwner(workspaceId, userId);
    const newSecret = generateRandomToken(16).toLowerCase();
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { webhookSecret: newSecret },
    });
    return { secret: newSecret };
  }

  async assignRepository(
    workspaceId: string,
    userId: string,
    repositoryId: string,
  ): Promise<void> {
    await this.assertAdminOrOwner(workspaceId, userId);
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!ws) throw new NotFoundError("Workspace not found");
    await this.assignRepositoryInternal(userId, workspaceId, repositoryId);
  }

  private async assignRepositoryInternal(
    userId: string,
    workspaceId: string,
    repositoryId: string,
  ): Promise<void> {
    // The repo pickers expose GitHub's numeric ids, while Repository rows
    // (with cuid PKs) only come into existence via webhook pushes — so a
    // numeric id that matches no row must be imported on demand.
    const githubRepoId = Number(repositoryId);
    const isGithubId =
      repositoryId !== "" && Number.isInteger(githubRepoId) && githubRepoId > 0;

    const repo = await prisma.repository.findFirst({
      where: {
        OR: [{ id: repositoryId }, ...(isGithubId ? [{ githubRepoId }] : [])],
      },
    });
    if (repo) {
      await prisma.repository.update({
        where: { id: repo.id },
        data: { workspaceId },
      });
      return;
    }

    if (!isGithubId) throw new NotFoundError("Repository not found");
    const remote = await this.fetchAdminRepo(userId, githubRepoId);
    await prisma.repository.create({
      data: {
        workspaceId,
        name: remote.name || remote.full_name.split("/").pop() || "repo",
        url: remote.html_url,
        provider: RepositoryProvider.GITHUB,
        defaultBranch: remote.default_branch ?? null,
        githubRepoId: remote.id,
        githubFullName: remote.full_name || null,
      },
    });
  }

  /** Fetch the repo from GitHub with the caller's stored token and verify
   * they administer it before importing it into the workspace. */
  private async fetchAdminRepo(
    userId: string,
    githubRepoId: number,
  ): Promise<GitHubRepoDetail> {
    const account = await prisma.gitHubAccount.findFirst({ where: { userId } });
    if (!account) {
      throw new NotFoundError("Connect your GitHub account first");
    }
    let remote: GitHubRepoDetail;
    try {
      remote = await this.githubClient().getRepo(
        decryptSecret(account.accessToken),
        githubRepoId,
      );
    } catch {
      throw new NotFoundError(
        "Repository not found on your connected GitHub account",
      );
    }
    if (!remote.permissions?.admin) {
      throw new ForbiddenError("You need admin access to that repository");
    }
    return remote;
  }

  private githubClient(): GitHubClient {
    return new GitHubClient({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      redirectUri: env.GITHUB_OAUTH_REDIRECT_URI,
    });
  }

  private async assertAdminOrOwner(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (
      !member ||
      (member.role !== UserRole.OWNER && member.role !== UserRole.ADMIN)
    ) {
      throw new ForbiddenError("You don't have permission for this workspace");
    }
  }

  private maskSecret(secret: string): string {
    if (secret.length <= 8) return "****";
    return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
  }

  async update(
    workspaceId: string,
    role: "owner" | "admin" | "member",
    input: UpdateWorkspaceInput,
  ): Promise<WorkspaceSummary> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { orgId: true },
    });
    if (!workspace) throw new NotFoundError("Workspace not found");

    const data: {
      name?: string;
      slug?: string;
      description?: string | null;
    } = {};
    if (input.name) data.name = input.name;
    if (input.slug) {
      data.slug = await this.uniqueWorkspaceSlug(
        workspace.orgId,
        input.slug,
        workspaceId,
      );
    }
    if (input.description !== undefined) data.description = input.description;

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
    return this.summarize(updated, roleFromString(role));
  }

  async remove(workspaceId: string): Promise<void> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!workspace) throw new NotFoundError("Workspace not found");
    await prisma.workspace.delete({ where: { id: workspaceId } });
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMemberPublic[]> {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: roleToString(m.role),
      joinedAt: m.createdAt.toISOString(),
    }));
  }

  async changeMemberRole(
    workspaceId: string,
    targetUserId: string,
    input: UpdateMemberRoleInput,
  ): Promise<void> {
    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundError("Member not found");
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenError("Cannot change the workspace owner's role");
    }
    await prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role: roleFromString(input.role) },
    });
  }

  async removeMember(workspaceId: string, targetUserId: string): Promise<void> {
    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundError("Member not found");
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenError("Cannot remove the workspace owner");
    }
    await prisma.workspaceMember.delete({ where: { id: target.id } });
  }

  async invite(
    workspaceId: string,
    actorUserId: string,
    input: CreateInviteInput,
  ): Promise<InviteCreated> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { orgId: true },
    });
    if (!workspace) throw new NotFoundError("Workspace not found");

    const token = generateRandomToken(24);
    const invite = await prisma.invite.create({
      data: {
        orgId: workspace.orgId,
        workspaceId,
        email: input.email.toLowerCase(),
        role: input.role === "admin" ? UserRole.ADMIN : UserRole.MEMBER,
        tokenHash: hashToken(token),
        invitedById: actorUserId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
    return { invite: this.summarizeInvite(invite), token };
  }

  async inviteByGithubLogin(
    workspaceId: string,
    actorUserId: string,
    input: CreateGithubInviteInput,
  ): Promise<InviteCreated> {
    const account = await prisma.gitHubAccount.findFirst({
      where: { login: { equals: input.githubLogin, mode: "insensitive" } },
      select: { userId: true, user: { select: { email: true } } },
    });
    if (!account) {
      throw new NotFoundError("No Hive user is linked to that GitHub username");
    }

    const existing = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: account.userId },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError("That user is already a workspace member");
    }

    return this.invite(workspaceId, actorUserId, {
      email: account.user.email,
      role: input.role,
    });
  }

  async listReceivedInvites(userId: string): Promise<ReceivedInvite[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundError("User not found");

    const invites = await prisma.invite.findMany({
      where: {
        email: user.email.toLowerCase(),
        acceptedAt: null,
        revokedAt: null,
        workspaceId: { not: null },
      },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true, description: true },
        },
        org: { select: { id: true, name: true } },
        inviter: { select: { name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return invites.map((i) => ({
      id: i.id,
      role: roleToString(i.role),
      status: this.summarizeInvite(i).status,
      workspace: i.workspace
        ? {
            id: i.workspace.id,
            name: i.workspace.name,
            slug: i.workspace.slug,
            description: i.workspace.description,
          }
        : null,
      org: { id: i.org.id, name: i.org.name },
      invitedBy: i.inviter
        ? {
            name: i.inviter.name,
            email: i.inviter.email,
            avatarUrl: i.inviter.avatarUrl,
          }
        : null,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    }));
  }

  async listInvites(workspaceId: string): Promise<InviteSummary[]> {
    const invites = await prisma.invite.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return invites.map((i) => this.summarizeInvite(i));
  }

  async revokeInvite(workspaceId: string, inviteId: string): Promise<void> {
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.workspaceId !== workspaceId) {
      throw new NotFoundError("Invite not found");
    }
    await prisma.invite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });
  }

  async acceptInvite(token: string, userId: string): Promise<WorkspaceSummary> {
    const invite = await prisma.invite.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!invite) throw new NotFoundError("Invite not found");
    return this.acceptInviteRecord(invite, userId);
  }

  async acceptInviteById(
    inviteId: string,
    userId: string,
  ): Promise<WorkspaceSummary> {
    const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
    if (!invite) throw new NotFoundError("Invite not found");
    return this.acceptInviteRecord(invite, userId);
  }

  private async acceptInviteRecord(
    invite: {
      id: string;
      orgId: string;
      workspaceId: string | null;
      email: string;
      role: UserRole;
      expiresAt: Date;
      acceptedAt: Date | null;
      revokedAt: Date | null;
    },
    userId: string,
  ): Promise<WorkspaceSummary> {
    if (invite.revokedAt) throw new ForbiddenError("Invite has been revoked");
    if (invite.acceptedAt) {
      return this.get(invite.workspaceId ?? "", userId);
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenError("Invite has expired");
    }
    if (!invite.workspaceId) {
      throw new ConflictError("Invite is not scoped to a workspace");
    }
    const workspaceId = invite.workspaceId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user || user.email.toLowerCase() !== invite.email) {
      throw new ForbiddenError("This invite was issued to a different email");
    }

    const role = invite.role;
    await prisma.$transaction([
      prisma.organizationMember.upsert({
        where: {
          orgId_userId: { orgId: invite.orgId, userId },
        },
        create: { orgId: invite.orgId, userId, role },
        update: {},
      }),
      prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
        create: {
          workspaceId,
          userId,
          role,
        },
        update: {},
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return this.get(workspaceId, userId);
  }

  summarize(workspace: WorkspaceWithCount, role: UserRole): WorkspaceSummary {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
      role: roleToString(role),
      memberCount: workspace._count.members,
      createdAt: workspace.createdAt.toISOString(),
    };
  }

  private async primaryOrgId(userId: string): Promise<string> {
    const membership = await prisma.organizationMember.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { orgId: true },
    });
    if (membership) return membership.orgId;

    const org = await prisma.organization.create({
      data: { name: "My Organization", slug: uniqueSlug("org") },
    });
    await prisma.organizationMember.create({
      data: { orgId: org.id, userId, role: UserRole.OWNER },
    });
    return org.id;
  }

  private async uniqueWorkspaceSlug(
    orgId: string,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = slugify(base) || "workspace";
    const existing = await prisma.workspace.findFirst({
      where: { orgId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (existing) slug = uniqueSlug(base);
    return slug;
  }

  private summarizeInvite(invite: {
    id: string;
    email: string;
    role: UserRole;
    createdAt: Date;
    expiresAt: Date;
    acceptedAt: Date | null;
    revokedAt: Date | null;
  }): InviteSummary {
    let status: InviteSummary["status"];
    if (invite.revokedAt) status = "revoked";
    else if (invite.acceptedAt) status = "accepted";
    else if (invite.expiresAt.getTime() <= Date.now()) status = "expired";
    else status = "pending";
    return {
      id: invite.id,
      email: invite.email,
      role: roleToString(invite.role),
      status,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    };
  }
}
