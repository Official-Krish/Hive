import { Router } from "express";
import { gameSessionCreateSchema } from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { writesLimiter } from "../../middleware/rateLimits";
import { validateBody } from "../../middleware/validate";
import { requireWorkspaceMember } from "../../middleware/workspace";
import { GamesController } from "./games.controller";

const controller = new GamesController();

export const gamesRouter = Router();

gamesRouter.use(requireAuth());
gamesRouter.use(writesLimiter);
const member = requireWorkspaceMember();

gamesRouter.post(
  "/:workspaceId/games",
  member,
  validateBody(gameSessionCreateSchema),
  controller.create,
);
gamesRouter.get("/:workspaceId/games/active", member, controller.active);
gamesRouter.get("/:workspaceId/games", member, controller.list);
gamesRouter.get("/:workspaceId/games/:id", member, controller.byId);
gamesRouter.patch("/:workspaceId/games/:id/resign", member, controller.resign);
gamesRouter.patch("/:workspaceId/games/:id/accept", member, controller.accept);
gamesRouter.patch(
  "/:workspaceId/games/:id/decline",
  member,
  controller.decline,
);
