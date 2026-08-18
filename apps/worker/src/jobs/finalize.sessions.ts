import { z } from "zod";
import { prisma } from "@hive/db";
import { logger } from "../lib/logger";

export const schema = z.object({});

export async function handler(): Promise<void> {
  const result = await prisma.agentSession.updateMany({
    where: { endedAt: { not: null }, status: "RUNNING" },
    data: { status: "COMPLETED" },
  });
  logger.info(`[finalize.sessions] finalized ${result.count} sessions`);
}
