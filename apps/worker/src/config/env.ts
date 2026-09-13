import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PRESENCE_AWAY_SECONDS: z.coerce.number().int().positive().default(120),
  PRESENCE_OFFLINE_SECONDS: z.coerce.number().int().positive().default(900),
  WEBHOOK_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  METRICS_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  REAPER_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 1000),
  PRESENCE_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000),
  FINALIZE_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000),
  WATCHDOG_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 1000),
  /** Flag burn when a session exceeds this many tokens in the burn window. */
  WATCHDOG_BURN_TOKENS: z.coerce.number().int().positive().default(200_000),
  /** Escalate burn to CRITICAL above this session-window cost (cents). */
  WATCHDOG_BURN_COST_CENTS: z.coerce.number().int().positive().default(500),
  /** WARNING when a session is stuck (approval/blocked) this long (minutes). */
  WATCHDOG_STUCK_MIN: z.coerce.number().int().positive().default(10),
  // PR reviewer teammate (empty = reviewer jobs fail gracefully).
  AI_PROVIDER: z.string().default(""),
  AI_API_KEY: z.string().default(""),
  AI_BASE_URL: z.string().default("https://integrate.api.nvidia.com/v1"),
  AI_MODEL: z.string().default(""),
  GITHUB_APP_ID: z.string().default(""),
  GITHUB_APP_SLUG: z.string().default(""),
  GITHUB_APP_PRIVATE_KEY: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
