import { describe, expect, test } from "bun:test";
import {
  ingestBatchSchema,
  telemetryEventSchema,
  type IngestBatch,
} from "../index.ts";

const ts = "2026-08-19T10:00:00.000Z";

function validBatch(): IngestBatch {
  return {
    deviceId: "dev_123",
    workspaceId: "ws_123",
    timestamp: ts,
    events: [
      {
        type: "agent.started",
        timestamp: ts,
        sessionId: "sess_1",
        agent: "claude",
        model: "claude-sonnet-4-5",
        title: "Implement login",
      },
      {
        type: "agent.token_usage",
        timestamp: ts,
        sessionId: "sess_1",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        inputTokens: 100,
        outputTokens: 50,
      },
      {
        type: "activity.started",
        timestamp: ts,
        activityId: "act_1",
        activityType: "coding",
        title: "Build auth flow",
      },
      {
        type: "git.commit",
        timestamp: ts,
        repository: "acme/web",
        sha: "abc123",
        message: "feat: add login",
      },
      {
        type: "test.finished",
        timestamp: ts,
        testRunId: "run_1",
        status: "passed",
        totalTests: 42,
      },
      {
        type: "file.modified",
        timestamp: ts,
        path: "src/auth.ts",
      },
    ],
  };
}

describe("telemetryEventSchema", () => {
  test("parses a full batch with mixed event types", () => {
    const batch = validBatch();
    const result = ingestBatchSchema.safeParse(batch);
    expect(result.success).toBe(true);
    expect(result.success && result.data.events).toHaveLength(6);
  });

  test("rejects an unknown event type", () => {
    const result = telemetryEventSchema.safeParse({
      type: "nope",
      timestamp: ts,
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing timestamp", () => {
    const result = telemetryEventSchema.safeParse({
      type: "agent.started",
      sessionId: "sess_1",
      agent: "claude",
    });
    expect(result.success).toBe(false);
  });

  test("rejects batch exceeding max size", () => {
    const batch = validBatch();
    batch.events = Array.from({ length: 201 }, (_, i) => ({
      type: "file.modified" as const,
      timestamp: ts,
      path: `file-${i}.ts`,
    }));
    expect(ingestBatchSchema.safeParse(batch).success).toBe(false);
  });

  test("rejects empty batch", () => {
    const batch = validBatch();
    batch.events = [];
    expect(ingestBatchSchema.safeParse(batch).success).toBe(false);
  });

  test("changeType is optional on file.modified", () => {
    const result = telemetryEventSchema.safeParse({
      type: "file.modified",
      timestamp: ts,
      path: "src/a.ts",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    if (result.data.type !== "file.modified") return;
    expect(result.data.changeType).toBeUndefined();
  });
});
