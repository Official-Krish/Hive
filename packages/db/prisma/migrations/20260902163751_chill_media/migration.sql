-- CreateTable
CREATE TABLE "ChillMedia" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "videoUrl" TEXT,
    "videoId" TEXT,
    "title" TEXT,
    "isPlaying" BOOLEAN NOT NULL DEFAULT false,
    "playheadMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "setById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChillMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChillMedia_workspaceId_key" ON "ChillMedia"("workspaceId");

-- CreateIndex
CREATE INDEX "ChillMedia_workspaceId_idx" ON "ChillMedia"("workspaceId");

-- AddForeignKey
ALTER TABLE "ChillMedia" ADD CONSTRAINT "ChillMedia_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChillMedia" ADD CONSTRAINT "ChillMedia_setById_fkey" FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
