import { Router } from "express";
import {
  linkRepoInputSchema,
  createGithubInviteInputSchema,
  createInviteInputSchema,
  createWorkspaceInputSchema,
  transferOwnershipSchema,
  updateMemberRoleSchema,
  updateWorkspaceInputSchema,
} from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate";
import {
  requireWorkspaceMember,
  requireWorkspaceRole,
} from "../../middleware/workspace";
import { WorkspaceController } from "./workspaces.controller";
import { LivekitController } from "../livekit/livekit.controller";

const controller = new WorkspaceController();
const livekitController = new LivekitController();

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth());

workspacesRouter.get("/", controller.list);
workspacesRouter.post(
  "/",
  validateBody(createWorkspaceInputSchema),
  controller.create,
);

workspacesRouter.get("/:workspaceId", requireWorkspaceMember(), controller.get);
workspacesRouter.patch(
  "/:workspaceId",
  requireWorkspaceMember(),
  requireWorkspaceRole("maintainer", "admin", "owner"),
  validateBody(updateWorkspaceInputSchema),
  controller.update,
);
workspacesRouter.delete(
  "/:workspaceId",
  requireWorkspaceMember(),
  requireWorkspaceRole("owner"),
  controller.remove,
);
workspacesRouter.get(
  "/:workspaceId/settings",
  requireWorkspaceMember(),
  requireWorkspaceRole("member", "developer", "maintainer", "admin", "owner"),
  controller.getSettings,
);
workspacesRouter.post(
  "/:workspaceId/settings/rotate-secret",
  requireWorkspaceMember(),
  requireWorkspaceRole("admin", "owner"),
  controller.rotateSecret,
);
workspacesRouter.post(
  "/:workspaceId/settings/repositories",
  requireWorkspaceMember(),
  requireWorkspaceRole("maintainer", "admin", "owner"),
  validateBody(linkRepoInputSchema),
  controller.linkRepo,
);
workspacesRouter.delete(
  "/:workspaceId/settings/repositories/:id",
  requireWorkspaceMember(),
  requireWorkspaceRole("maintainer", "admin", "owner"),
  controller.unlinkRepo,
);

workspacesRouter.post(
  "/:workspaceId/transfer",
  requireWorkspaceMember(),
  requireWorkspaceRole("owner"),
  validateBody(transferOwnershipSchema),
  controller.transferOwnership,
);

workspacesRouter.get(
  "/:workspaceId/members",
  requireWorkspaceMember(),
  requireWorkspaceRole("member", "developer", "maintainer", "admin", "owner"),
  controller.listMembers,
);
workspacesRouter.patch(
  "/:workspaceId/members/:userId",
  requireWorkspaceMember(),
  requireWorkspaceRole("maintainer", "admin", "owner"),
  validateBody(updateMemberRoleSchema),
  controller.changeMemberRole,
);
workspacesRouter.delete(
  "/:workspaceId/members/:userId",
  requireWorkspaceMember(),
  requireWorkspaceRole("maintainer", "admin", "owner"),
  controller.removeMember,
);

workspacesRouter.post(
  "/:workspaceId/invites",
  requireWorkspaceMember(),
  requireWorkspaceRole("maintainer", "admin", "owner"),
  validateBody(createInviteInputSchema),
  controller.invite,
);
workspacesRouter.post(
  "/:workspaceId/invites/github",
  requireWorkspaceMember(),
  requireWorkspaceRole("maintainer", "admin", "owner"),
  validateBody(createGithubInviteInputSchema),
  controller.inviteByGithub,
);
workspacesRouter.get(
  "/:workspaceId/invites",
  requireWorkspaceMember(),
  controller.listInvites,
);
workspacesRouter.delete(
  "/:workspaceId/invites/:inviteId",
  requireWorkspaceMember(),
  requireWorkspaceRole("maintainer", "admin", "owner"),
  controller.revokeInvite,
);

workspacesRouter.post(
  "/:workspaceId/livekit/token",
  requireWorkspaceMember(),
  livekitController.token,
);

export const invitesRouter = Router();
invitesRouter.use(requireAuth());
invitesRouter.get("/", controller.listReceived);
invitesRouter.post("/id/:inviteId/accept", controller.acceptById);
invitesRouter.post("/:token/accept", controller.accept);
