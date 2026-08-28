/*
  Warnings:

  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_orgId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_workspaceId_fkey";

-- DropTable
DROP TABLE "AuditLog";
