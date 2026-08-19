import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type {
  PrismaClient,
  User,
  Organization,
  Workspace,
  RefreshToken,
  Activity,
  AgentSession,
  Repository,
  PullRequest,
  GitHubAccount,
  WebhookDelivery,
  Prisma,
} from "./src/generated/prisma/client";

export * from "./src/generated/prisma/enums";
