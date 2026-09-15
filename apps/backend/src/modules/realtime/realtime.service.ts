import { prisma, PresenceStatus } from "@hive/db";
import {
  parseYouTubeUrl,
  type AvatarPosition,
  type RealtimeMember,
} from "@hive/types";

export interface ChillMediaState {
  videoUrl: string | null;
  videoId: string | null;
  title: string | null;
  isPlaying: boolean;
  playheadMs: number;
  /** Server wall-clock ms at which `playheadMs` was captured. */
  at: number;
  setByName: string | null;
  queueItemId: string | null;
}

export interface ChillQueueItemState {
  id: string;
  videoUrl: string;
  videoId: string;
  title: string | null;
  position: number;
  addedByName: string | null;
}

function toChillMediaState(row: {
  videoUrl: string | null;
  videoId: string | null;
  title: string | null;
  isPlaying: boolean;
  playheadMs: number;
  currentItemId?: string | null;
  updatedAt: Date;
  setBy: { name: string } | null;
}): ChillMediaState {
  return {
    videoUrl: row.videoUrl,
    videoId: row.videoId,
    title: row.title,
    isPlaying: row.isPlaying,
    playheadMs: Math.round(row.playheadMs),
    at: row.updatedAt.getTime(),
    setByName: row.setBy?.name ?? null,
    queueItemId: row.currentItemId ?? null,
  };
}

const CHILL_QUEUE_SELECT = {
  id: true,
  videoUrl: true,
  videoId: true,
  title: true,
  position: true,
  addedBy: { select: { name: true } },
} as const;

function toQueueItemState(row: {
  id: string;
  videoUrl: string;
  videoId: string;
  title: string | null;
  position: number;
  addedBy: { name: string } | null;
}): ChillQueueItemState {
  return {
    id: row.id,
    videoUrl: row.videoUrl,
    videoId: row.videoId,
    title: row.title,
    position: row.position,
    addedByName: row.addedBy?.name ?? null,
  };
}

