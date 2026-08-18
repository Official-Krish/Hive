import { z } from "zod";

export const presenceStatusSchema = z.enum(["online", "away", "offline"]);

/**
 * Realtime events sent from the server to clients over WebSocket.
 *
 * Architecture: Postgres is the source of truth. Domain writes hit the DB
 * first, then the backend broadcasts a normalized event to every client
 * subscribed to the workspace topic (`realtimeChannel(workspaceId)`).
 */
export const avatarPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  roomId: z.string().nullable(),
});
export type AvatarPosition = z.infer<typeof avatarPositionSchema>;

export const realtimeMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  status: presenceStatusSchema,
  position: avatarPositionSchema.nullable(),
});
export type RealtimeMember = z.infer<typeof realtimeMemberSchema>;

export const realtimeEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    workspaceId: z.string(),
    mapId: z.string(),
    /** Snapshot of every member's presence + avatar position at join time. */
    members: z.array(realtimeMemberSchema),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("presence.changed"),
    workspaceId: z.string(),
    developerId: z.string(),
    status: presenceStatusSchema,
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

/**
 * Messages sent from a client to the server over WebSocket.
 */
export const realtimeClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("avatar.move"),
    x: z.number(),
    y: z.number(),
    roomId: z.string().min(1).max(100).nullable(),
  }),
  z.object({
    type: z.literal("presence.update"),
    status: z.enum(["online", "away"]),
  }),
]);

export type RealtimeClientMessage = z.infer<typeof realtimeClientMessageSchema>;

/** Bun WebSocket pub/sub topic per workspace. */
export function realtimeChannel(workspaceId: string): string {
  return `realtime:workspace:${workspaceId}`;
}
