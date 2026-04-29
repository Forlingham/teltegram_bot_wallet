-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "backupCompletedAt" TIMESTAMP(3),
ADD COLUMN     "isMnemonicBackedUp" BOOLEAN NOT NULL DEFAULT false;
