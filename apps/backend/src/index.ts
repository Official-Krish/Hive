import { prisma } from "@hive/db";
import { closeRedis, ensureConnected } from "@hive/queue";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { queue } from "./lib/queue";
import { IssueMatcherService } from "./modules/ai/issue-matcher.service";
import { RealtimeHub } from "./modules/realtime/realtime.hub";

async function main(): Promise<void> {
  await prisma.$connect();

  const redisConnected = await ensureConnected();
  if (redisConnected) {
    logger.info("Redis connected");
  } else {
    logger.warn(
      "Redis unavailable, queue enqueues will fail until it recovers",
    );
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, url: env.API_URL },
      "API server listening",
    );
  });

  const realtime = new RealtimeHub({ port: env.WS_PORT }).start();

  const issueMatcher = new IssueMatcherService();
  void queue.start((job) => {
    if (job.name === "issue.match") {
      const { sessionId } = job.payload as { sessionId?: string };
      if (typeof sessionId === "string") {
        return issueMatcher.matchSession(sessionId);
      }
    }
    return undefined;
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down");
    queue.stop();
    await realtime.stop();
    closeRedis();
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
