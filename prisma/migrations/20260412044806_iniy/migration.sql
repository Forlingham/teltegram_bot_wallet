-- CreateEnum
CREATE TYPE "RedPacketType" AS ENUM ('EQUAL', 'RANDOM');

-- CreateEnum
CREATE TYPE "RedPacketStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PendingTransferType" AS ENUM ('REDPACKET_CLAIM', 'REFUND');

-- CreateEnum
CREATE TYPE "PendingTransferStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "encryptedMnemonic" TEXT,
    "salt" TEXT,
    "iv" TEXT,
    "authTag" TEXT,
    "isWatchOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utxo" (
    "id" SERIAL NOT NULL,
    "txid" TEXT NOT NULL,
    "vout" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "scriptPubKey" TEXT NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "blockHeight" INTEGER NOT NULL DEFAULT 0,
    "isSpent" BOOLEAN NOT NULL DEFAULT false,
    "spentByTxid" TEXT,
    "isUnconfirmed" BOOLEAN NOT NULL DEFAULT false,
    "isCoinbase" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utxo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedPacket" (
    "id" SERIAL NOT NULL,
    "packetHash" TEXT NOT NULL,
    "senderId" INTEGER NOT NULL,
    "type" "RedPacketType" NOT NULL,
    "totalAmount" DECIMAL(20,8) NOT NULL,
    "remainingAmount" DECIMAL(20,8) NOT NULL,
    "count" INTEGER NOT NULL,
    "remainingCount" INTEGER NOT NULL,
    "message" TEXT,
    "coverId" INTEGER,
    "chatId" TEXT NOT NULL,
    "fundingTxid" TEXT NOT NULL,
    "status" "RedPacketStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedPacketClaim" (
    "id" SERIAL NOT NULL,
    "redPacketId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "txid" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedPacketClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingTransfer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "PendingTransferType" NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "claimId" INTEGER,
    "txid" TEXT,
    "status" "PendingTransferStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PendingTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cover" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCover" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "coverId" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockSync" (
    "id" SERIAL NOT NULL,
    "lastBlockHeight" INTEGER NOT NULL DEFAULT 0,
    "lastBlockHash" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE INDEX "Utxo_address_isSpent_isUnconfirmed_idx" ON "Utxo"("address", "isSpent", "isUnconfirmed");

-- CreateIndex
CREATE UNIQUE INDEX "Utxo_txid_vout_key" ON "Utxo"("txid", "vout");

-- CreateIndex
CREATE UNIQUE INDEX "RedPacket_packetHash_key" ON "RedPacket"("packetHash");

-- CreateIndex
CREATE INDEX "RedPacket_senderId_createdAt_idx" ON "RedPacket"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "RedPacket_status_expiredAt_idx" ON "RedPacket"("status", "expiredAt");

-- CreateIndex
CREATE INDEX "RedPacketClaim_status_claimedAt_idx" ON "RedPacketClaim"("status", "claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RedPacketClaim_redPacketId_userId_key" ON "RedPacketClaim"("redPacketId", "userId");

-- CreateIndex
CREATE INDEX "PendingTransfer_status_createdAt_idx" ON "PendingTransfer"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCover_userId_coverId_key" ON "UserCover"("userId", "coverId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utxo" ADD CONSTRAINT "Utxo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedPacket" ADD CONSTRAINT "RedPacket_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedPacket" ADD CONSTRAINT "RedPacket_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "Cover"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedPacketClaim" ADD CONSTRAINT "RedPacketClaim_redPacketId_fkey" FOREIGN KEY ("redPacketId") REFERENCES "RedPacket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedPacketClaim" ADD CONSTRAINT "RedPacketClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingTransfer" ADD CONSTRAINT "PendingTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCover" ADD CONSTRAINT "UserCover_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCover" ADD CONSTRAINT "UserCover_coverId_fkey" FOREIGN KEY ("coverId") REFERENCES "Cover"("id") ON DELETE CASCADE ON UPDATE CASCADE;
