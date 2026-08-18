import { Router } from "express";
import { prisma } from "@hive/db";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let db = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }
  res.json({
    data: {
      status: db === "ok" ? "ok" : "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      db,
    },
  });
});
