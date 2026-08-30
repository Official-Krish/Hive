import { Router } from "express";
import {
  activityFilterSchema,
  alertFilterSchema,
  metricFilterSchema,
  prFilterSchema,
  sessionFilterSchema,
  taskFilterSchema,
  testRunFilterSchema,
} from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import { validateQuery } from "../../middleware/validate";
import {
  requireWorkspaceMember,
  requireWorkspaceRole,
} from "../../middleware/workspace";
import { ReadsController } from "./reads.controller";

const controller = new ReadsController();

export const readsRouter = Router();

readsRouter.use(requireAuth());

const member = requireWorkspaceMember();

readsRouter.get("/:workspaceId/map", member, controller.map);
readsRouter.get(
  "/:workspaceId/map/overlay/:developerId",
  member,
  controller.getMapOverlay,
);
readsRouter.get(
  "/:workspaceId/activities",
  member,
  validateQuery(activityFilterSchema),
  controller.listActivities,
);
readsRouter.get(
  "/:workspaceId/activities/:activityId",
  member,
  controller.getActivity,
);
readsRouter.get(
  "/:workspaceId/agent-sessions",
  member,
  validateQuery(sessionFilterSchema),
  controller.listSessions,
);
readsRouter.get(
  "/:workspaceId/agent-sessions/:sessionId",
  member,
  controller.getSession,
);
readsRouter.get(
  "/:workspaceId/repositories",
  member,
  controller.listRepositories,
);
readsRouter.get(
  "/:workspaceId/repositories/:repositoryId",
  member,
  controller.getRepository,
);
readsRouter.get(
  "/:workspaceId/pull-requests",
  member,
  validateQuery(prFilterSchema),
  controller.listPullRequests,
);
readsRouter.get(
  "/:workspaceId/metrics",
  member,
  validateQuery(metricFilterSchema),
  controller.listMetrics,
);
readsRouter.get(
  "/:workspaceId/alerts",
  member,
  validateQuery(alertFilterSchema),
  controller.listAlerts,
);
readsRouter.post(
  "/:workspaceId/alerts/:alertId/resolve",
  member,
  requireWorkspaceRole("developer", "maintainer", "admin", "owner"),
  controller.resolveAlert,
);
readsRouter.get(
  "/:workspaceId/tasks",
  member,
  validateQuery(taskFilterSchema),
  controller.listTasks,
);
readsRouter.get(
  "/:workspaceId/test-runs",
  member,
  validateQuery(testRunFilterSchema),
  controller.listTestRuns,
);
readsRouter.get(
  "/:workspaceId/developers/:developerId/stats",
  member,
  controller.getDeveloperStats,
);

// Workspace-agnostic reads (still require a valid session).
export const modelsRouter = Router();
modelsRouter.use(requireAuth());
modelsRouter.get("/", controller.listModels);
