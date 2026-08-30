import type { RequestHandler, Response } from "express";
import { prisma, UserRole } from "@hive/db";
import { ForbiddenError } from "../core/errors";
import { getAuth } from "./authenticate";

export type Role =
  "owner" | "admin" | "maintainer" | "developer" | "member" | "viewer";

/** Strict hierarchy rank. A role may manage any role strictly below it. */
export const ROLE_RANK: Record<Role, number> = {
  owner: 5,
  admin: 4,
  maintainer: 3,
  developer: 2,
  member: 1,
  viewer: 0,
};

export function roleRank(role: Role): number {
  return ROLE_RANK[role];
}

export interface WorkspaceMembership {
  workspaceId: string;
  userId: string;
  role: Role;
}

/**
 * Resolves the caller's membership in `:workspaceId` and attaches it to
 * `res.locals.membership`. Requires `requireAuth()` to have run first.
 */
export function requireWorkspaceMember(): RequestHandler {
  return async (req, res, next) => {
    try {
      const auth = getAuth(res);
      const workspaceId = String(req.params.workspaceId);
      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: auth.userId },
        },
        select: { workspaceId: true, userId: true, role: true },
      });
      if (!member) {
        return next(new ForbiddenError("Not a member of this workspace"));
      }
      res.locals.membership = {
        workspaceId: member.workspaceId,
        userId: member.userId,
        role: roleToString(member.role),
      } satisfies WorkspaceMembership;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireWorkspaceRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    const membership = res.locals.membership as WorkspaceMembership | undefined;
    if (!membership || !roles.includes(membership.role)) {
      return next(new ForbiddenError("Insufficient workspace permissions"));
    }
    next();
  };
}

export function getMembership(res: Response): WorkspaceMembership {
  const membership = res.locals.membership as WorkspaceMembership | undefined;
  if (!membership) {
    throw new ForbiddenError("Workspace membership required");
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
      return "maintainer";
    case UserRole.DEVELOPER:
      return "developer";
    case UserRole.MEMBER:
      return "member";
    case UserRole.VIEWER:
      return "viewer";
  }
}

export function roleFromString(role: Role): UserRole {
  switch (role) {
    case "owner":
      return UserRole.OWNER;
    case "admin":
      return UserRole.ADMIN;
    case "maintainer":
      return UserRole.MAINTAINER;
    case "developer":
      return UserRole.DEVELOPER;
    case "member":
      return UserRole.MEMBER;
    case "viewer":
      return UserRole.VIEWER;
  }
}
