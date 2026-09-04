import type { Request, Response } from "express";
import { TooManyRequestsError } from "../core/errors";
import { env } from "../config/env";

/**
 * A small, dependency-free, in-memory sliding-window rate limiter.
 *
 * Counters live in a per-key ring of timestamps. Each hit prunes hits older
 * than the window, appends the new hit, and rejects when the live count would
 * exceed `limit`. Keys are bounded (older users evicted first) and the whole
 * store is swept on a timer so abandoned keys cannot leak memory.
 *
 * This is correct for a single process. It is not shared across instances —
 * reach for Redis if the API is ever scaled horizontally.
 */

export interface RateLimitOptions {
  /** Max requests allowed within the sliding `windowMs`. */
  limit: number;
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /**
   * Resolve the bucket key for a request. Runs before counting. The default
   * keys by the authenticated user, else device, else peer IP.
   */
  keyBy?: (req: Request, res: Response) => string;
  /** Skip counting (and headers) for requests matching this predicate. */
  skip?: (req: Request, res: Response) => boolean;
  /** Custom 429 responder instead of the default JSON 429. */
  handler?: (req: Request, res: Response) => void;
  /** Set `Retry-After` + `X-RateLimit-*` headers before counting. Defaults on. */
  standardHeaders?: boolean;
}

interface Bucket {
  hits: number[]; // ascending timestamps
}

const MAX_KEYS = 10_000;
const CLEANUP_INTERVAL_MS = 60_000;

export function defaultKey(req: Request, res: Response): string {
  const userId = res.locals.auth?.userId as string | undefined;
  if (userId) return `user:${userId}`;
  const deviceId = res.locals.device?.deviceId as string | undefined;
  if (deviceId) return `device:${deviceId}`;
  return `ip:${req.ip ?? "unknown"}`;
}

export function workspaceKey(req: Request, res: Response): string {
  const workspaceId = res.locals.membership?.workspaceId as string | undefined;
  return `workspace:${workspaceId ?? "none"}`;
}

const stores = new Map<RateLimitOptions, Map<string, Bucket>>();

function prune(bucket: Bucket, windowMs: number, now: number) {
  const cutoff = now - windowMs;
  let i = 0;
  while (i < bucket.hits.length && bucket.hits[i]! <= cutoff) i++;
  if (i > 0) bucket.hits.splice(0, i);
}

function sweep() {
  const now = Date.now();
  for (const map of stores.values()) {
    if (map.size === 0) continue;
    for (const [key, bucket] of map) {
      prune(bucket, 60_000, now);
      if (bucket.hits.length === 0) map.delete(key);
    }
  }
}
const sweeper = setInterval(sweep, CLEANUP_INTERVAL_MS);
// Don't keep the process alive just to clean up.
if (typeof sweeper.unref === "function") sweeper.unref();

export function rateLimit(
  options: RateLimitOptions,
): import("express").RequestHandler {
  const {
    limit,
    windowMs,
    keyBy = defaultKey,
    skip,
    handler,
    standardHeaders = true,
  } = options;

  let map = stores.get(options);
  if (!map) {
    map = new Map<string, Bucket>();
    stores.set(options, map);
  }

  return (req, res, next) => {
    // Rate limits are enforced in production/dev; bypassed under `bun test`
    // so the suite can create many short-lived users/workspaces per run.
    if (env.NODE_ENV === "test") return next();

    if (skip?.(req, res)) return next();

    const key = keyBy(req, res);

    // Bound the table: evict an arbitrary bucket when over capacity.
    if (map.size >= MAX_KEYS && !map.has(key)) {
      const oldest = map.keys().next().value as string | undefined;
      if (oldest) map.delete(oldest);
    }

    const now = Date.now();
    let bucket = map.get(key);
    if (!bucket) {
      bucket = { hits: [] };
      map.set(key, bucket);
    }

    prune(bucket, windowMs, now);
    bucket.hits.push(now);

    const count = bucket.hits.length;
    const remaining = Math.max(0, limit - count);
    const retryAfterMs = Math.max(
      bucket.hits[0] !== undefined ? bucket.hits[0] + windowMs - now : 0,
      0,
    );

    if (standardHeaders) {
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader(
        "X-RateLimit-Reset",
        String(Math.ceil((now + retryAfterMs) / 1000)),
      );
      if (count > limit) {
        res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
      }
    }

    if (count > limit) {
      if (handler) return handler(req, res);
      return next(new TooManyRequestsError("Too many requests", retryAfterMs));
    }

    next();
  };
}
