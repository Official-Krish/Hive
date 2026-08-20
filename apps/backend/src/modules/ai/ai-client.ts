import OpenAI from "openai";
import { env } from "../../config/env";

export function aiEnabled(): boolean {
  return Boolean(env.AI_PROVIDER && env.AI_API_KEY);
}

let client: OpenAI | null = null;

export function getAiClient(): OpenAI {
  client ??= new OpenAI({ apiKey: env.AI_API_KEY, baseURL: env.AI_BASE_URL });
  return client;
}
