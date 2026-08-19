import { Router } from "express";
import { updateOrgInputSchema, updateOrgMemberRoleSchema } from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { requireOrgMember, requireOrgRole } from "../../middleware/org";
import { validateBody } from "../../middleware/validate";
import { OrgController } from "./orgs.controller";

const controller = new OrgController();

export const orgsRouter = Router();

orgsRouter.use(requireAuth());

const member = requireOrgMember();

orgsRouter.get("/:orgId", member, controller.get);
orgsRouter.patch(
  "/:orgId",
  member,
  requireOrgRole("admin", "owner"),
  validateBody(updateOrgInputSchema),
  controller.update,
);
orgsRouter.get("/:orgId/members", member, controller.listMembers);
orgsRouter.get("/:orgId/workspaces", member, controller.listWorkspaces);
orgsRouter.patch(
  "/:orgId/members/:userId/role",
  member,
  requireOrgRole("owner"),
  validateBody(updateOrgMemberRoleSchema),
  controller.changeMemberRole,
);
orgsRouter.delete(
  "/:orgId/members/:userId",
  member,
  requireOrgRole("owner"),
  controller.removeMember,
);
