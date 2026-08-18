import { getRedis } from "./client";
import { createJob, parseJob, serializeJob, type JobEnvelope } from "./types";

export interface QueueLogger {
  warn(message: string): void;
}

export interface QueueOptions {
  queueKey?: string;
  processingKey?: string;
  deadKey?: string;
  maxAttempts?: number;
  pollTimeoutSeconds?: number;
  commandTimeoutMs?: number;
  logger?: QueueLogger;
}

export type JobHandler = (job: JobEnvelope) => void | Promise<void>;

const noopLogger: QueueLogger = { warn: () => {} };

export class Queue {
  private readonly queueKey: string;
  private readonly processingKey: string;
  private readonly deadKey: string;
  private readonly maxAttempts: number;
  private readonly pollTimeoutSeconds: number;
  private readonly commandTimeoutMs: number;
  private readonly logger: QueueLogger;
  private stopped = false;
  private running: Promise<void> | null = null;

  constructor(options: QueueOptions = {}) {
    this.queueKey = options.queueKey ?? "hive:queue";
    this.processingKey = options.processingKey ?? "hive:queue:processing";
    this.deadKey = options.deadKey ?? "hive:queue:dead";
    this.maxAttempts = options.maxAttempts ?? 3;
    this.pollTimeoutSeconds = options.pollTimeoutSeconds ?? 1;
    this.commandTimeoutMs = options.commandTimeoutMs ?? 5000;
    this.logger = options.logger ?? noopLogger;
  }

  async enqueue(name: string, payload: unknown): Promise<boolean> {
    const redis = getRedis();
    try {
      await Promise.race([
        redis.lpush(this.queueKey, serializeJob(createJob(name, payload))),
        timeout(this.commandTimeoutMs),
      ]);
      return true;
    } catch {
      this.logger.warn(`[queue] enqueue failed for job "${name}"`);
      return false;
    }
  }

  async start(handler: JobHandler): Promise<void> {
    this.stopped = false;
    this.running = this.consumeLoop(handler);
    await this.running;
  }

  stop(): void {
    this.stopped = true;
  }

  private async consumeLoop(handler: JobHandler): Promise<void> {
    const redis = getRedis();
    while (!this.stopped) {
      try {
        const raw = await redis.brpoplpush(
          this.queueKey,
          this.processingKey,
          this.pollTimeoutSeconds,
        );
        if (raw === null) continue;

        const job = parseJob(raw);
        if (job === null) {
          await redis.lrem(this.processingKey, 1, raw);
          this.logger.warn("[queue] dropped malformed job payload");
          continue;
        }

        try {
          await handler(job);
          await redis.lrem(this.processingKey, 1, raw);
        } catch {
          job.attempts += 1;
          if (job.attempts >= this.maxAttempts) {
            await redis.lpush(this.deadKey, serializeJob(job));
            this.logger.warn(
              `[queue] job "${job.name}" dead after ${job.attempts} attempts`,
            );
          } else {
            await redis.lpush(this.queueKey, serializeJob(job));
            this.logger.warn(
              `[queue] job "${job.name}" failed, retry ${job.attempts}/${this.maxAttempts}`,
            );
          }
          await redis.lrem(this.processingKey, 1, raw);
        }
      } catch {
        await Bun.sleep(1000);
      }
    }
  }
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("redis command timed out")), ms).unref(),
  );
}
