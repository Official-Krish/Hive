import { Router } from "express";
import { updatePrivacySettingSchema } from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import {
  requireWorkspaceMember,
  requireWorkspaceRole,
} from "../../middleware/workspace";
import { PrivacyController } from "./privacy.controller";

const controller = new PrivacyController();

export const privacyRouter = Router();

privacyRouter.use(requireAuth());

const member = requireWorkspaceMember();

privacyRouter.get("/:workspaceId/privacy", member, controller.get);
privacyRouter.patch(
  "/:workspaceId/privacy",
  member,
  requireWorkspaceRole("admin", "owner"),
  validateBody(updatePrivacySettingSchema),
  controller.update,
);
