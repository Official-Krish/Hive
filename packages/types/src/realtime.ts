import { z } from "zod";

/**
 * Realtime events streamed to clients over SSE.
 *
 * Architecture: Postgres is the source of truth, Redis is the realtime
 * distribution layer, SSE is the delivery mechanism. Domain writes hit the
 * DB first, then the backend publishes a normalized event to Redis Pub/Sub,
 * which fans out to connected SSE clients.
 */
export const realtimeEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("presence.changed"),
    workspaceId: z.string(),
    developerId: z.string(),
    status: z.enum(["online", "away", "offline"]),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("activity.updated"),
    workspaceId: z.string(),
    developerId: z.string(),
    activityId: z.string(),
    status: z.string(),
    summary: z.string().nullable(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("agent.started"),
    workspaceId: z.string(),
    developerId: z.string(),
    sessionId: z.string(),
    agent: z.string(),
    title: z.string().nullable(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("agent.stopped"),
    workspaceId: z.string(),
    developerId: z.string(),
    sessionId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("avatar.moved"),
    workspaceId: z.string(),
    developerId: z.string(),
    roomId: z.string().nullable(),
    x: z.number(),
    y: z.number(),
    timestamp: z.number(),
  }),
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

/** Redis Pub/Sub channel per workspace that SSE subscribers listen on. */
export function realtimeChannel(workspaceId: string): string {
  return `realtime:workspace:${workspaceId}`;
}
