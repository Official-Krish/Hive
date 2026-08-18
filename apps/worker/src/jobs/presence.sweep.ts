import { z } from "zod";
import { prisma } from "@hive/db";
import { env } from "../config/env";
import { logger } from "../lib/logger";

export const schema = z.object({});

export async function handler(): Promise<void> {
  const awayCutoff = new Date(Date.now() - env.PRESENCE_AWAY_SECONDS * 1000);
  const offlineCutoff = new Date(
    Date.now() - env.PRESENCE_OFFLINE_SECONDS * 1000,
  );

  const toAway = await prisma.presence.updateMany({
    where: { status: "ONLINE", lastSeenAt: { lt: awayCutoff } },
    data: { status: "AWAY" },
  });

  const toOffline = await prisma.presence.updateMany({
    where: { status: "AWAY", lastSeenAt: { lt: offlineCutoff } },
    data: { status: "OFFLINE" },
  });

  logger.info(
    `[presence.sweep] ${toAway.count} online->away, ${toOffline.count} away->offline`,
  );
}
