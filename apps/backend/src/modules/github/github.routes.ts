import { Router } from "express";
import { githubTokenSchema } from "@hive/types";
import { requireAuth } from "../../middleware/authenticate";
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

githubWebhookRouter.post("/", controller.webhook);
