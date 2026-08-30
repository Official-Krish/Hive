import { prisma } from "@hive/db";
import { AccessToken } from "livekit-server-sdk";
import { env } from "../../config/env";
import { AppError } from "../../core/errors";
import { presenceBus } from "../../modules/realtime/realtime.bus";

export interface LivekitTokenResult {
  url: string;
  token: string;
  room: string;
}

/**
 * Issues short-lived LiveKit JWTs for workspace members. The API secret never
 * leaves the server — the browser only ever receives a token plus the WS url.
 */
export class LivekitService {
  async createToken(
    workspaceId: string,
    userId: string,
  ): Promise<LivekitTokenResult> {
    const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = env;
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      throw new AppError(
        503,
        "LIVEKIT_UNCONFIGURED",
        "Voice/video is not configured on the server",
      );
    }

    const online = presenceBus.onlineCount(workspaceId);
    if (online < 2) {
      throw new AppError(
        409,
        "ROOM_NOT_READY",
        "No one else is online in this workspace yet",
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const room = `hive-${workspaceId}`;
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId,
      name: user?.name ?? "Member",
      ttl: "6h",
    });
    token.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
    });

    return {
      url: LIVEKIT_URL,
      token: await token.toJwt(),
      room,
    };
  }
}
