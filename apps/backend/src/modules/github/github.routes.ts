import { Router } from "express";
import { githubTokenSchema } from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
import {
  requireWorkspaceMember,
  requireWorkspaceRole,
} from "../../middleware/workspace";
import { validateBody } from "../../middleware/validate";
import { GitHubController } from "./github.controller";

export const githubRouter = Router();
export const githubWebhookRouter = Router();

const controller = new GitHubController();

githubRouter.get("/auth/login", controller.login);
githubRouter.get("/auth/url", controller.loginUrl);
githubRouter.get("/auth/callback", controller.callback);
githubRouter.get("/callback", controller.callback);
githubRouter.post(
  "/auth/token",
  validateBody(githubTokenSchema),
  controller.exchangeToken,
);
githubRouter.post("/disconnect", requireAuth(), controller.disconnect);
githubRouter.get("/repos", requireAuth(), controller.listRepos);
githubRouter.get("/notifications", requireAuth(), controller.listNotifications);
githubRouter.post(
  "/notifications/:id/read",
  requireAuth(),
  controller.markRead,
);
githubRouter.post(
  "/notifications/read-all",
  requireAuth(),
  controller.markAllRead,
);

githubRouter.get(
  "/:workspaceId/app/install/url",
  requireAuth(),
  requireWorkspaceMember(),
  requireWorkspaceRole("maintainer", "admin", "owner"),
  controller.appInstallUrl,
);
githubRouter.get(
  "/app/install/callback",
  requireAuth(),
  controller.appInstallCallback,
);
githubRouter.get(
  "/:workspaceId/installations",
  requireAuth(),
  requireWorkspaceMember(),
  requireWorkspaceRole("maintainer", "admin", "owner"),
  controller.listInstallations,
);
githubRouter.delete(
  "/:workspaceId/installations/:id",
  requireAuth(),
  requireWorkspaceMember(),
  requireWorkspaceRole("maintainer", "admin", "owner"),
  controller.deleteInstallation,
);

githubWebhookRouter.post("/", controller.webhook);
