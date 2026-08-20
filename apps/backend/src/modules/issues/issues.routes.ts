import { Router } from "express";
import { issueFilterSchema } from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { validateQuery } from "../../middleware/validate";
import { requireWorkspaceMember } from "../../middleware/workspace";
import { IssuesController } from "./issues.controller";

const controller = new IssuesController();

export const issuesRouter = Router();

issuesRouter.use(requireAuth());

const member = requireWorkspaceMember();

issuesRouter.get(
  "/:workspaceId/issues",
  member,
  validateQuery(issueFilterSchema),
  controller.listIssues,
);
issuesRouter.get("/:workspaceId/issues/:issueId", member, controller.getIssue);
