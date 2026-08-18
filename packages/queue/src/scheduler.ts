import { getRedis } from "./client";
import type { Queue, QueueLogger } from "./queue";

export interface ScheduledJob {
  name: string;
  payload: unknown;
}

export interface SchedulerOptions {
  logger?: QueueLogger;
  lockPrefix?: string;
}

interface RecurringJob {
  name: string;
  intervalMs: number;
  factory: () => ScheduledJob | null;
  timer: ReturnType<typeof setInterval> | null;
}

export class Scheduler {
  private readonly queue: Queue;
  private readonly lockPrefix: string;
  private readonly logger: QueueLogger;
  private readonly jobs: RecurringJob[] = [];
  private started = false;

  constructor(queue: Queue, options: SchedulerOptions = {}) {
    this.queue = queue;
    this.lockPrefix = options.lockPrefix ?? "hive:sched:lock";
    this.logger = options.logger ?? { warn: () => {} };
  }

  every(
    name: string,
    intervalMs: number,
    factory: () => ScheduledJob | null,
  ): void {
    this.jobs.push({ name, intervalMs, factory, timer: null });
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    for (const job of this.jobs) {
      job.timer = setInterval(() => void this.tick(job), job.intervalMs);
    }
  }

  stop(): void {
    this.started = false;
    for (const job of this.jobs) {
      if (job.timer !== null) clearInterval(job.timer);
      job.timer = null;
    }
  }

  private async tick(job: RecurringJob): Promise<void> {
    const redis = getRedis();
    const lockKey = `${this.lockPrefix}:${job.name}`;
    const lockTtlMs = job.intervalMs + 1000;
    try {
      const acquired = await redis.set(
        lockKey,
        String(Date.now()),
        "NX",
        "PX",
        String(lockTtlMs),
      );
      if (acquired === null) return;
      const scheduled = job.factory();
      if (scheduled === null) return;
      const ok = await this.queue.enqueue(scheduled.name, scheduled.payload);
      if (!ok)
        this.logger.warn(`[scheduler] failed to enqueue "${scheduled.name}"`);
    } catch {
      this.logger.warn(`[scheduler] tick failed for "${job.name}"`);
    }
  }
}
