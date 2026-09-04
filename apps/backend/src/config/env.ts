import { z } from "zod";

const boolFromString = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .default(false);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  WS_PORT: z.coerce.number().int().positive().default(4001),
  API_URL: z.url().default("http://localhost:3000"),
  WS_URL: z.string().default("ws://localhost:4001"),
  CLIENT_URLS: z.string().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, "ACCESS_TOKEN_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: boolFromString,
  COOKIE_DOMAIN: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  GITHUB_OAUTH_REDIRECT_URI: z
    .url()
    .default("http://localhost:3000/api/v1/github/auth/callback"),
  GITHUB_TOKEN_ENCRYPTION_KEY: z.string().min(16),
  GITHUB_APP_ID: z.string().default(""),
  GITHUB_APP_SLUG: z.string().default(""),
  GITHUB_APP_CLIENT_ID: z.string().default(""),
  GITHUB_APP_CLIENT_SECRET: z.string().default(""),
  GITHUB_APP_PRIVATE_KEY: z.string().default(""),
  GITHUB_APP_WEBHOOK_SECRET: z.string().default(""),
  AI_PROVIDER: z.string().default(""),
  AI_BASE_URL: z.url().default("https://integrate.api.nvidia.com/v1"),
  AI_API_KEY: z.string().default(""),
  AI_MODEL: z.string().default("nvidia/nemotron-3-ultra-550b-a55b"),
  AI_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.6),
  LIVEKIT_URL: z.string().default(""),
  LIVEKIT_API_KEY: z.string().default(""),
  LIVEKIT_API_SECRET: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = {
  ...parsed.data,
  clientOrigins: parsed.data.CLIENT_URLS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export type Env = typeof env;
