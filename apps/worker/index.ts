import { prisma } from "@hive/db";
import { Queue, Scheduler, closeRedis } from "@hive/queue";
import { env } from "./src/config/env";
import { logger } from "./src/lib/logger";
import { dispatch } from "./src/jobs";

const queue = new Queue({ logger });
const scheduler = new Scheduler(queue, { logger });

scheduler.every("metrics.aggregate", env.METRICS_INTERVAL_MS, () => ({
  name: "metrics.aggregate",
  payload: {
    windows: (["DAY", "WEEK", "MONTH"] as const).map((period) => ({
      period,
      periodStart: windowStart(period).toISOString(),
    })),
  },
}));

scheduler.every("reaper.refresh-tokens", env.REAPER_INTERVAL_MS, () => ({
  name: "reaper.refresh-tokens",
  payload: {},
}));
scheduler.every("reaper.idempotency-keys", env.REAPER_INTERVAL_MS, () => ({
  name: "reaper.idempotency-keys",
  payload: {},
}));
scheduler.every("reaper.invites", env.REAPER_INTERVAL_MS, () => ({
  name: "reaper.invites",
  payload: {},
}));
scheduler.every("reaper.api-keys", env.REAPER_INTERVAL_MS, () => ({
  name: "reaper.api-keys",
  payload: {},
}));
scheduler.every("reaper.webhook-deliveries", env.REAPER_INTERVAL_MS, () => ({
  name: "reaper.webhook-deliveries",
  payload: {},
}));
scheduler.every("presence.sweep", env.PRESENCE_INTERVAL_MS, () => ({
  name: "presence.sweep",
  payload: {},
}));
scheduler.every("finalize.sessions", env.FINALIZE_INTERVAL_MS, () => ({
  name: "finalize.sessions",
  payload: {},
}));
scheduler.every("finalize.activities", env.FINALIZE_INTERVAL_MS, () => ({
  name: "finalize.activities",
  payload: {},
}));

scheduler.start();
logger.info("hive worker started");

const consumer = queue.start((job) => dispatch(job));

async function shutdown(signal: string): Promise<void> {
  logger.info(`received ${signal}, shutting down`);
  scheduler.stop();
  queue.stop();
  closeRedis();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await consumer;

function windowStart(period: "DAY" | "WEEK" | "MONTH"): Date {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (period === "DAY") start.setUTCDate(start.getUTCDate() - 1);
  if (period === "WEEK") start.setUTCDate(start.getUTCDate() - 7);
  if (period === "MONTH") start.setUTCMonth(start.getUTCMonth() - 1);
  return start;
}
