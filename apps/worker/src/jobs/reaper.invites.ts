import { z } from "zod";
import { prisma } from "@hive/db";
import { logger } from "../lib/logger";

export const schema = z.object({});

export async function handler(): Promise<void> {
  const result = await prisma.invite.deleteMany({
    where: { expiresAt: { lt: new Date() }, acceptedAt: null, revokedAt: null },
  });
  logger.info(`[reaper.invites] purged ${result.count} expired invites`);
}
