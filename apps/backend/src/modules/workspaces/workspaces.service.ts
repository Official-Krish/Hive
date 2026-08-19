import { prisma, UserRole } from "@hive/db";
import type {
  CreateInviteInput,
  CreateWorkspaceInput,
  InviteCreated,
  InviteSummary,
  UpdateMemberRoleInput,
  UpdateWorkspaceInput,
  WorkspaceMemberPublic,
  WorkspaceSummary,
} from "@hive/types";
import {
  ConflictError,
  DeviceRequiredError,
  ForbiddenError,
  NotFoundError,
} from "../../core/errors";
import { generateRandomToken, hashToken } from "../../lib/crypto";
import { slugify, uniqueSlug } from "../../lib/slug";
import { roleFromString, roleToString } from "../../middleware/workspace";
import { DeviceService } from "../devices/devices.service";

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
  constructor(private readonly devices = new DeviceService()) {}

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
    const workspace = await prisma.workspace.create({
      data: {
        orgId,
        name: input.name,
        slug,
        description: input.description,
        members: { create: { userId, role: UserRole.OWNER } },
        privacySetting: { create: {} },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
    return this.summarize(workspace, UserRole.OWNER);
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user || user.email.toLowerCase() !== invite.email) {
      throw new ForbiddenError("This invite was issued to a different email");
    }

    const hasDevice = await this.devices.hasOnlineDevice(userId);
    if (!hasDevice) {
      throw new DeviceRequiredError();
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
            workspaceId: invite.workspaceId,
            userId,
          },
        },
        create: {
          workspaceId: invite.workspaceId,
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

    return this.get(invite.workspaceId, userId);
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
