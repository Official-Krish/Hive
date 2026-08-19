# @hive/queue

Redis-backed background job utilities for the Hive platform, built on **Bun's
native Redis client** (`Bun.redis` — no `ioredis`/`bullmq`). Provides a
lightweight at-least-once **producer/consumer queue** with retries and a dead
queue, plus a **scheduler** for recurring jobs.

Used by `@hive/backend` (lazy producer) and `@hive/worker` (consumer +
scheduler).

---

## API

### Queue

```ts
import { Queue } from "@hive/queue";

const queue = new Queue({ logger });

await queue.enqueue("metrics.aggregate", { windows: [...] }); // producer

const consumer = queue.start(async (job) => { ... });          // consumer
await consumer;
```

- Keys: `hive:queue`, `hive:queue:processing`, `hive:queue:dead` (overridable).
- Defaults: `maxAttempts = 3`, `pollTimeoutSeconds = 1`,
  `commandTimeoutMs = 5000`. Enqueues fail soft (log + return `false`) rather
  than throw when Redis is unavailable.
- Jobs are JSON envelopes: `{ id, name, payload, attempts, ... }`
  (see `src/types.ts`); handlers receive the full `JobEnvelope`.

### Scheduler

```ts
import { Queue, Scheduler } from "@hive/queue";

const scheduler = new Scheduler(queue, { logger });
scheduler.every("reaper.invites", 60_000, () => ({
  name: "reaper.invites",
  payload: {},
}));
scheduler.start();
scheduler.stop(); // graceful shutdown
```

`every(name, intervalMs, factory)` enqueues the job returned by `factory` on
the given cadence.

### Client helpers

```ts
import { getRedis, ensureConnected, closeRedis } from "@hive/queue";

await ensureConnected(); // connect with a 3s timeout, returns boolean
const redis = getRedis(); // lazily-created singleton RedisClient
closeRedis(); // close + reset the singleton
```

---

## Redis configuration

Connection is **by convention**, not env vars: host resolves to `redis` when
`NODE_ENV === "production"` and `localhost` otherwise, on port `6379`.

In Docker deployments the backend/worker must share a network with a Redis
service named `redis`. Locally, run Redis with:

```sh
docker compose up -d redis   # repo root
```

---

## Testing

```sh
bun test
```

Suite covers job serialization, retry/attempt counting, dead-queue behavior,
and the scheduler — it requires a reachable Redis on `localhost:6379`.
