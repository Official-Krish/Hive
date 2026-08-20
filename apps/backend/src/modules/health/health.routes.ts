import { Router } from "express";
import { prisma } from "@hive/db";
import { getRedis } from "@hive/queue";
import { env } from "../../config/env";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let db = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }
  const redis = getRedis().connected ? "ok" : "down";
  res.json({
    data: {
      status: db === "ok" && redis === "ok" ? "ok" : "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      db,
      redis,
      wsPort: Number(process.env.WS_PORT ?? 4001),
      githubClientId: env.GITHUB_CLIENT_ID,
      clientUrl: env.clientOrigins[0] ?? env.API_URL,
    },
  });
});
