import type { Request, Response } from "express";
import { prisma } from "@hive/db";
import type { PairSessionCreate } from "@hive/types";
import { getAuth } from "../../middleware/authenticate";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../core/errors";
import { SessionsService } from "./sessions.service";

export class SessionsController {
  constructor(private readonly service = new SessionsService()) {}

  private static workspaceId(req: Request): string {
    const value = req.params.workspaceId;
    return typeof value === "string" ? value : "";
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(res);
    const workspaceId = SessionsController.workspaceId(req);
    const input = (req as unknown as { parsedBody: PairSessionCreate })
      .parsedBody;
    if (!input.members.includes(userId)) {
      throw new BadRequestError("You can only start a pair session you join");
    }
    const names = new Map(
      (
        await prisma.user.findMany({
          where: { id: { in: input.members } },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );
    if (names.size !== 2) {
      throw new NotFoundError("One of the pair members does not exist");
    }
    if (await this.service.findActive(workspaceId)) {
      throw new ConflictError(
        "This workspace already has an active pair session",
      );
    }
    const session = await this.service.create(
      workspaceId,
      input,
      userId,
      names,
    );
    if (!session) throw new ConflictError("Could not start the pair session");
    res.json({ data: { session } });
  };

  active = async (req: Request, res: Response): Promise<void> => {
    const session = await this.service.findActive(
      SessionsController.workspaceId(req),
    );
    res.json({ data: { session } });
  };

  end = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(res);
    const workspaceId = SessionsController.workspaceId(req);
    const sessionId = req.params.sessionId ?? "";
    const session = await this.service.findActive(workspaceId);
    if (!session || session.id !== sessionId) {
      throw new NotFoundError("No active pair session with that id");
    }
    if (!session.members.some((m) => m.userId === userId)) {
      throw new BadRequestError("Only a session member can end it");
    }
    await this.service.end(workspaceId, sessionId);
    res.json({ data: { session: null } });
  };
}
