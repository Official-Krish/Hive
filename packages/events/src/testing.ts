import { z } from "zod";

export const testStatusSchema = z.enum(["passed", "failed", "skipped"]);

export const testStartedSchema = z.object({
  type: z.literal("test.started"),
  timestamp: z.string().datetime(),
  testRunId: z.string().min(1),
  activityId: z.string().min(1).optional(),
  repository: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  command: z.string().max(2000).optional(),
});

export const testFinishedSchema = z.object({
  type: z.literal("test.finished"),
  timestamp: z.string().datetime(),
  testRunId: z.string().min(1),
  status: testStatusSchema,
  totalTests: z.number().int().nonnegative().optional(),
  passedTests: z.number().int().nonnegative().optional(),
  failedTests: z.number().int().nonnegative().optional(),
  skippedTests: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

export const testEventSchema = z.discriminatedUnion("type", [
  testStartedSchema,
  testFinishedSchema,
]);
export type TestEvent = z.infer<typeof testEventSchema>;
