import { Router } from "express";
import type { Request, Response } from "express";
import { prisma, PresenceStatus } from "@hive/db";
import {
  createConversationInputSchema,
  type ConversationSummary,
} from "@hive/types";
import { requireAuth, getAuth } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { requireWorkspaceMember } from "../../middleware/workspace";
import { NotFoundError, ForbiddenError } from "../../core/errors";

/**
 * Workspace-scoped chat conversations. Mounted at
 * `/api/v1/workspaces/:workspaceId/conversations` — the parent mount supplies
 * `:workspaceId`, and requireWorkspaceMember gates every route on it.
 */
export const conversationsRouter = Router();

conversationsRouter.use(requireAuth(), requireWorkspaceMember());

/** List the caller's conversations in this workspace with unread counts. */
conversationsRouter.get("/", async (req: Request, res: Response) => {
  const auth = getAuth(res);
  const workspaceId = String(req.params.workspaceId);
  res.json({ data: await listConversations(workspaceId, auth.userId) });
});

/** Create a DM (deduped) or group conversation. */
conversationsRouter.post(
  "/",
  validateBody(createConversationInputSchema),
  async (req: Request, res: Response) => {
    const auth = getAuth(res);
    const workspaceId = String(req.params.workspaceId);
    res.status(201).json({
      data: await createConversation(
        workspaceId,
        auth.userId,
        req.body as { memberIds: string[]; title?: string },
      ),
    });
  },
);

/** Paginated history (newest last). `?before=<iso>` for older pages. */
conversationsRouter.get(
  "/:conversationId/messages",
  async (req: Request, res: Response) => {
    const auth = getAuth(res);
    const workspaceId = String(req.params.workspaceId);
    const conversationId = String(req.params.conversationId);
    await assertAccess(conversationId, workspaceId, auth.userId);
    const before = req.query.before
      ? new Date(String(req.query.before))
      : null;
    const rows = await prisma.message.findMany({
      where: {
        conversationId,
        ...(before && !Number.isNaN(before.getTime())
          ? { createdAt: { lt: before } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        body: true,
        createdAt: true,
      },
    });
    res.json({ data: rows.reverse() });
  },
);

/** Mark read up to now. */
conversationsRouter.post(
  "/:conversationId/read",
  async (req: Request, res: Response) => {
    const auth = getAuth(res);
    const workspaceId = String(req.params.workspaceId);
    const conversationId = String(req.params.conversationId);
    await assertAccess(conversationId, workspaceId, auth.userId);
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: auth.userId },
      data: { lastReadAt: new Date() },
    });
    res.json({ data: { success: true } });
  },
);

async function assertAccess(
  conversationId: string,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const row = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { conversation: { select: { workspaceId: true } } },
  });
  if (!row || row.conversation.workspaceId !== workspaceId) {
    throw new NotFoundError("Conversation not found");
  }
}

async function listConversations(
  workspaceId: string,
  userId: string,
): Promise<ConversationSummary[]> {
  const mine = await prisma.conversationParticipant.findMany({
    where: { userId, conversation: { workspaceId } },
    select: {
      lastReadAt: true,
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                  presences: {
                    where: { workspaceId },
                    select: { status: true, customLabel: true },
                    take: 1,
                  },
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              body: true,
              senderId: true,
              createdAt: true,
            },
          },
        },
      },
    },
    orderBy: {
      conversation: { lastMessageAt: "desc" },
    },
  });

  return Promise.all(
    mine.map(async (p) => {
      const c = p.conversation;
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: c.id,
          senderId: { not: userId },
          createdAt: { gt: p.lastReadAt ?? new Date(0) },
        },
      });
      const members = c.participants.map((cp) => ({
        userId: cp.user.id,
        name: cp.user.name,
        avatarUrl: cp.user.avatarUrl,
        status: (
          cp.user.presences[0]?.status ?? PresenceStatus.OFFLINE
        ).toLowerCase(),
        label: cp.user.presences[0]?.customLabel ?? null,
      }));
      return {
        id: c.id,
        title: c.title,
        isGroup: c.title !== null || c.participants.length > 2,
        members,
        lastMessage: c.messages[0]
          ? {
              body: c.messages[0].body,
              senderId: c.messages[0].senderId,
              createdAt: c.messages[0].createdAt.toISOString(),
            }
          : null,
        unreadCount,
        updatedAt: (c.lastMessageAt ?? c.createdAt).toISOString(),
      };
    }),
  );
}

async function createConversation(
  workspaceId: string,
  creatorId: string,
  input: { memberIds: string[]; title?: string },
): Promise<ConversationSummary> {
  // Every listed member must be a workspace member.
  const members = [...new Set([creatorId, ...input.memberIds])];
  const memberships = await prisma.workspaceMember.findMany({
    where: { workspaceId, userId: { in: members } },
    select: { userId: true },
  });
  if (memberships.length !== members.length) {
    throw new ForbiddenError("All members must belong to this workspace");
  }

  // DM dedupe: an untitled conversation with exactly these two people.
  if (!input.title && members.length === 2) {
    const candidate = await prisma.conversation.findFirst({
      where: {
        workspaceId,
        title: null,
        participants: { every: { userId: { in: members } } },
      },
      select: {
        id: true,
        _count: { select: { participants: true } },
      },
    });
    if (candidate && candidate._count.participants === 2) {
      const all = await listConversations(workspaceId, creatorId);
      const found = all.find((c) => c.id === candidate.id);
      if (found) return found;
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      workspaceId,
      title: input.title?.trim() || null,
      createdById: creatorId,
      participants: {
        create: members.map((userId) => ({ userId })),
      },
    },
    select: { id: true },
  });

  const all = await listConversations(workspaceId, creatorId);
  const found = all.find((c) => c.id === conversation.id);
  if (!found) throw new NotFoundError("Conversation not found after create");
  return found;
}
