import { defaultKey, rateLimit, workspaceKey } from "../middleware/rateLimit";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function isWriteMethod(req: { method: string }) {
  return !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase());
}

/**
 * Named, tuned rate limiters mapped to endpoint groups. Each is a module-level
 * singleton so its buckets persist across requests. Limits are keyed by the
 * identity available at the point they run (see per-limiter notes).
 */

/** Whole-API safety net: one budget per peer IP regardless of route. */
export const globalLimiter = rateLimit({
  limit: 1000,
  windowMs: MINUTE,
});

/** Login tries — brute-force protection, anonymous so keyed by IP. */
export const authLoginLimiter = rateLimit({
  limit: 10,
  windowMs: 15 * MINUTE,
});

/** Registration — protect against account spam, keyed by IP. */
export const authRegisterLimiter = rateLimit({
  limit: 5,
  windowMs: HOUR,
});

/** Refresh-token rotation — same browser/IP, relaxed budget. */
export const authRefreshLimiter = rateLimit({
  limit: 120,
  windowMs: 15 * MINUTE,
});

/** Public GitHub OAuth-device token exchange (collector login) — per IP. */
export const githubTokenLimiter = rateLimit({
  limit: 60,
  windowMs: MINUTE,
});

/** Telemetry ingest — generous, one budget per collector device. */
export const ingestLimiter = rateLimit({
  limit: 1200,
  windowMs: MINUTE,
});

/** Device management (register, heartbeat, stop) — per user. */
export const devicesLimiter = rateLimit({
  limit: 300,
  windowMs: MINUTE,
});

/** Read/query endpoints — per authenticated user. */
export const readsLimiter = rateLimit({
  limit: 600,
  windowMs: MINUTE,
});

/** Read/query endpoints — shared per-workspace cap (headers suppressed so it
 *  doesn't clobber the user limiter's X-RateLimit-* headers). */
export const readsWorkspaceLimiter = rateLimit({
  limit: 3000,
  windowMs: MINUTE,
  keyBy: workspaceKey,
  standardHeaders: false,
});

/** State-changing (POST/PATCH/PUT/DELETE) — per user, GET/HEAD skipped. */
export const writesLimiter = rateLimit({
  limit: 300,
  windowMs: MINUTE,
  skip: (req) => !isWriteMethod(req),
});

/** GitHub webhook ingress — blunt cap per source IP, no client headers. */
export const githubWebhookLimiter = rateLimit({
  limit: 240,
  windowMs: MINUTE,
  keyBy: defaultKey,
  standardHeaders: false,
});
