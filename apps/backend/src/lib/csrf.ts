import { env } from "../config/env";

const allowedOrigins = (): Set<string> => {
  return new Set([env.API_URL, ...env.clientOrigins]);
};

/**
 * CSRF defense for cookie-based auth. Browsers attach an `Origin` header to
 * cross-origin state-changing requests. If an Origin is present it must match
 * an allow-listed origin. Absent Origin/Referer means a non-browser client
 * (curl, collector, tests) which is allowed; SameSite=Lax cookies are the
 * backstop for anything else.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  referer: string | undefined,
): boolean {
  const candidate = origin ?? referer;
  if (!candidate) return true;
  try {
    return allowedOrigins().has(new URL(candidate).origin);
  } catch {
    return false;
  }
}
