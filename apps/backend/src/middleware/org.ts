import type { RequestHandler, Response } from "express";
import { prisma, UserRole } from "@hive/db";
import { ForbiddenError } from "../core/errors";
import { getAuth } from "./authenticate";
import type { Role } from "./workspace";

export interface OrgMembership {
  orgId: string;
  userId: string;
  role: Role;
}

/**
 * Resolves the caller's membership in `:orgId` and attaches it to
 * `res.locals.orgMembership`. Requires `requireAuth()` to have run first.
 */
export function requireOrgMember(): RequestHandler {
  return async (req, res, next) => {
    try {
      const auth = getAuth(res);
      const orgId = String(req.params.orgId);
      const member = await prisma.organizationMember.findUnique({
        where: { orgId_userId: { orgId, userId: auth.userId } },
        select: { orgId: true, userId: true, role: true },
      });
      if (!member) {
        return next(new ForbiddenError("Not a member of this organization"));
      }
      res.locals.orgMembership = {
        orgId: member.orgId,
        userId: member.userId,
        role: roleToString(member.role),
      } satisfies OrgMembership;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireOrgRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    const membership = res.locals.orgMembership as OrgMembership | undefined;
    if (!membership || !roles.includes(membership.role)) {
      return next(new ForbiddenError("Insufficient organization permissions"));
    }
    next();
  };
}

export function getOrgMembership(res: Response): OrgMembership {
  const membership = res.locals.orgMembership as OrgMembership | undefined;
  if (!membership) {
    throw new ForbiddenError("Organization membership required");
  }
  return membership;
}

export function roleToString(role: UserRole): Role {
  switch (role) {
    case UserRole.OWNER:
      return "owner";
    case UserRole.ADMIN:
      return "admin";
    case UserRole.MAINTAINER:
    case UserRole.DEVELOPER:
    case UserRole.MEMBER:
    case UserRole.VIEWER:
      return "member";
  }
}

export function roleFromString(role: Role): UserRole {
  switch (role) {
    case "owner":
      return UserRole.OWNER;
    case "admin":
      return UserRole.ADMIN;
    case "maintainer":
    case "developer":
    case "member":
    case "viewer":
      return UserRole.MEMBER;
  }
}
