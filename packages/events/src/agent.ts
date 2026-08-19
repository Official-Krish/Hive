import { z } from "zod";

export const agentTypeSchema = z.enum([
  "claude",
  "codex",
  "cursor",
  "opencode",
  "generic",
]);

export const agentStatusSchema = z.enum([
  "completed",
  "error",
  "blocked",
  "stopped",
  "waiting_approval",
]);

export const agentStartedSchema = z.object({
  type: z.literal("agent.started"),
  timestamp: z.string().datetime(),
  sessionId: z.string().min(1),
  agent: agentTypeSchema,
  model: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  title: z.string().max(500).nullable().optional(),
  repository: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
});

export const agentStoppedSchema = z.object({
  type: z.literal("agent.stopped"),
  timestamp: z.string().datetime(),
  sessionId: z.string().min(1),
  status: agentStatusSchema,
});

export const agentTokenUsageSchema = z.object({
  type: z.literal("agent.token_usage"),
  timestamp: z.string().datetime(),
  sessionId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative().optional(),
});

export const agentSummarySchema = z.object({
  type: z.literal("agent.summary"),
  timestamp: z.string().datetime(),
  sessionId: z.string().min(1),
  summary: z.string().max(2000),
});

export const agentEventSchema = z.discriminatedUnion("type", [
  agentStartedSchema,
  agentStoppedSchema,
  agentTokenUsageSchema,
  agentSummarySchema,
]);
export type AgentEvent = z.infer<typeof agentEventSchema>;
