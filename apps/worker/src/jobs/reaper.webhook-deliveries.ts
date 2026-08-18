import { z } from "zod";
import { prisma } from "@hive/db";
import { env } from "../config/env";
import { logger } from "../lib/logger";

export const schema = z.object({});

export async function handler(): Promise<void> {
  const cutoff = new Date(
    Date.now() - env.WEBHOOK_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const result = await prisma.webhookDelivery.deleteMany({
    where: { receivedAt: { lt: cutoff } },
  });
  logger.info(
    `[reaper.webhook-deliveries] purged ${result.count} deliveries older than ${env.WEBHOOK_RETENTION_DAYS} days`,
  );
}
