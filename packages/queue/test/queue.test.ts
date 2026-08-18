import { afterAll, test, expect } from "bun:test";
import {
  getRedis,
  closeRedis,
  Queue,
  Scheduler,
  parseJob,
  type JobEnvelope,
} from "../index";

const runId = `t${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const usedKeys: string[] = [];

function key(suffix: string): string {
  const k = `hive:test:${runId}:${suffix}`;
  usedKeys.push(k);
  return k;
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;
    await Bun.sleep(50);
  }
  throw new Error("waitFor timed out");
}

function makeQueue(
  prefix: string,
  overrides: Partial<ConstructorParameters<typeof Queue>[0]> = {},
) {
  const queueKey = key(`${prefix}:queue`);
  const processingKey = key(`${prefix}:processing`);
  const deadKey = key(`${prefix}:dead`);
  return {
    queue: new Queue({
      queueKey,
      processingKey,
      deadKey,
      pollTimeoutSeconds: 0.1,
      ...overrides,
    }),
    queueKey,
    processingKey,
    deadKey,
  };
}

afterAll(async () => {
  const redis = getRedis();
  await redis.del(...usedKeys);
  closeRedis();
});

test("enqueue returns true when Redis is reachable", async () => {
  const { queue } = makeQueue("enq");
  const ok = await queue.enqueue("test.job", { n: 1 });
  expect(ok).toBe(true);
});

test("delivers a job to the handler", async () => {
  const { queue, processingKey } = makeQueue("deliver");
  const received: JobEnvelope[] = [];
  const run = queue.start((job) => {
    received.push(job);
  });
  const ok = await queue.enqueue("test.job", { foo: "bar" });
  expect(ok).toBe(true);
  await waitFor(() => received.length === 1);
  queue.stop();
  await run;
  expect(received[0]!.name).toBe("test.job");
  expect(received[0]!.payload).toEqual({ foo: "bar" });
  expect(received[0]!.attempts).toBe(0);
  const redis = getRedis();
  expect(await redis.llen(processingKey)).toBe(0);
});

test("moves a failing job to dead after max attempts", async () => {
  const { queue, deadKey } = makeQueue("dead", { maxAttempts: 2 });
  const attempts: number[] = [];
  const run = queue.start(async () => {
    attempts.push(1);
    throw new Error("boom");
  });
  await queue.enqueue("fail.job", null);
  await waitFor(() => attempts.length >= 2);
  queue.stop();
  await run;
  const redis = getRedis();
  const dead = await redis.lrange(deadKey, 0, -1);
  expect(dead).toHaveLength(1);
  const job = parseJob(dead[0]!);
  expect(job?.name).toBe("fail.job");
  expect(job?.attempts).toBe(2);
});

test("drops malformed payloads without retry", async () => {
  const { queue, queueKey, deadKey } = makeQueue("malformed");
  const redis = getRedis();
  await redis.lpush(queueKey, "not-json");
  let called = false;
  const run = queue.start(() => {
    called = true;
  });
  await waitFor(async () => (await redis.llen(queueKey)) === 0);
  queue.stop();
  await run;
  expect(called).toBe(false);
  expect(await redis.lrange(deadKey, 0, -1)).toHaveLength(0);
});

test("scheduler enqueues a recurring job", async () => {
  const { queue } = makeQueue("sched");
  const scheduler = new Scheduler(queue, { lockPrefix: key("lock") });
  const received: string[] = [];
  const run = queue.start((job) => {
    received.push(job.name);
  });
  scheduler.every("sched.job", 200, () => ({
    name: "sched.job",
    payload: { tick: received.length },
  }));
  scheduler.start();
  await waitFor(() => received.length >= 2);
  scheduler.stop();
  queue.stop();
  await run;
  expect(
    received.filter((name) => name === "sched.job").length,
  ).toBeGreaterThanOrEqual(2);
});

test("distributed lock is held while a schedule is active", async () => {
  const { queue } = makeQueue("lock");
  const lockPrefix = key("lock");
  const scheduler = new Scheduler(queue, { lockPrefix });
  const received: string[] = [];
  const run = queue.start((job) => {
    received.push(job.name);
  });
  scheduler.every("lock.job", 200, () => ({ name: "lock.job", payload: null }));
  scheduler.start();
  await waitFor(() => received.length >= 1);
  const redis = getRedis();
  const acquired = await redis.set(
    `${lockPrefix}:lock.job`,
    "x",
    "NX",
    "PX",
    "5000",
  );
  expect(acquired).toBeNull();
  scheduler.stop();
  queue.stop();
  await run;
});
