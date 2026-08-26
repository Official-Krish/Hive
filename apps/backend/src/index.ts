import { prisma } from "@hive/db";
import { closeRedis, ensureConnected } from "@hive/queue";
import { createApp } from "./app";
import { env } from "./config/env";
import { queue } from "./lib/queue";
import { IssueMatcherService } from "./modules/ai/issue-matcher.service";
import { RealtimeHub } from "./modules/realtime/realtime.hub";

async function main(): Promise<void> {
  await prisma.$connect();

  const redisConnected = await ensureConnected();
  if (!redisConnected) {
    console.warn(
      "Redis unavailable, queue enqueues will fail until it recovers",
    );
  }

  const app = createApp();
  const server = app.listen(env.PORT);

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

  const shutdown = async (): Promise<void> => {
    queue.stop();
    await realtime.stop();
    closeRedis();
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
