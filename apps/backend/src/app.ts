import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { csrfProtect } from "./middleware/csrfProtect";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { requestContext } from "./middleware/requestContext";
import { authRouter } from "./modules/auth/auth.routes";
import { devicesRouter } from "./modules/devices/devices.routes";
import { ingestRouter } from "./modules/ingest/ingest.routes";
import {
  githubRouter,
  githubWebhookRouter,
} from "./modules/github/github.routes";
import { healthRouter } from "./modules/health/health.routes";
import { usersRouter } from "./modules/users/users.routes";

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
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.headers["x-request-id"] ?? randomUUID(),
      customLogLevel: (_req, res, err) => {
        if (err) return "error";
        if (res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    }),
  );
  app.use(requestContext());
  // GitHub webhooks need the raw body for HMAC verification and arrive without
  // an allowed Origin, so they must bypass CSRF and the JSON body parser.
  app.use(
    "/api/github/webhooks",
    express.raw({ type: "*/*" }),
    githubWebhookRouter,
  );
  app.use(csrfProtect());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/auth", usersRouter);
  app.use("/api/devices", devicesRouter);
  app.use("/api/ingest", ingestRouter);
  app.use("/api/github", githubRouter);

  app.use(notFound());
  app.use(errorHandler());

  return app;
}

export type App = ReturnType<typeof createApp>;
