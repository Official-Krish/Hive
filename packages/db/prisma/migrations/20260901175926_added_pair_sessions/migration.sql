-- CreateEnum
CREATE TYPE "PairSessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED');

-- AlterEnum
ALTER TYPE "PresenceStatus" ADD VALUE 'FOCUSING';

-- CreateTable
CREATE TABLE "PairSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "PairSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "repositoryId" TEXT,
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PairSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairSessionMember" (
    "id" TEXT NOT NULL,
    "pairSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PairSessionMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PairSession_workspaceId_status_idx" ON "PairSession"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "PairSession_workspaceId_startedAt_idx" ON "PairSession"("workspaceId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PairSessionMember_pairSessionId_userId_key" ON "PairSessionMember"("pairSessionId", "userId");

-- AddForeignKey
ALTER TABLE "PairSession" ADD CONSTRAINT "PairSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairSession" ADD CONSTRAINT "PairSession_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairSessionMember" ADD CONSTRAINT "PairSessionMember_pairSessionId_fkey" FOREIGN KEY ("pairSessionId") REFERENCES "PairSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairSessionMember" ADD CONSTRAINT "PairSessionMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
