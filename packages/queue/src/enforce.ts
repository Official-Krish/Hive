import { RedisClient } from "bun";
import { getRedis } from "./client";

export const ENFORCE_CHANNEL = "hive:enforce";

export interface EnforcementCommand {
  workspaceId: string;
  /** Null = whole workspace (kill switch); otherwise one member's devices. */
  userId: string | null;
  reason: string;
  requestedAt: string;
}

interface WarnLogger {
  warn(message: string): void;
}

/**
 * Fire-and-forget enforcement from the worker to the backend, which owns
 * the device control plane (deviceBus is process-local — the worker cannot
 * push control commands itself). Never throws: if the backend misses it,
 * the CRITICAL alert the worker opens alongside stays as the backstop.
 */
export async function publishEnforcement(
  command: EnforcementCommand,
  logger?: WarnLogger,
): Promise<void> {
  try {
    await getRedis().publish(ENFORCE_CHANNEL, JSON.stringify(command));
  } catch (err) {
    logger?.warn(
      `[enforce] publish failed: ${err instanceof Error ? err.message : err}`,
    );
  }
}

export interface EnforcementSubscription {
  close(): void;
}

/**
 * Dedicated subscriber connection (see subscribeAlerts — subscriber mode
 * blocks all other commands on the connection).
 */
export async function subscribeEnforcement(
  onCommand: (command: EnforcementCommand) => void,
): Promise<EnforcementSubscription> {
  const host = process.env.NODE_ENV === "production" ? "redis" : "localhost";
  const sub = new RedisClient(`redis://${host}:6379`);
  if (!sub.connected) await sub.connect();
  await sub.subscribe(ENFORCE_CHANNEL, (message) => {
    try {
      const parsed = JSON.parse(message) as Partial<EnforcementCommand>;
      if (!parsed?.workspaceId) return;
      onCommand({
        workspaceId: parsed.workspaceId,
        userId: parsed.userId ?? null,
        reason: parsed.reason ?? "budget breached",
        requestedAt: parsed.requestedAt ?? new Date().toISOString(),
      });
    } catch {
      /* malformed commands never reach the control plane */
    }
  });
  return {
    close: () => sub.close(),
  };
}
