import { z } from "zod";

export const presenceStatusSchema = z.enum([
  "online",
  "away",
  "on_call",
  "busy",
  "focusing",
  "offline",
]);

export const pairSessionMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
});

export const pairSessionSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  status: z.enum(["pending", "active", "ended"]),
  repositoryId: z.string().nullable(),
  members: z.array(pairSessionMemberSchema).min(2).max(2),
  startedBy: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});
export type PairSession = z.infer<typeof pairSessionSchema>;

export const pairSessionCreateSchema = z.object({
  roomId: z.string().min(1).max(100),
  repositoryId: z.string().min(1).max(120).nullable().optional(),
  members: z.array(z.string()).min(2).max(2),
});
export type PairSessionCreate = z.infer<typeof pairSessionCreateSchema>;

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
  /** The GLB the member picked on the dashboard — null until they choose one. */
  mapAvatarModel: z.string().nullable(),
  /** Live status of their current/latest agent session (null when none). */
  sessionStatus: z.string().nullable(),
  /** Repo (owner/name) of their current/latest agent session. */
  project: z.string().nullable(),
  /** User-set presence label (e.g. "Shipping 🚀"), null when unset. */
  label: z.string().nullable(),
  /** User-set "currently working on" (e.g. "LiveKit integration"). */
  workingOn: z.string().max(60).nullable(),
  status: presenceStatusSchema,
  position: avatarPositionSchema.nullable(),
});
export type RealtimeMember = z.infer<typeof realtimeMemberSchema>;

export const whiteboardPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export const whiteboardStrokeSchema = z.object({
  strokeId: z.string().min(1).max(80),
  color: z.string().min(1).max(32),
  width: z.number().min(0.5).max(64),
  points: z.array(whiteboardPointSchema).min(2).max(4096),
});
export type WhiteboardStroke = z.infer<typeof whiteboardStrokeSchema>;

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
    /** Optional user-set label, e.g. "Shipping 🚀" or "On call w/ acme". */
    label: z.string().max(60).nullable().optional(),
    /** Optional user-set "currently working on" text. */
    workingOn: z.string().max(60).nullable().optional(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("chat.message"),
    workspaceId: z.string(),
    conversationId: z.string(),
    clientId: z.string().nullable().optional(),
    message: z.object({
      id: z.string(),
      senderId: z.string(),
      body: z.string(),
      createdAt: z.string(),
    }),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("chat.typing"),
    workspaceId: z.string(),
    conversationId: z.string(),
    userId: z.string(),
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
    type: z.literal("agent.status"),
    workspaceId: z.string(),
    developerId: z.string(),
    sessionId: z.string(),
    status: z.enum(["running", "blocked", "waiting_approval"]),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("test.finished"),
    workspaceId: z.string(),
    developerId: z.string(),
    repositoryName: z.string().nullable(),
    passed: z.boolean(),
    durationMs: z.number().nullable(),
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
  z.object({
    type: z.literal("repo.push"),
    workspaceId: z.string(),
    repositoryId: z.string(),
    repoName: z.string(),
    branch: z.string(),
    commitCount: z.number(),
    headSha: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("pr.updated"),
    workspaceId: z.string(),
    repositoryId: z.string(),
    repoName: z.string(),
    prNumber: z.number(),
    title: z.string(),
    status: z.string(),
    authorId: z.string().nullable().optional(),
    authorName: z.string().nullable().optional(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("github.notification"),
    workspaceId: z.string(),
    developerId: z.string(),
    notification: z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      body: z.string().nullable(),
      repository: z.string(),
      url: z.string().url(),
      createdAt: z.string().datetime(),
    }),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("social.bump"),
    workspaceId: z.string(),
    developerId: z.string(),
    roomId: z.string().max(100).nullable(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("whiteboard.stroke"),
    workspaceId: z.string(),
    boardId: z.string().min(1).max(120),
    stroke: whiteboardStrokeSchema,
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("whiteboard.clear"),
    workspaceId: z.string(),
    boardId: z.string().min(1).max(120),
    clearedBy: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("whiteboard.history"),
    workspaceId: z.string(),
    boardId: z.string().min(1).max(120),
    strokes: z.array(whiteboardStrokeSchema).max(200),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("focus.invite"),
    workspaceId: z.string(),
    fromId: z.string(),
    toId: z.string(),
    action: z.enum(["invite", "accept", "decline", "end"]),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("pair.session"),
    workspaceId: z.string(),
    session: pairSessionSchema,
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("pair.cursor"),
    workspaceId: z.string(),
    sessionId: z.string(),
    developerId: z.string(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
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
    status: z.enum(["online", "away", "on_call", "busy", "focusing"]),
    /** Optional user-set label shown next to their name. */
    label: z.string().min(1).max(60).optional(),
    /** Optional user-set "currently working on" text; null clears it. */
    workingOn: z.string().min(1).max(60).nullable().optional(),
  }),
  z.object({
    type: z.literal("chat.send"),
    conversationId: z.string().min(1),
    /** Client-generated id for echo dedupe. */
    clientId: z.string().min(1).max(64),
    body: z.string().min(1).max(4000),
  }),
  z.object({
    type: z.literal("chat.typing"),
    conversationId: z.string().min(1),
  }),
  z.object({
    type: z.literal("github.notification.read"),
    notificationId: z.string().min(1),
  }),
  z.object({
    type: z.literal("social.bump"),
    roomId: z.string().min(1).max(100).nullable(),
  }),
  z.object({
    type: z.literal("whiteboard.stroke"),
    boardId: z.string().min(1).max(120),
    stroke: whiteboardStrokeSchema,
  }),
  z.object({
    type: z.literal("whiteboard.clear"),
    boardId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("whiteboard.history.request"),
    boardId: z.string().min(1).max(120),
  }),
  z.object({
    type: z.literal("focus.invite"),
    toId: z.string().min(1),
    action: z.enum(["invite", "accept", "decline", "end"]),
  }),
  z.object({
    type: z.literal("pair.cursor"),
    sessionId: z.string().min(1),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
]);

export type RealtimeClientMessage = z.infer<typeof realtimeClientMessageSchema>;

/** Commands the backend can push to a connected collector device. */
export const deviceCommandSchema = z.enum(["shutdown", "reconnect", "ping"]);

/**
 * Server → device control message, sent over the device WebSocket channel.
 * `ping` doubles as a connection acknowledgement on open.
 */
export const deviceControlSchema = z.object({
  type: z.literal("control"),
  cmd: deviceCommandSchema,
  timestamp: z.number(),
});
export type DeviceControl = z.infer<typeof deviceControlSchema>;

/**
 * Messages sent from a collector device to the server over WebSocket.
 */
export const deviceMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heartbeat"),
    timestamp: z.number(),
  }),
]);
export type DeviceMessage = z.infer<typeof deviceMessageSchema>;

/** Bun WebSocket pub/sub topic per workspace. */
export function realtimeChannel(workspaceId: string): string {
  return `realtime:workspace:${workspaceId}`;
}

/** Bun WebSocket pub/sub topic per device (collector control channel). */
export function deviceChannel(deviceId: string): string {
  return `realtime:device:${deviceId}`;
}
