import { pino } from "pino";
import { env } from "../config/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "hive-worker" },
  redact: {
    paths: ["payload.accessToken", "payload.webhookSecret"],
    censor: "[REDACTED]",
  },
});

export type Logger = typeof logger;
