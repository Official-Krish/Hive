import { RedisClient } from "bun";

const REDIS_HOST =
  process.env.NODE_ENV === "production" ? "redis" : "localhost";

let redis: RedisClient | null = null;

export function getRedis(): RedisClient {
  redis ??= new RedisClient(`redis://${REDIS_HOST}:6379`);
  return redis;
}

export function closeRedis(): void {
  redis?.close();
  redis = null;
}

export async function ensureConnected(timeoutMs = 3000): Promise<boolean> {
  const client = getRedis();
  if (client.connected) return true;
  try {
    await Promise.race([
      client.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("redis connection timed out")),
          timeoutMs,
        ).unref(),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}
