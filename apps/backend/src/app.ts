import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { csrfProtect } from "./middleware/csrfProtect";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { requestContext } from "./middleware/requestContext";
import { globalLimiter, githubWebhookLimiter } from "./middleware/rateLimits";
import { authRouter } from "./modules/auth/auth.routes";
import { devicesRouter } from "./modules/devices/devices.routes";
import { ingestRouter } from "./modules/ingest/ingest.routes";
import { readsRouter, modelsRouter } from "./modules/reads/reads.routes";
import {
  githubRouter,
  githubWebhookRouter,
} from "./modules/github/github.routes";
import { healthRouter } from "./modules/health/health.routes";
import { usersRouter } from "./modules/users/users.routes";
import {
  invitesRouter,
  workspacesRouter,
} from "./modules/workspaces/workspaces.routes";
import { privacyRouter } from "./modules/privacy/privacy.routes";
import { orgsRouter } from "./modules/orgs/orgs.routes";
import { teamsRouter } from "./modules/teams/teams.routes";
import { issuesRouter } from "./modules/issues/issues.routes";
import { conversationsRouter } from "./modules/messages/messages.routes";
import { sessionsRouter } from "./modules/sessions/sessions.routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: [env.API_URL, ...env.clientOrigins],
      credentials: true,
    }),
  );
  app.use(requestContext());
  // GitHub webhooks need the raw body for HMAC verification and arrive without
  // an allowed Origin, so they must bypass CSRF and the JSON body parser.
  app.use(
    "/api/v1/github/webhooks",
    express.raw({ type: "*/*" }),
    githubWebhookLimiter,
    githubWebhookRouter,
  );
  app.use(csrfProtect());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Whole-API rate-limit safety net (per peer IP). Route-specific budgets are
  // applied inside individual routers after identity is resolved.
  app.use("/api/v1", globalLimiter);

  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/auth", usersRouter);
  app.use("/api/v1/devices", devicesRouter);
  app.use("/api/v1/ingest", ingestRouter);
  app.use("/api/v1/github", githubRouter);
  app.use("/api/v1/workspaces", workspacesRouter);
  app.use("/api/v1/workspaces", readsRouter);
  app.use("/api/v1/workspaces", privacyRouter);
  app.use("/api/v1/workspaces", issuesRouter);
  app.use("/api/v1/workspaces", sessionsRouter);
  app.use("/api/v1/models", modelsRouter);
  app.use("/api/v1/invites", invitesRouter);
  app.use("/api/v1/orgs", orgsRouter);
  app.use("/api/v1/orgs", teamsRouter);
  app.use("/api/v1/workspaces", conversationsRouter);

  app.use(notFound());
  app.use(errorHandler());

  return app;
}

export type App = ReturnType<typeof createApp>;
