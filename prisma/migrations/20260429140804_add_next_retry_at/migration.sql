-- AlterTable
ALTER TABLE "PendingTransfer" ADD COLUMN     "nextRetryAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RedPacketClaim" ADD COLUMN     "nextRetryAt" TIMESTAMP(3);
