import { z } from "zod";

export const activityTypeSchema = z.enum([
  "coding",
  "agent",
  "review",
  "testing",
  "debugging",
  "research",
  "idle",
]);

export const activityStatusSchema = z.enum([
  "in_progress",
  "completed",
  "cancelled",
  "blocked",
]);

export const outcomeStatusSchema = z.enum([
  "success",
  "failed",
  "blocked",
  "cancelled",
]);

export const activityStartedSchema = z.object({
  type: z.literal("activity.started"),
  timestamp: z.string().datetime(),
  activityId: z.string().min(1),
  activityType: activityTypeSchema,
  title: z.string().min(1).max(500),
  summary: z.string().max(2000).optional(),
  repository: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
});

export const activityUpdatedSchema = z.object({
  type: z.literal("activity.updated"),
  timestamp: z.string().datetime(),
  activityId: z.string().min(1),
  status: activityStatusSchema.optional(),
  summary: z.string().max(2000).nullable().optional(),
  filesChanged: z.number().int().nonnegative().optional(),
  linesChanged: z.number().int().nonnegative().optional(),
});

export const activityStoppedSchema = z.object({
  type: z.literal("activity.stopped"),
  timestamp: z.string().datetime(),
  activityId: z.string().min(1),
  outcome: outcomeStatusSchema.optional(),
});

export const activityEventSchema = z.discriminatedUnion("type", [
  activityStartedSchema,
  activityUpdatedSchema,
  activityStoppedSchema,
]);
export type ActivityEvent = z.infer<typeof activityEventSchema>;
