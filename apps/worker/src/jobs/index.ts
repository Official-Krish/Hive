import type { JobEnvelope } from "@hive/queue";
import type { ZodType } from "zod";
import {
  handler as metricsAggregate,
  schema as metricsAggregateSchema,
} from "./metrics.aggregate";
import {
  handler as reaperRefreshTokens,
  schema as reaperRefreshTokensSchema,
} from "./reaper.refresh-tokens";
import {
  handler as reaperIdempotencyKeys,
  schema as reaperIdempotencyKeysSchema,
} from "./reaper.idempotency-keys";
import {
  handler as reaperInvites,
  schema as reaperInvitesSchema,
} from "./reaper.invites";
import {
  handler as reaperApiKeys,
  schema as reaperApiKeysSchema,
} from "./reaper.api-keys";
import {
  handler as reaperWebhookDeliveries,
  schema as reaperWebhookDeliveriesSchema,
} from "./reaper.webhook-deliveries";
import {
  handler as presenceSweep,
  schema as presenceSweepSchema,
} from "./presence.sweep";
import {
  handler as finalizeSessions,
  schema as finalizeSessionsSchema,
} from "./finalize.sessions";
import {
  handler as finalizeActivities,
  schema as finalizeActivitiesSchema,
} from "./finalize.activities";

export type JobHandler = (payload: unknown) => Promise<void>;

export interface JobDefinition {
  schema: ZodType;
  handler: JobHandler;
}

function toJob<T>(
  schema: ZodType<T>,
  handler: (payload: T) => Promise<void>,
): JobDefinition {
  return { schema, handler: handler as JobHandler };
}

export const jobRegistry = new Map<string, JobDefinition>([
  ["metrics.aggregate", toJob(metricsAggregateSchema, metricsAggregate)],
  [
    "reaper.refresh-tokens",
    toJob(reaperRefreshTokensSchema, reaperRefreshTokens),
  ],
  [
    "reaper.idempotency-keys",
    toJob(reaperIdempotencyKeysSchema, reaperIdempotencyKeys),
  ],
  ["reaper.invites", toJob(reaperInvitesSchema, reaperInvites)],
  ["reaper.api-keys", toJob(reaperApiKeysSchema, reaperApiKeys)],
  [
    "reaper.webhook-deliveries",
    toJob(reaperWebhookDeliveriesSchema, reaperWebhookDeliveries),
  ],
  ["presence.sweep", toJob(presenceSweepSchema, presenceSweep)],
  ["finalize.sessions", toJob(finalizeSessionsSchema, finalizeSessions)],
  ["finalize.activities", toJob(finalizeActivitiesSchema, finalizeActivities)],
]);

export async function dispatch(job: JobEnvelope): Promise<void> {
  const definition = jobRegistry.get(job.name);
  if (!definition) throw new Error(`unknown job: ${job.name}`);
  const payload = definition.schema.parse(job.payload);
  await definition.handler(payload);
}
