-- AlterTable
ALTER TABLE "ApiKeyCheckout" ADD COLUMN     "assignedById" TEXT;

-- AddForeignKey
ALTER TABLE "ApiKeyCheckout" ADD CONSTRAINT "ApiKeyCheckout_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
