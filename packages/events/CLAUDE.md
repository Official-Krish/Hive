---
description: Hive telemetry event contract. The local collector emits these events; the backend ingest endpoint persists them.
globs: "*.ts"
alwaysApply: false
---

## Purpose

`@hive/events` is the single source of truth for telemetry event shapes flowing from the local collector (Rust) to the backend `POST /api/ingest/events` endpoint.

- Every event is a zod schema with a `type` discriminator and a `timestamp` (UTC ISO-8601, `z.string().datetime()`).
- `ingestBatchSchema` wraps a batch of events: `{ deviceId, workspaceId, timestamp?, events[] }` (1-200 events).
- Domain unions (`agentEventSchema`, `activityEventSchema`, ...) exist for convenience; `telemetryEventSchema` is the flat `discriminatedUnion("type")` used for batch validation.
- Never redefine event shapes in backend or collector code — import from here.

## Conventions

- Use `bun` (no npm/pnpm). `bun test` for tests, `bunx tsc --noEmit` for typecheck.
- Field naming: `snake_case` for DB-mapped concepts, enums lowercase.
- IDs (`sessionId`, `activityId`, `testRunId`) are collector-generated and used as the DB row ids so updates reference the same row.
- Costs are never computed here — collectors send raw token counts; the backend derives cost from `Model` pricing.
