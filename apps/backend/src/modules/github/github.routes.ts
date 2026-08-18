import { Router } from "express";
import { requireAuth } from "../../middleware/authenticate";
import { GitHubController } from "./github.controller";

export const githubRouter = Router();
export const githubWebhookRouter = Router();

const controller = new GitHubController();

githubRouter.get("/auth/login", controller.login);
githubRouter.get("/auth/callback", controller.callback);
githubRouter.post("/disconnect", requireAuth(), controller.disconnect);

githubWebhookRouter.post("/", controller.webhook);
