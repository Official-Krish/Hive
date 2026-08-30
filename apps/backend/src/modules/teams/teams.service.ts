import { prisma } from "@hive/db";
import type {
  CreateTeamInput,
  UpdateTeamInput,
  AddTeamMemberInput,
  TeamSummary,
  TeamMember,
} from "@hive/types";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../core/errors";
import { slugify, uniqueSlug } from "../../lib/slug";
import { roleFromString, roleToString } from "../../middleware/org";

export class TeamService {
  async list(orgId: string): Promise<TeamSummary[]> {
    const teams = await prisma.team.findMany({
      where: { orgId },
      select: {
        id: true,
        orgId: true,
        name: true,
        slug: true,
        createdById: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return teams.map((t) => ({
      id: t.id,
      orgId: t.orgId,
      name: t.name,
      slug: t.slug,
      createdById: t.createdById,
      memberCount: t._count.members,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async create(
    orgId: string,
    actorUserId: string,
    input: CreateTeamInput,
  ): Promise<TeamSummary> {
    const slug = await this.uniqueTeamSlug(orgId, input.slug ?? input.name);
    const team = await prisma.team.create({
      data: {
        orgId,
        name: input.name,
        slug,
        createdById: actorUserId,
      },
      select: {
        id: true,
        orgId: true,
        name: true,
        slug: true,
        createdById: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
    return {
      id: team.id,
      orgId: team.orgId,
      name: team.name,
      slug: team.slug,
      createdById: team.createdById,
      memberCount: team._count.members,
      createdAt: team.createdAt.toISOString(),
    };
  }

  async get(orgId: string, teamId: string): Promise<TeamSummary> {
    const team = await prisma.team.findFirst({
      where: { id: teamId, orgId },
      select: {
        id: true,
        orgId: true,
        name: true,
        slug: true,
        createdById: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
    if (!team) throw new NotFoundError("Team not found");
    return {
      id: team.id,
      orgId: team.orgId,
      name: team.name,
      slug: team.slug,
      createdById: team.createdById,
      memberCount: team._count.members,
      createdAt: team.createdAt.toISOString(),
    };
  }

  async update(
    orgId: string,
    teamId: string,
    input: UpdateTeamInput,
  ): Promise<TeamSummary> {
    await this.get(orgId, teamId);
    const data: { name?: string; slug?: string } = {};
    if (input.name) data.name = input.name;
    if (input.slug)
      data.slug = await this.uniqueTeamSlug(orgId, input.slug, teamId);

    const updated = await prisma.team.update({
      where: { id: teamId },
      data,
      select: {
        id: true,
        orgId: true,
        name: true,
        slug: true,
        createdById: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    });
    return {
      id: updated.id,
      orgId: updated.orgId,
      name: updated.name,
      slug: updated.slug,
      createdById: updated.createdById,
      memberCount: updated._count.members,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async remove(orgId: string, teamId: string): Promise<void> {
    await this.get(orgId, teamId);
    await prisma.team.delete({ where: { id: teamId } });
  }

  async listMembers(orgId: string, teamId: string): Promise<TeamMember[]> {
    await this.get(orgId, teamId);
    const members = await prisma.teamMember.findMany({
      where: { teamId },
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
      role: roleToString(m.role) === "admin" ? "admin" : "member",
      joinedAt: m.createdAt.toISOString(),
    }));
  }

  async addMember(
    orgId: string,
    teamId: string,
    input: AddTeamMemberInput,
  ): Promise<void> {
    await this.get(orgId, teamId);

    const orgMember = await prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId, userId: input.userId } },
      select: { id: true },
    });
    if (!orgMember) {
      throw new ForbiddenError("User is not a member of this organization");
    }

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: input.userId } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError("User is already a member of this team");
    }

    await prisma.teamMember.create({
      data: {
        teamId,
        userId: input.userId,
        role: roleFromString(input.role),
      },
    });
  }

  async changeMemberRole(
    orgId: string,
    teamId: string,
    actorUserId: string,
    targetUserId: string,
    role: "owner" | "admin" | "member",
  ): Promise<void> {
    await this.get(orgId, teamId);
    if (actorUserId === targetUserId) {
      throw new ForbiddenError("Cannot change your own team role");
    }
    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
      select: { id: true },
    });
    if (!target) throw new NotFoundError("Team member not found");
    await prisma.teamMember.update({
      where: { id: target.id },
      data: { role: roleFromString(role) },
    });
  }

  async removeMember(
    orgId: string,
    teamId: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.get(orgId, teamId);
    if (actorUserId === targetUserId) {
      throw new ForbiddenError("Cannot remove yourself from the team");
    }
    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
      select: { id: true },
    });
    if (!target) throw new NotFoundError("Team member not found");
    await prisma.teamMember.delete({ where: { id: target.id } });
  }

  private async uniqueTeamSlug(
    orgId: string,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = slugify(base) || "team";
    const existing = await prisma.team.findFirst({
      where: {
        slug,
        orgId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) slug = uniqueSlug(base);
    return slug;
  }
}
