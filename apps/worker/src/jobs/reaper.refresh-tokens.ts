import { z } from "zod";
import { prisma } from "@hive/db";
import { logger } from "../lib/logger";

export const schema = z.object({});

export async function handler(): Promise<void> {
  const result = await prisma.refreshToken.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  logger.info(`[reaper.refresh-tokens] expired ${result.count} refresh tokens`);
}
