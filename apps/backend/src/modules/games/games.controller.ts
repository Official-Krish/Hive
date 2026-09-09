import type { Request, Response } from "express";
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
    const input = req.body as GameSessionCreate;
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
    const session = await this.service.create(
      workspaceId,
      input,
      userId,
      new Map(users.map((u) => [u.id, u.name])),
    );
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
