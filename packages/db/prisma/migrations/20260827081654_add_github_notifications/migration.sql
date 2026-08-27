-- CreateEnum
CREATE TYPE "GitHubNotificationType" AS ENUM ('ISSUE_ASSIGNED', 'ISSUE_COMMENT', 'ISSUE_CLOSED', 'PR_OPENED', 'PR_REVIEW_REQUESTED', 'PR_REVIEW_SUBMITTED', 'PR_MERGED', 'PR_CLOSED', 'PR_COMMENT', 'ISSUE_MENTION', 'PR_REVIEW_COMMENT', 'RELEASE_PUBLISHED');

-- CreateTable
CREATE TABLE "GitHubNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "GitHubNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitHubNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubInstallation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "githubAppId" TEXT NOT NULL,
    "repositories" JSONB,
    "webhookSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GitHubNotification_userId_readAt_idx" ON "GitHubNotification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "GitHubNotification_workspaceId_createdAt_idx" ON "GitHubNotification"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubInstallation_installationId_key" ON "GitHubInstallation"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubInstallation_workspaceId_key" ON "GitHubInstallation"("workspaceId");

-- AddForeignKey
ALTER TABLE "GitHubNotification" ADD CONSTRAINT "GitHubNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubNotification" ADD CONSTRAINT "GitHubNotification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubInstallation" ADD CONSTRAINT "GitHubInstallation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
