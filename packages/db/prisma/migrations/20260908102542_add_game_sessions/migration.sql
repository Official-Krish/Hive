-- CreateEnum
CREATE TYPE "GameKind" AS ENUM ('CHESS', 'CONNECT4');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('PENDING', 'ACTIVE', 'FINISHED');

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "GameKind" NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstUserId" TEXT NOT NULL,
    "secondUserId" TEXT NOT NULL,
    "turnUserId" TEXT,
    "board" TEXT NOT NULL,
    "winnerUserId" TEXT,
    "resultReason" TEXT,
    "moveCount" INTEGER NOT NULL DEFAULT 0,
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameMove" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "byUserId" TEXT NOT NULL,
    "ply" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameMove_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameSession_workspaceId_status_idx" ON "GameSession"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "GameSession_workspaceId_startedAt_idx" ON "GameSession"("workspaceId", "startedAt");

-- CreateIndex
CREATE INDEX "GameMove_gameSessionId_idx" ON "GameMove"("gameSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GameMove_gameSessionId_ply_key" ON "GameMove"("gameSessionId", "ply");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMove" ADD CONSTRAINT "GameMove_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
