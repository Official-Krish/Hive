import { prisma, PresenceStatus } from "@hive/db";
import type { AvatarPosition, RealtimeMember } from "@hive/types";

export class RealtimeService {
  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true },
    });
    return membership !== null;
  }

  async ensureMapAndAvatar(
    workspaceId: string,
    userId: string,
  ): Promise<{ mapId: string }> {
    const map = await prisma.workspaceMap.upsert({
      where: { workspaceId },
      create: { workspaceId, name: "Default", version: 1 },
      update: {},
    });
    await prisma.avatar.upsert({
      where: { userId_workspaceMapId: { userId, workspaceMapId: map.id } },
      create: { userId, workspaceMapId: map.id },
      update: {},
    });
    return { mapId: map.id };
  }

  async moveAvatar(
    userId: string,
    mapId: string,
    position: AvatarPosition,
  ): Promise<AvatarPosition> {
    await prisma.avatar.update({
      where: { userId_workspaceMapId: { userId, workspaceMapId: mapId } },
      data: {
        x: position.x,
        y: position.y,
        roomId: position.roomId,
        lastMovedAt: new Date(),
      },
    });
    return position;
  }

  async updatePresence(
    userId: string,
    workspaceId: string,
    status: PresenceStatus,
  ): Promise<void> {
    await prisma.presence.upsert({
      where: { userId_workspaceId: { userId, workspaceId } },
      create: { userId, workspaceId, status, lastSeenAt: new Date() },
      update: { status, lastSeenAt: new Date() },
    });
  }

  async getSnapshot(
    workspaceId: string,
    mapId: string,
  ): Promise<RealtimeMember[]> {
    const [members, avatars, presences] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { workspaceId },
        select: {
          userId: true,
          user: {
            select: { name: true, avatarUrl: true, mapAvatarModel: true },
          },
        },
      }),
      prisma.avatar.findMany({
        where: { workspaceMapId: mapId },
        select: { userId: true, x: true, y: true, roomId: true },
      }),
      prisma.presence.findMany({
        where: { workspaceId },
        select: { userId: true, status: true },
      }),
    ]);

    const avatarByUser = new Map(avatars.map((a) => [a.userId, a]));
    const presenceByUser = new Map(presences.map((p) => [p.userId, p]));

    return members.map((membership) => {
      const avatar = avatarByUser.get(membership.userId);
      const presence = presenceByUser.get(membership.userId);
      // No Presence row means the developer has never joined the map —
      // report offline rather than assuming online.
      const status = !presence
        ? "offline"
        : presence.status === PresenceStatus.AWAY
          ? "away"
          : presence.status === PresenceStatus.OFFLINE
            ? "offline"
            : "online";
      return {
        userId: membership.userId,
        name: membership.user.name,
        avatarUrl: membership.user.avatarUrl,
        mapAvatarModel: membership.user.mapAvatarModel,
        status,
        position: avatar
          ? { x: avatar.x, y: avatar.y, roomId: avatar.roomId }
          : null,
      };
    });
  }
}
