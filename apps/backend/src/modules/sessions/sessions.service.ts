import {
  prisma,
  PairSessionStatus,
  type PairSession as PrismaPairSession,
} from "@hive/db";
import type { PairSession, PairSessionCreate } from "@hive/types";
import { realtimeBus } from "../realtime/realtime.bus";

type SessionWithMembers = PrismaPairSession & {
  members: Array<{ userId: string; name: string }>;
};

/**
 * Pair-programming sessions.
 *
 * Postgres is the source of truth: writes hit `PairSession` / `PairSessionMember`
 * first, then a `pair.session` event is broadcast to the workspace topic so every
 * client (including the partner) stays in sync.
 */
export class SessionsService {
  private toWire(session: SessionWithMembers): PairSession {
    return {
      id: session.id,
      roomId: session.roomId,
      status: session.status.toLowerCase() as PairSession["status"],
      repositoryId: session.repositoryId,
      members: session.members.map((m) => ({ userId: m.userId, name: m.name })),
      startedBy: session.startedBy,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
    };
  }

  async findActive(workspaceId: string): Promise<PairSession | null> {
    const session = await prisma.pairSession.findFirst({
      where: { workspaceId, status: PairSessionStatus.ACTIVE },
      orderBy: { startedAt: "desc" },
      include: {
        members: {
          orderBy: { name: "asc" },
          select: { userId: true, name: true },
        },
      },
    });
    return session ? this.toWire(session) : null;
  }

  async create(
    workspaceId: string,
    input: PairSessionCreate,
    startedBy: string,
    names: Map<string, string>,
  ): Promise<PairSession> {
    const session = await prisma.pairSession.create({
      data: {
        workspaceId,
        roomId: input.roomId,
        status: PairSessionStatus.ACTIVE,
        repositoryId: input.repositoryId ?? null,
        startedBy,
        members: {
          create: input.members.map((userId) => ({
            userId,
            name: names.get(userId) ?? userId,
          })),
        },
      },
      include: {
        members: {
          orderBy: { name: "asc" },
          select: { userId: true, name: true },
        },
      },
    });
    const wire = this.toWire(session);
    realtimeBus.publish(workspaceId, {
      type: "pair.session",
      workspaceId,
      session: wire,
      timestamp: Date.now(),
    });
    return wire;
  }

  async end(
    workspaceId: string,
    sessionId: string,
  ): Promise<PairSession | null> {
    const session = await prisma.pairSession.findFirst({
      where: { id: sessionId, workspaceId, status: PairSessionStatus.ACTIVE },
      include: {
        members: {
          orderBy: { name: "asc" },
          select: { userId: true, name: true },
        },
      },
    });
    if (!session) return null;
    await prisma.pairSession.update({
      where: { id: sessionId },
      data: { status: PairSessionStatus.ENDED, endedAt: new Date() },
    });
    const ended = {
      ...this.toWire(session),
      status: "ended" as const,
      endedAt: new Date().toISOString(),
    };
    realtimeBus.publish(workspaceId, {
      type: "pair.session",
      workspaceId,
      session: ended,
      timestamp: Date.now(),
    });
    return null;
  }
}
