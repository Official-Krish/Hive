import { z } from "zod";
import { prisma } from "@hive/db";
import { logger } from "../lib/logger";

export const schema = z.object({});

export async function handler(): Promise<void> {
  const result = await prisma.apiKey.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  logger.info(`[reaper.api-keys] expired ${result.count} api keys`);
}
