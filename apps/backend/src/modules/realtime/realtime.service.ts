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
    label?: string | null,
  ): Promise<void> {
    await prisma.presence.upsert({
      where: { userId_workspaceId: { userId, workspaceId } },
      create: {
        userId,
        workspaceId,
        status,
        customLabel: label ?? null,
        lastSeenAt: new Date(),
      },
      update: {
        status,
        customLabel: label ?? null,
        lastSeenAt: new Date(),
      },
    });
  }

  /** True when the user participates in the conversation AND it belongs to
   * the given workspace — guards every chat send/typing/history call. */
  async isChatParticipant(
    conversationId: string,
    workspaceId: string,
    userId: string,
  ): Promise<boolean> {
    const row = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      select: { conversation: { select: { workspaceId: true } } },
    });
    return row?.conversation.workspaceId === workspaceId;
  }

  /** Persist a chat message (participant-verified) and bump the
   * conversation's lastMessageAt. Returns null when not allowed. */
  async sendMessage(
    conversationId: string,
    workspaceId: string,
    senderId: string,
    body: string,
  ): Promise<{ id: string; senderId: string; body: string; createdAt: Date } | null> {
    if (
      !(await this.isChatParticipant(conversationId, workspaceId, senderId))
    ) {
      return null;
    }
    const [msg] = await prisma.$transaction([
      prisma.message.create({
        data: { conversationId, senderId, body },
        select: { id: true, senderId: true, body: true, createdAt: true },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
        select: { id: true },
      }),
    ]);
    return msg;
  }

  async getSnapshot(
    workspaceId: string,
    mapId: string,
  ): Promise<RealtimeMember[]> {
    const [members, avatars, presences, sessions] = await Promise.all([
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
        select: { userId: true, status: true, customLabel: true },
      }),
      // Latest agent session per member — drives the "needs you" beacon and
      // the project tag on the map.
      prisma.agentSession.findMany({
        where: { workspaceId },
        orderBy: { startedAt: "desc" },
        select: {
          developerId: true,
          status: true,
          repository: { select: { githubFullName: true, name: true } },
        },
        take: 500,
      }),
    ]);

    const avatarByUser = new Map(avatars.map((a) => [a.userId, a]));
    const presenceByUser = new Map(presences.map((p) => [p.userId, p]));
    const sessionByUser = new Map<string, (typeof sessions)[number]>();
    for (const s of sessions) {
      if (!sessionByUser.has(s.developerId))
        sessionByUser.set(s.developerId, s);
    }

    return members.map((membership) => {
      const avatar = avatarByUser.get(membership.userId);
      const presence = presenceByUser.get(membership.userId);
      const session = sessionByUser.get(membership.userId);
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
        sessionStatus: session?.status.toLowerCase() ?? null,
        project: session?.repository
          ? (session.repository.githubFullName ?? session.repository.name)
          : null,
        label: presence?.customLabel ?? null,
        status,
        position: avatar
          ? { x: avatar.x, y: avatar.y, roomId: avatar.roomId }
          : null,
      };
    });
  }
}
