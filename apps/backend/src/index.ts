import { prisma } from "@hive/db";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { RealtimeHub } from "./modules/realtime/realtime.hub";

async function main(): Promise<void> {
  await prisma.$connect();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, url: env.API_URL },
      "API server listening",
    );
  });

  const realtime = new RealtimeHub({ port: env.WS_PORT }).start();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down");
    await realtime.stop();
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
