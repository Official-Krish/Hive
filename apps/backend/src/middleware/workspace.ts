import type { RequestHandler, Response } from "express";
import { prisma, UserRole } from "@hive/db";
import { ForbiddenError } from "../core/errors";
import { getAuth } from "./authenticate";

export interface WorkspaceMembership {
  workspaceId: string;
  userId: string;
  role: "owner" | "admin" | "member";
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

export function requireWorkspaceRole(
  ...roles: Array<"owner" | "admin" | "member">
): RequestHandler {
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

export function roleToString(role: UserRole): WorkspaceMembership["role"] {
  switch (role) {
    case UserRole.OWNER:
      return "owner";
    case UserRole.ADMIN:
      return "admin";
    case UserRole.MEMBER:
      return "member";
  }
}

export function roleFromString(role: "owner" | "admin" | "member"): UserRole {
  switch (role) {
    case "owner":
      return UserRole.OWNER;
    case "admin":
      return UserRole.ADMIN;
    case "member":
      return UserRole.MEMBER;
  }
}
