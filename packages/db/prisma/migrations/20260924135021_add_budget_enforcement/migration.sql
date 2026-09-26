-- AlterTable
ALTER TABLE "UsageBudget" ADD COLUMN     "hardEnforce" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "memberCapCents" INTEGER;
