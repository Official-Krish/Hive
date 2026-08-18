import { prisma, RefreshTokenStatus } from "@hive/db";
import type {
  ChangePasswordInput,
  LoginInput,
  PublicUser,
  RegisterInput,
  UpdateProfileInput,
} from "@hive/types";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env";
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from "../../core/errors";
import {
  generateRandomToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from "../../lib/crypto";
import { signAccessToken } from "../../lib/jwt";
import { uniqueSlug } from "../../lib/slug";
import { toPublicUser } from "./auth.mapper";

export interface SessionContext {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}

export interface SessionResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

const refreshTokenTtlMs = (): number =>
  env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export class AuthService {
  async register(
    input: RegisterInput,
    ctx: SessionContext,
  ): Promise<SessionResult> {
    const email = input.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      throw new ConflictError("An account with this email already exists");

    const passwordHash = await hashPassword(input.password);

    const userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: input.name,
          emailVerifiedAt: new Date(),
        },
      });

      const org = await tx.organization.create({
        data: {
          name: `${input.name}'s Organization`,
          slug: uniqueSlug(input.name),
        },
      });

      const workspace = await tx.workspace.create({
        data: { orgId: org.id, name: "Main", slug: "main" },
      });

      await tx.organizationMember.create({
        data: {
          orgId: org.id,
          userId: user.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: user.id, role: "OWNER" },
      });
      await tx.privacySetting.create({ data: { workspaceId: workspace.id } });

      return user.id;
    });

    return this.issueSession(userId, ctx);
  }

  async login(input: LoginInput, ctx: SessionContext): Promise<SessionResult> {
    const email = input.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedError("Invalid email or password");

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid email or password");

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueSession(user.id, ctx);
  }

  async refresh(rawToken: string, ctx: SessionContext): Promise<SessionResult> {
    if (!rawToken) throw new UnauthorizedError("Missing refresh token");

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!stored) throw new UnauthorizedError("Invalid refresh token");

    // Reuse detection: a rotated or revoked token presented again signals
    // token theft — kill the entire family and force a re-login.
    if (
      stored.status === RefreshTokenStatus.REVOKED ||
      stored.status === RefreshTokenStatus.REPLACED
    ) {
      await prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, status: RefreshTokenStatus.ACTIVE },
        data: { status: RefreshTokenStatus.REVOKED, revokedAt: new Date() },
      });
      throw new UnauthorizedError("Session has been revoked");
    }

    if (
      stored.status === RefreshTokenStatus.EXPIRED ||
      stored.expiresAt.getTime() <= Date.now()
    ) {
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { status: RefreshTokenStatus.EXPIRED },
      });
      throw new UnauthorizedError("Session has expired");
    }

    // Rotation: issue a new token in the same family, atomically.
    const newRawToken = generateRandomToken(32);
    const rotated = await prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: stored.userId,
          deviceId: ctx.deviceId ?? stored.deviceId,
          tokenHash: hashToken(newRawToken),
          familyId: stored.familyId,
          expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
          userAgent: ctx.userAgent,
          ip: ctx.ip,
        },
      });
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: {
          status: RefreshTokenStatus.REPLACED,
          replacedById: created.id,
          lastUsedAt: new Date(),
          revokedAt: new Date(),
        },
      });
      return created;
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: stored.userId },
    });

    return {
      user: toPublicUser(user),
      accessToken: signAccessToken({
        sub: stored.userId,
        deviceId: rotated.deviceId ?? undefined,
      }),
      refreshToken: newRawToken,
      accessTokenExpiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  async logout(rawToken?: string): Promise<void> {
    if (!rawToken) return;
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!stored) return;
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { status: RefreshTokenStatus.REVOKED, revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, status: RefreshTokenStatus.ACTIVE },
      data: { status: RefreshTokenStatus.REVOKED, revokedAt: new Date() },
    });
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    currentRefreshToken?: string,
  ): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const valid = await verifyPassword(
      input.currentPassword,
      user.passwordHash,
    );
    if (!valid) throw new UnauthorizedError("Current password is incorrect");
    if (input.currentPassword === input.newPassword) {
      throw new BadRequestError(
        "New password must differ from the current password",
      );
    }

    const newPasswordHash = await hashPassword(input.newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      const excludeCurrent = currentRefreshToken
        ? await tx.refreshToken.findUnique({
            where: { tokenHash: hashToken(currentRefreshToken) },
          })
        : null;

      await tx.refreshToken.updateMany({
        where: {
          userId,
          status: RefreshTokenStatus.ACTIVE,
          ...(excludeCurrent ? { id: { not: excludeCurrent.id } } : {}),
        },
        data: { status: RefreshTokenStatus.REVOKED, revokedAt: new Date() },
      });
    });
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { include: { org: true } } },
    });

    return {
      user: toPublicUser(user),
      organizations: user.memberships.map((membership) => ({
        id: membership.org.id,
        name: membership.org.name,
        slug: membership.org.slug,
        plan: membership.org.plan,
        role: membership.role,
      })),
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<PublicUser> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.avatarUrl !== undefined
          ? { avatarUrl: input.avatarUrl }
          : {}),
      },
    });
    return toPublicUser(user);
  }

  private async issueSession(
    userId: string,
    ctx: SessionContext,
  ): Promise<SessionResult> {
    const rawToken = generateRandomToken(32);

    await prisma.refreshToken.create({
      data: {
        userId,
        deviceId: ctx.deviceId,
        tokenHash: hashToken(rawToken),
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
        userAgent: ctx.userAgent,
        ip: ctx.ip,
      },
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    return {
      user: toPublicUser(user),
      accessToken: signAccessToken({ sub: userId, deviceId: ctx.deviceId }),
      refreshToken: rawToken,
      accessTokenExpiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    };
  }
}
