-- CreateTable
CREATE TABLE "UsageBudget" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "monthlyCapCents" INTEGER,
    "alertAtPct" INTEGER NOT NULL DEFAULT 80,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageBudget_workspaceId_key" ON "UsageBudget"("workspaceId");

-- AddForeignKey
ALTER TABLE "UsageBudget" ADD CONSTRAINT "UsageBudget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageBudget" ADD CONSTRAINT "UsageBudget_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
