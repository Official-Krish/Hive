import { RedisClient } from "bun";
import { getRedis } from "./client";

export const ALERTS_CHANNEL = "hive:alerts";

export interface AlertBroadcast {
  alertId: string;
  workspaceId: string;
  alertType: string;
  severity: "info" | "warning" | "critical";
  message: string;
}

interface WarnLogger {
  warn(message: string): void;
}

/**
 * Fire-and-forget fan-out from the worker to the backend's realtime hub.
 * Never throws — a missed push just means the dashboard polls it in ≤30s.
 */
export async function publishAlert(
  event: AlertBroadcast,
  logger?: WarnLogger,
): Promise<void> {
  try {
    await getRedis().publish(ALERTS_CHANNEL, JSON.stringify(event));
  } catch (err) {
    logger?.warn(
      `[alerts] publish failed: ${err instanceof Error ? err.message : err}`,
    );
  }
}

export interface AlertSubscription {
  close(): void;
}

/**
 * Dedicated subscriber connection. Redis subscriber mode blocks all other
 * commands on the connection, so this must NOT reuse the shared client.
 */
export async function subscribeAlerts(
  onEvent: (event: AlertBroadcast) => void,
): Promise<AlertSubscription> {
  const host = process.env.NODE_ENV === "production" ? "redis" : "localhost";
  const sub = new RedisClient(`redis://${host}:6379`);
  if (!sub.connected) await sub.connect();
  await sub.subscribe(ALERTS_CHANNEL, (message) => {
    try {
      const parsed = JSON.parse(message) as Partial<AlertBroadcast>;
      if (!parsed?.alertId || !parsed?.workspaceId) return;
      onEvent({
        alertId: parsed.alertId,
        workspaceId: parsed.workspaceId,
        alertType: parsed.alertType ?? "unknown",
        severity: parsed.severity ?? "info",
        message: parsed.message ?? "",
      });
    } catch {
      /* malformed payloads never reach the hub */
    }
  });
  return {
    close: () => sub.close(),
  };
}