/** Best-effort YouTube title via the public oEmbed endpoint (no API key). */
async function resolveYouTubeTitle(
  videoId: string,
  fallbackUrl: string,
): Promise<string> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(fallbackUrl)}&format=json`,
      { signal: ctrl.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return videoId;
    const data = (await res.json()) as { title?: string };
    const title = data.title?.trim();
    return title ? title.slice(0, 160) : videoId;
  } catch {
    return videoId;
  }
}

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
    workingOn?: string | null,
  ): Promise<{
    status: PresenceStatus;
    customLabel: string | null;
    workingOn: string | null;
  }> {
    const row = await prisma.presence.upsert({
      where: { userId_workspaceId: { userId, workspaceId } },
      create: {
        userId,
        workspaceId,
        status,
        customLabel: label ?? null,
        workingOn: workingOn ?? null,
        lastSeenAt: new Date(),
      },
      update: {
        status,
        customLabel: label ?? null,
        ...(workingOn !== undefined ? { workingOn: workingOn ?? null } : {}),
        lastSeenAt: new Date(),
      },
      select: { status: true, customLabel: true, workingOn: true },
    });
    return row;
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
  ): Promise<{
    id: string;
    senderId: string;
    body: string;
    createdAt: Date;
  } | null> {
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
        select: {
          userId: true,
          status: true,
          customLabel: true,
          workingOn: true,
        },
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
      const status = (
        presence?.status ?? PresenceStatus.OFFLINE
      ).toLowerCase() as RealtimeMember["status"];
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
        workingOn: presence?.workingOn ?? null,
        status,
        position: avatar
          ? { x: avatar.x, y: avatar.y, roomId: avatar.roomId }
          : null,
      };
    });
  }

  async getChillMedia(workspaceId: string): Promise<ChillMediaState | null> {
    const row = await prisma.chillMedia.findUnique({
      where: { workspaceId },
      select: {
        videoUrl: true,
        videoId: true,
        title: true,
        isPlaying: true,
        playheadMs: true,
        currentItemId: true,
        updatedAt: true,
        setBy: { select: { name: true } },
      },
    });
    return row ? toChillMediaState(row) : null;
  }

  async getChillQueue(workspaceId: string): Promise<ChillQueueItemState[]> {
    const rows = await prisma.chillQueueItem.findMany({
      where: { workspaceId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: CHILL_QUEUE_SELECT,
    });
    return rows.map(toQueueItemState);
  }

  private async loadQueue(workspaceId: string) {
    return prisma.chillQueueItem.findMany({
      where: { workspaceId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: CHILL_QUEUE_SELECT,
    });
  }

  private async persistQueueOrder(
    workspaceId: string,
    orderedIds: string[],
  ): Promise<ChillQueueItemState[]> {
    await prisma.$transaction(
      orderedIds.map((id, idx) =>
        prisma.chillQueueItem.update({
          where: { id },
          data: { position: idx },
        }),
      ),
    );
    return this.getChillQueue(workspaceId);
  }

  private async applyNowPlaying(
    workspaceId: string,
    userId: string,
    item: {
      id: string;
      videoUrl: string;
      videoId: string;
      title: string | null;
    },
    autoplay: boolean,
  ): Promise<ChillMediaState> {
    const row = await prisma.chillMedia.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        videoUrl: item.videoUrl,
        videoId: item.videoId,
        title: item.title,
        isPlaying: autoplay,
        playheadMs: 0,
        setById: userId,
        currentItemId: item.id,
      },
      update: {
        videoUrl: item.videoUrl,
        videoId: item.videoId,
        title: item.title,
        isPlaying: autoplay,
        playheadMs: 0,
        setById: userId,
        currentItemId: item.id,
      },
      select: {
        videoUrl: true,
        videoId: true,
        title: true,
        isPlaying: true,
        playheadMs: true,
        currentItemId: true,
        updatedAt: true,
        setBy: { select: { name: true } },
      },
    });
    return toChillMediaState(row);
  }

  async setChillUrl(
    workspaceId: string,
    userId: string,
    raw: string,
  ): Promise<{ media: ChillMediaState; queue: ChillQueueItemState[] }> {
    // Legacy "play on screen" path — enqueue and jump straight to it so old
    // clients keep working while feeding the shared queue.
    const parsed = parseYouTubeUrl(raw);
    if (!parsed) {
      throw new Error("invalid_youtube_url");
    }
    const title = await resolveYouTubeTitle(parsed.videoId, parsed.url);
    const existing = await this.loadQueue(workspaceId);
    const position =
      existing.length > 0
        ? Math.max(...existing.map((r) => r.position)) + 1
        : 0;
    const created = await prisma.chillQueueItem.create({
      data: {
        workspaceId,
        videoUrl: parsed.url,
        videoId: parsed.videoId,
        title,
        position,
        addedById: userId,
      },
      select: CHILL_QUEUE_SELECT,
    });
    const media = await this.applyNowPlaying(
      workspaceId,
      userId,
      {
        id: created.id,
        videoUrl: created.videoUrl,
        videoId: created.videoId,
        title: created.title,
      },
      false,
    );
    const queue = await this.getChillQueue(workspaceId);
    return { media, queue };
  }

  async setChillPlaying(
    workspaceId: string,
    isPlaying: boolean,
  ): Promise<ChillMediaState | null> {
    const existing = await prisma.chillMedia.findUnique({
      where: { workspaceId },
      select: { id: true, isPlaying: true, playheadMs: true, updatedAt: true },
    });
    if (!existing) return null;
    // When transitioning from playing → paused, freeze the live position so the
    // stored playhead stays the baseline for the paused state.
    const liveMs = existing.isPlaying
      ? existing.playheadMs + (Date.now() - existing.updatedAt.getTime())
      : existing.playheadMs;
    const row = await prisma.chillMedia.update({
      where: { id: existing.id },
      data: { isPlaying, playheadMs: liveMs },
      select: {
        videoUrl: true,
        videoId: true,
        title: true,
        isPlaying: true,
        playheadMs: true,
        currentItemId: true,
        updatedAt: true,
        setBy: { select: { name: true } },
      },
    });
    return toChillMediaState(row);
  }

  async seekChill(
    workspaceId: string,
    playheadMs: number,
  ): Promise<ChillMediaState | null> {
    const existing = await prisma.chillMedia.findUnique({
      where: { workspaceId },
      select: { id: true },
    });
    if (!existing) return null;
    const row = await prisma.chillMedia.update({
      where: { id: existing.id },
      data: { playheadMs },
      select: {
        videoUrl: true,
        videoId: true,
        title: true,
        isPlaying: true,
        playheadMs: true,
        currentItemId: true,
        updatedAt: true,
        setBy: { select: { name: true } },
      },
    });
    return toChillMediaState(row);
  }

  async addToChillQueue(
    workspaceId: string,
    userId: string,
    raw: string,
  ): Promise<{ media: ChillMediaState; queue: ChillQueueItemState[] }> {
    const parsed = parseYouTubeUrl(raw);
    if (!parsed) throw new Error("invalid_youtube_url");
    const queue = await this.loadQueue(workspaceId);
    if (queue.length >= 200) throw new Error("queue_full");
    const title = await resolveYouTubeTitle(parsed.videoId, parsed.url);
    const position =
      queue.length > 0 ? Math.max(...queue.map((r) => r.position)) + 1 : 0;
    await prisma.chillQueueItem.create({
      data: {
        workspaceId,
        videoUrl: parsed.url,
        videoId: parsed.videoId,
        title,
        position,
        addedById: userId,
      },
    });
    const freshQueue = await this.getChillQueue(workspaceId);
    // First item ever → start playing it immediately so the screen wakes up.
    let media = await this.getChillMedia(workspaceId);
    if (!media?.videoId) {
      const first = freshQueue[0];
      if (first) {
        media = await this.applyNowPlaying(
          workspaceId,
          userId,
          {
            id: first.id,
            videoUrl: first.videoUrl,
            videoId: first.videoId,
            title: first.title,
          },
          true,
        );
      }
    }
    media ??= await this.getChillMedia(workspaceId);
    if (!media) {
      throw new Error("queue_failed");
    }
    return { media, queue: freshQueue };
  }

  async playChillQueueItem(
    workspaceId: string,
    userId: string,
    itemId: string,
  ): Promise<{ media: ChillMediaState; queue: ChillQueueItemState[] } | null> {
    const item = await prisma.chillQueueItem.findFirst({
      where: { id: itemId, workspaceId },
      select: CHILL_QUEUE_SELECT,
    });
    if (!item) return null;
    const media = await this.applyNowPlaying(
      workspaceId,
      userId,
      {
        id: item.id,
        videoUrl: item.videoUrl,
        videoId: item.videoId,
        title: item.title,
      },
      true,
    );
    const queue = await this.getChillQueue(workspaceId);
    return { media, queue };
  }

  async stepChillQueue(
    workspaceId: string,
    userId: string,
    direction: 1 | -1,
  ): Promise<{ media: ChillMediaState; queue: ChillQueueItemState[] } | null> {
    const [queue, mediaRow] = await Promise.all([
      this.loadQueue(workspaceId),
      prisma.chillMedia.findUnique({
        where: { workspaceId },
        select: { currentItemId: true, videoId: true },
      }),
    ]);
    if (queue.length === 0) return null;
    let idx = queue.findIndex((q) => q.id === mediaRow?.currentItemId);
    if (idx < 0 && mediaRow?.videoId) {
      idx = queue.findIndex((q) => q.videoId === mediaRow.videoId);
    }
    // Nothing playing yet → start at head (next) or tail (prev).
    if (idx < 0) idx = direction === 1 ? -1 : 0;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= queue.length) {
      // Stepping past the head while a song ended → pause at the end.
      if (direction === 1) {
        const media = await this.setChillPlaying(workspaceId, false);
        const queueState = await this.getChillQueue(workspaceId);
        if (!media) return null;
        return { media, queue: queueState };
      }
      return null;
    }
    const target = queue[nextIdx];
    if (!target) return null;
    const media = await this.applyNowPlaying(
      workspaceId,
      userId,
      {
        id: target.id,
        videoUrl: target.videoUrl,
        videoId: target.videoId,
        title: target.title,
      },
      true,
    );
    return { media, queue: queue.map(toQueueItemState) };
  }

  /** Auto-advance when a client reports YT ENDED. Stale reports are ignored. */
  async endChillQueueItem(
    workspaceId: string,
    userId: string,
    itemId: string,
  ): Promise<{ media: ChillMediaState; queue: ChillQueueItemState[] } | null> {
    const mediaRow = await prisma.chillMedia.findUnique({
      where: { workspaceId },
      select: { currentItemId: true, videoId: true },
    });
    if (!mediaRow) return null;
    if (mediaRow.currentItemId && mediaRow.currentItemId !== itemId) {
      return null;
    }
    if (!mediaRow.currentItemId && mediaRow.videoId) {
      const match = await prisma.chillQueueItem.findFirst({
        where: { id: itemId, workspaceId },
        select: { videoId: true },
      });
      if (!match || match.videoId !== mediaRow.videoId) return null;
    }
    return this.stepChillQueue(workspaceId, userId, 1);
  }

  async removeChillQueueItem(
    workspaceId: string,
    userId: string,
    itemId: string,
  ): Promise<{ media: ChillMediaState; queue: ChillQueueItemState[] } | null> {
    const [queue, mediaRow] = await Promise.all([
      this.loadQueue(workspaceId),
      prisma.chillMedia.findUnique({
        where: { workspaceId },
        select: { id: true, currentItemId: true },
      }),
    ]);
    const idx = queue.findIndex((q) => q.id === itemId);
    if (idx < 0) return null;
    await prisma.chillQueueItem.delete({ where: { id: itemId } });
    const remaining = queue.filter((q) => q.id !== itemId);
    let media: ChillMediaState | null = await this.getChillMedia(workspaceId);
    if (mediaRow?.currentItemId === itemId) {
      if (remaining.length === 0) {
        const cleared = await prisma.chillMedia.update({
          where: { id: mediaRow.id },
          data: {
            videoUrl: null,
            videoId: null,
            title: null,
            isPlaying: false,
            playheadMs: 0,
            currentItemId: null,
          },
          select: {
            videoUrl: true,
            videoId: true,
            title: true,
            isPlaying: true,
            playheadMs: true,
            currentItemId: true,
            updatedAt: true,
            setBy: { select: { name: true } },
          },
        });
        media = toChillMediaState(cleared);
      } else {
        const next = remaining[Math.min(idx, remaining.length - 1)];
        if (!next) {
          if (!media) return null;
          return { media, queue: remaining.map(toQueueItemState) };
        }
        media = await this.applyNowPlaying(
          workspaceId,
          userId,
          {
            id: next.id,
            videoUrl: next.videoUrl,
            videoId: next.videoId,
            title: next.title,
          },
          true,
        );
      }
    }
    if (!media) return null;
    return { media, queue: remaining.map(toQueueItemState) };
  }

  async reorderChillQueue(
    workspaceId: string,
    itemId: string,
    toIndex: number,
  ): Promise<ChillQueueItemState[] | null> {
    const queue = await this.loadQueue(workspaceId);
    const from = queue.findIndex((q) => q.id === itemId);
    if (from < 0) return null;
    const clamped = Math.max(0, Math.min(toIndex, queue.length - 1));
    if (clamped === from) return queue.map(toQueueItemState);
    const [moved] = queue.splice(from, 1);
    if (!moved) return null;
    queue.splice(clamped, 0, moved);
    return this.persistQueueOrder(
      workspaceId,
      queue.map((q) => q.id),
    );
  }

  async clearChillQueue(
    workspaceId: string,
  ): Promise<{ media: ChillMediaState | null; queue: ChillQueueItemState[] }> {
    await prisma.chillQueueItem.deleteMany({ where: { workspaceId } });
    const existing = await prisma.chillMedia.findUnique({
      where: { workspaceId },
      select: { id: true },
    });
    let media: ChillMediaState | null = null;
    if (existing) {
      const row = await prisma.chillMedia.update({
        where: { id: existing.id },
        data: {
          videoUrl: null,
          videoId: null,
          title: null,
          isPlaying: false,
          playheadMs: 0,
          currentItemId: null,
        },
        select: {
          videoUrl: true,
          videoId: true,
          title: true,
          isPlaying: true,
          playheadMs: true,
          currentItemId: true,
          updatedAt: true,
          setBy: { select: { name: true } },
        },
      });
      media = toChillMediaState(row);
    }
    return { media, queue: [] };
  }
}
