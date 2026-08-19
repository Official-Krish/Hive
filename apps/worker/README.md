# @hive/worker

Background job service for the Hive platform — a **Redis-backed queue
consumer** plus a **scheduler** that enqueues recurring jobs. Built with Bun
and `@hive/queue`.

---

## Responsibilities

- **Consume** jobs from the Redis queue and dispatch them to job handlers
  (`src/jobs`).
- **Schedule** recurring jobs with a lightweight `Scheduler`.

### Scheduled jobs

| Job                         | Interval (env)              | Work                                                    |
| --------------------------- | --------------------------- | ------------------------------------------------------- |
| `metrics.aggregate`         | `METRICS_INTERVAL_MS` (15m) | Compute daily/weekly/monthly `EfficiencyMetric` windows |
| `finalize.sessions`         | `FINALIZE_INTERVAL_MS` (1m) | Close stale `AgentSession`s                             |
| `finalize.activities`       | `FINALIZE_INTERVAL_MS` (1m) | Close stale `Activity`s                                 |
| `presence.sweep`            | `PRESENCE_INTERVAL_MS` (1m) | Age out offline/away presence                           |
| `reaper.refresh-tokens`     | `REAPER_INTERVAL_MS` (1h)   | Purge expired refresh-token families                    |
| `reaper.idempotency-keys`   | `REAPER_INTERVAL_MS` (1h)   | Purge expired idempotency keys                          |
| `reaper.invites`            | `REAPER_INTERVAL_MS` (1h)   | Purge expired/used invites                              |
| `reaper.api-keys`           | `REAPER_INTERVAL_MS` (1h)   | Purge expired/revoked API keys                          |
| `reaper.webhook-deliveries` | `REAPER_INTERVAL_MS` (1h)   | Trim old GitHub webhook deliveries                      |

---

## Getting started

```sh
docker compose up -d              # Postgres + Redis
cp .env.example .env              # DATABASE_URL + LOG_LEVEL (see below)
bun run dev                       # watch mode
```

### Environment variables

Validated by `src/config/env.ts` (zod, fail-fast):

| Variable                   | Default   | Notes                             |
| -------------------------- | --------- | --------------------------------- |
| `DATABASE_URL`             | —         | Postgres connection string        |
| `LOG_LEVEL`                | `info`    | pino level                        |
| `PRESENCE_AWAY_SECONDS`    | `120`     | Presence → away threshold         |
| `PRESENCE_OFFLINE_SECONDS` | `900`     | Presence → offline threshold      |
| `WEBHOOK_RETENTION_DAYS`   | `30`      | Webhook delivery retention        |
| `METRICS_INTERVAL_MS`      | `900000`  | Metrics aggregation cadence       |
| `REAPER_INTERVAL_MS`       | `3600000` | Reaper cadence                    |
| `PRESENCE_INTERVAL_MS`     | `60000`   | Presence sweep cadence            |
| `FINALIZE_INTERVAL_MS`     | `60000`   | Session/activity finalize cadence |

Redis is resolved by convention: host `redis` in `production`, `localhost`
otherwise (see `packages/queue`). At least one worker instance must be running
for background jobs to execute.

---

## Running

```sh
bun run dev      # watch mode
bun run start    # NODE_ENV=production
bun run build    # Bun binary target -> dist/
bun test         # job tests
```

Graceful shutdown handles `SIGINT`/`SIGTERM`: it stops the scheduler, drains
the queue consumer, closes Redis, and disconnects Postgres.
