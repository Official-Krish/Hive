-- AlterTable
ALTER TABLE "ChillMedia" ADD COLUMN     "currentItemId" TEXT;

-- CreateTable
CREATE TABLE "ChillQueueItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChillQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChillQueueItem_workspaceId_position_idx" ON "ChillQueueItem"("workspaceId", "position");

-- AddForeignKey
ALTER TABLE "ChillQueueItem" ADD CONSTRAINT "ChillQueueItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChillQueueItem" ADD CONSTRAINT "ChillQueueItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
