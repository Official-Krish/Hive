/*
  Warnings:

  - Added the required column `webhookSecret` to the `Workspace` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "webhookSecret" TEXT NOT NULL;
