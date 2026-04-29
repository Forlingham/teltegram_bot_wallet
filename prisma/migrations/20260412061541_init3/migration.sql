-- AlterTable
ALTER TABLE "PendingTransfer" ADD COLUMN     "redPacketId" INTEGER,
ADD COLUMN     "targetAddress" TEXT;

-- CreateTable
CREATE TABLE "DapEvent" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "packetHash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "txid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DapEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DapEvent_status_createdAt_idx" ON "DapEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DapEvent_packetHash_action_idx" ON "DapEvent"("packetHash", "action");

-- AddForeignKey
ALTER TABLE "PendingTransfer" ADD CONSTRAINT "PendingTransfer_redPacketId_fkey" FOREIGN KEY ("redPacketId") REFERENCES "RedPacket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
