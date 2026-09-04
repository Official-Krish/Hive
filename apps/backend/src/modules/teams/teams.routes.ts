import { Router } from "express";
import {
  createTeamSchema,
  updateTeamSchema,
  addTeamMemberSchema,
  teamMemberRoleSchema,
} from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { requireOrgMember, requireOrgRole } from "../../middleware/org";
import { writesLimiter } from "../../middleware/rateLimits";
import { validateBody } from "../../middleware/validate";
import { TeamController } from "./teams.controller";

const controller = new TeamController();

export const teamsRouter = Router();

teamsRouter.use(requireAuth());
teamsRouter.use(writesLimiter);

const member = requireOrgMember();

teamsRouter.get("/:orgId/teams", member, controller.list);
teamsRouter.post(
  "/:orgId/teams",
  member,
  requireOrgRole("admin", "owner"),
  validateBody(createTeamSchema),
  controller.create,
);
teamsRouter.get("/:orgId/teams/:teamId", member, controller.get);
teamsRouter.patch(
  "/:orgId/teams/:teamId",
  member,
  requireOrgRole("admin", "owner"),
  validateBody(updateTeamSchema),
  controller.update,
);
teamsRouter.delete(
  "/:orgId/teams/:teamId",
  member,
  requireOrgRole("admin", "owner"),
  controller.remove,
);
teamsRouter.get(
  "/:orgId/teams/:teamId/members",
  member,
  controller.listMembers,
);
teamsRouter.post(
  "/:orgId/teams/:teamId/members",
  member,
  requireOrgRole("admin", "owner"),
  validateBody(addTeamMemberSchema),
  controller.addMember,
);
teamsRouter.patch(
  "/:orgId/teams/:teamId/members/:userId/role",
  member,
  requireOrgRole("owner"),
  validateBody(teamMemberRoleSchema),
  controller.changeMemberRole,
);
teamsRouter.delete(
  "/:orgId/teams/:teamId/members/:userId",
  member,
  requireOrgRole("owner"),
  controller.removeMember,
);
