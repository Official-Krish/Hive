import { prisma, PlanType, UserRole } from "@hive/db";
import type {
  OrgMemberPublic,
  OrgSummary,
  UpdateOrgInput,
  UpdateOrgMemberRoleInput,
  WorkspaceSummary,
} from "@hive/types";
import { ForbiddenError, NotFoundError } from "../../core/errors";
import { slugify, uniqueSlug } from "../../lib/slug";
import { roleFromString, roleToString } from "../../middleware/org";
import type { Role } from "../../middleware/workspace";

const planFromString = (plan: "free" | "team" | "enterprise"): PlanType => {
  switch (plan) {
    case "free":
      return PlanType.FREE;
    case "team":
      return PlanType.TEAM;
    case "enterprise":
      return PlanType.ENTERPRISE;
  }
};

const planToString = (plan: PlanType): "free" | "team" | "enterprise" => {
  switch (plan) {
    case PlanType.FREE:
      return "free";
    case PlanType.TEAM:
      return "team";
    case PlanType.ENTERPRISE:
      return "enterprise";
  }
};

const statusToString = (
  status: "INVITED" | "ACTIVE" | "SUSPENDED",
): "invited" | "active" | "suspended" => {
  switch (status) {
    case "INVITED":
      return "invited";
    case "ACTIVE":
      return "active";
    case "SUSPENDED":
      return "suspended";
  }
};

export class OrgService {
  async get(orgId: string, userId: string): Promise<OrgSummary> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        _count: { select: { members: true, workspaces: true } },
      },
    });
    if (!org) throw new NotFoundError("Organization not found");

    const membership = await prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
      select: { role: true },
    });
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: planToString(org.plan),
      role: roleToString(membership?.role ?? UserRole.MEMBER),
      memberCount: org._count.members,
      workspaceCount: org._count.workspaces,
      createdAt: org.createdAt.toISOString(),
    };
  }

  async update(
    orgId: string,
    role: Role,
    input: UpdateOrgInput,
  ): Promise<OrgSummary> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!org) throw new NotFoundError("Organization not found");

    if (input.plan && role !== "owner") {
      throw new ForbiddenError(
        "Only the organization owner can change the plan",
      );
    }

    const data: { name?: string; slug?: string; plan?: PlanType } = {};
    if (input.name) data.name = input.name;
    if (input.slug) data.slug = await this.uniqueOrgSlug(input.slug, orgId);
    if (input.plan) data.plan = planFromString(input.plan);

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        createdAt: true,
        _count: { select: { members: true, workspaces: true } },
      },
    });
    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      plan: planToString(updated.plan),
      role: roleToString(roleFromString(role)),
      memberCount: updated._count.members,
      workspaceCount: updated._count.workspaces,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async listMembers(orgId: string): Promise<OrgMemberPublic[]> {
    const members = await prisma.organizationMember.findMany({
      where: { orgId },
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
      status: statusToString(m.status),
      joinedAt: m.createdAt.toISOString(),
    }));
  }

  async listWorkspaces(
    orgId: string,
    userId: string,
  ): Promise<WorkspaceSummary[]> {
    const workspaces = await prisma.workspace.findMany({
      where: { orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId, workspace: { orgId } },
      select: { workspaceId: true, role: true },
    });
    const roleByWorkspace = new Map(
      memberships.map((m) => [m.workspaceId, roleToString(m.role)]),
    );
    return workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      description: w.description,
      role: roleByWorkspace.get(w.id) ?? "member",
      memberCount: w._count.members,
      createdAt: w.createdAt.toISOString(),
    }));
  }

  async changeMemberRole(
    orgId: string,
    actorUserId: string,
    targetUserId: string,
    input: UpdateOrgMemberRoleInput,
  ): Promise<void> {
    if (actorUserId === targetUserId) {
      throw new ForbiddenError("Cannot change your own role");
    }
    const target = await prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId, userId: targetUserId } },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundError("Member not found");
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenError("Cannot change the organization owner's role");
    }
    await prisma.organizationMember.update({
      where: { id: target.id },
      data: { role: roleFromString(input.role) },
    });
  }

  async removeMember(
    orgId: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    if (actorUserId === targetUserId) {
      throw new ForbiddenError("Cannot remove yourself from the organization");
    }
    const target = await prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId, userId: targetUserId } },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundError("Member not found");
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenError("Cannot remove the organization owner");
    }
    await prisma.organizationMember.delete({ where: { id: target.id } });
  }

  private async uniqueOrgSlug(
    base: string,
    excludeId: string,
  ): Promise<string> {
    let slug = slugify(base) || "org";
    const existing = await prisma.organization.findFirst({
      where: { slug, id: { not: excludeId } },
      select: { id: true },
    });
    if (existing) slug = uniqueSlug(base);
    return slug;
  }
}
