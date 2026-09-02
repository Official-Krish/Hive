import { Router } from "express";
import { pairSessionCreateSchema } from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import { requireWorkspaceMember } from "../../middleware/workspace";
import { SessionsController } from "./sessions.controller";

const controller = new SessionsController();

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth());
const member = requireWorkspaceMember();

sessionsRouter.post(
  "/:workspaceId/pair-sessions",
  member,
  validateBody(pairSessionCreateSchema),
  controller.create,
);
sessionsRouter.get(
  "/:workspaceId/pair-sessions/active",
  member,
  controller.active,
);
sessionsRouter.patch(
  "/:workspaceId/pair-sessions/:sessionId/end",
  member,
  controller.end,
);
