-- CreateEnum
CREATE TYPE "VendingProvider" AS ENUM ('CLAUDE', 'OPENCODE', 'CODEX');

-- CreateEnum
CREATE TYPE "VendingKeyStatus" AS ENUM ('AVAILABLE', 'CHECKED_OUT', 'REVOKED', 'RETIRED');

-- CreateTable
CREATE TABLE "ApiKeyPool" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "VendingProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "status" "VendingKeyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "checkoutCount" INTEGER NOT NULL DEFAULT 0,
    "maxCheckouts" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKeyPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyCheckout" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendingRules" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "maxPerUserPerProviderPer24h" INTEGER NOT NULL DEFAULT 1,
    "cooldownHours" INTEGER NOT NULL DEFAULT 0,
    "minRole" "UserRole",
    "providerMinRoles" JSONB NOT NULL DEFAULT '{}',
    "lowPoolAlertPct" INTEGER NOT NULL DEFAULT 20,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendingRules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyPool_keyHash_key" ON "ApiKeyPool"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKeyPool_workspaceId_provider_status_idx" ON "ApiKeyPool"("workspaceId", "provider", "status");

-- CreateIndex
CREATE INDEX "ApiKeyCheckout_poolId_idx" ON "ApiKeyCheckout"("poolId");

-- CreateIndex
CREATE INDEX "ApiKeyCheckout_userId_revealedAt_idx" ON "ApiKeyCheckout"("userId", "revealedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VendingRules_workspaceId_key" ON "VendingRules"("workspaceId");

-- AddForeignKey
ALTER TABLE "ApiKeyPool" ADD CONSTRAINT "ApiKeyPool_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyPool" ADD CONSTRAINT "ApiKeyPool_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyCheckout" ADD CONSTRAINT "ApiKeyCheckout_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "ApiKeyPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyCheckout" ADD CONSTRAINT "ApiKeyCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendingRules" ADD CONSTRAINT "VendingRules_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendingRules" ADD CONSTRAINT "VendingRules_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
