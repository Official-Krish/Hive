import type { Request, Response } from "express";
import { ARCADE_BOT_SENTINEL } from "@hive/games";
import { prisma } from "@hive/db";
import type { GameSessionCreate } from "@hive/types";
import { getAuth } from "../../middleware/authenticate";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../core/errors";
import { GamesService } from "./games.service";

export class GamesController {
  constructor(private readonly service = new GamesService()) {}

  private static workspaceId(req: Request): string {
    const value = req.params.workspaceId;
    return typeof value === "string" ? value : "";
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(res);
    const workspaceId = GamesController.workspaceId(req);
    let input = req.body as GameSessionCreate;
    // Challenging the Arcade Bot: swap the sentinel for its real user id
    // (created + joined to the workspace on demand), then run the exact
    // same validation as a human opponent. Bot plays Connect 4, Ludo, Uno.
    // (Two sentinels map to one bot id, which the duplicate-seat check
    // rejects — one bot per table.)
    const wantsBot = input.opponentIds
      ? input.opponentIds.includes(ARCADE_BOT_SENTINEL)
      : input.opponentId === ARCADE_BOT_SENTINEL;
    let botId: string | null = null;
    if (wantsBot) {
      if (
        input.kind !== "connect4" &&
        input.kind !== "ludo" &&
        input.kind !== "uno"
      ) {
        throw new BadRequestError(
          "Arcade Bot only plays Connect 4, Ludo and Uno",
        );
      }
      botId = (await this.service.ensureArcadeBot(workspaceId)).id;
      input = input.opponentIds
        ? {
            ...input,
            opponentIds: input.opponentIds.map((id) =>
              id === ARCADE_BOT_SENTINEL ? (botId as string) : id,
            ),
          }
        : { ...input, opponentId: botId };
    }
    const party = input.kind === "ludo" || input.kind === "uno";
    const opponents = party ? (input.opponentIds ?? []) : [input.opponentId!];
    if (opponents.includes(userId)) {
      throw new BadRequestError("You cannot play yourself");
    }
    // Every seat must be a real workspace member.
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: [userId, ...opponents] } },
      select: { userId: true },
    });
    if (members.length !== opponents.length + 1) {
      throw new NotFoundError("An opponent is not a member of this workspace");
    }
    const users = await prisma.user.findMany({
      where: { id: { in: [userId, ...opponents] } },
      select: { id: true, name: true },
    });
    if (users.length !== opponents.length + 1) {
      throw new NotFoundError("An opponent user does not exist");
    }
    if (await this.service.hasOpenMatch(workspaceId, userId)) {
      throw new ConflictError("Finish your open match first");
    }
    const created = await this.service.create(
      workspaceId,
      input,
      userId,
      new Map(users.map((u) => [u.id, u.name])),
    );
    // The bot accepts instantly — challenger opens an already-live board.
    const session =
      botId != null
        ? ((await this.service.accept(workspaceId, created.id, botId)) ??
          created)
        : created;
    res.status(201).json({ data: { session } });
  };

  active = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(res);
    const session = await this.service.activeFor(
      GamesController.workspaceId(req),
      userId,
    );
    res.json({ data: { session } });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const sessions = await this.service.listActive(
      GamesController.workspaceId(req),
    );
    res.json({ data: { sessions } });
  };

  byId = async (req: Request, res: Response): Promise<void> => {
    const session = await this.service.byId(
      GamesController.workspaceId(req),
      typeof req.params.id === "string" ? req.params.id : "",
    );
    if (!session) throw new NotFoundError("No match with that id");
    res.json({ data: { session } });
  };

  resign = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(res);
    const workspaceId = GamesController.workspaceId(req);
    const gameId = typeof req.params.id === "string" ? req.params.id : "";
    const session = await this.service.resign(workspaceId, gameId, userId);
    if (!session) {
      throw new NotFoundError("No open match with that id for you");
    }
    res.json({ data: { session } });
  };

  accept = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(res);
    const workspaceId = GamesController.workspaceId(req);
    const gameId = typeof req.params.id === "string" ? req.params.id : "";
    if (await this.service.hasOpenMatch(workspaceId, userId, gameId)) {
      throw new ConflictError("Finish your open match first");
    }
    const session = await this.service.accept(workspaceId, gameId, userId);
    if (!session) {
      throw new NotFoundError("No pending invite with that id for you");
    }
    res.json({ data: { session } });
  };

  decline = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(res);
    const workspaceId = GamesController.workspaceId(req);
    const gameId = typeof req.params.id === "string" ? req.params.id : "";
    const session = await this.service.decline(workspaceId, gameId, userId);
    if (!session) {
      throw new NotFoundError("No pending invite with that id for you");
    }
    res.json({ data: { session } });
  };

  start = async (req: Request, res: Response): Promise<void> => {
    const { userId } = getAuth(res);
    const workspaceId = GamesController.workspaceId(req);
    const gameId = typeof req.params.id === "string" ? req.params.id : "";
    const session = await this.service.start(workspaceId, gameId, userId);
    if (!session) {
      throw new NotFoundError("No pending party match with that id");
    }
    res.json({ data: { session } });
  };
}
