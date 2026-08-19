import { z } from "zod";
import {
  agentStartedSchema,
  agentStoppedSchema,
  agentTokenUsageSchema,
  agentSummarySchema,
} from "./agent";
import {
  activityStartedSchema,
  activityStoppedSchema,
  activityUpdatedSchema,
} from "./activity";
import { gitBranchSchema, gitCommitSchema, gitPullRequestSchema } from "./git";
import { testFinishedSchema, testStartedSchema } from "./testing";
import {
  processStartedSchema,
  processStoppedSchema,
  terminalCommandSchema,
} from "./process";
import { fileModifiedSchema } from "./filesystem";

/**
 * Flat discriminated union over every telemetry event type. This is the
 * schema used to validate an ingested batch — do not nest the domain unions
 * here, list the concrete event schemas directly.
 */
export const telemetryEventSchema = z.discriminatedUnion("type", [
  agentStartedSchema,
  agentStoppedSchema,
  agentTokenUsageSchema,
  agentSummarySchema,
  activityStartedSchema,
  activityUpdatedSchema,
  activityStoppedSchema,
  gitCommitSchema,
  gitPullRequestSchema,
  gitBranchSchema,
  testStartedSchema,
  testFinishedSchema,
  processStartedSchema,
  processStoppedSchema,
  terminalCommandSchema,
  fileModifiedSchema,
]);
export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;

export const ingestBatchSchema = z.object({
  deviceId: z.string().min(1),
  workspaceId: z.string().min(1),
  timestamp: z.string().datetime().optional(),
  events: z.array(telemetryEventSchema).min(1).max(200),
});
export type IngestBatch = z.infer<typeof ingestBatchSchema>;
