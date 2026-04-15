import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedpacketTransferService } from './redpacket-transfer.service';
import { DapService } from './dap.service';

@Injectable()
export class RedpacketScheduler {
  private readonly logger = new Logger(RedpacketScheduler.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedpacketTransferService)
    private readonly transferService: RedpacketTransferService,
    @Inject(DapService) private readonly dapService: DapService,
  ) {}

  @Cron('*/30 * * * * *')
  async expirePackets(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.redPacket.findMany({
      where: {
        status: 'ACTIVE',
        expiredAt: { lte: now },
      },
    });

    for (const packet of expired) {
      await this.prisma.$transaction(async (trx) => {
        const refreshed = await trx.redPacket.findUnique({ where: { id: packet.id } });
        if (!refreshed || refreshed.status !== 'ACTIVE') {
          return;
        }

        if (Number(refreshed.remainingAmount) > 0) {
          const senderWallet = await trx.wallet.findUnique({ where: { userId: refreshed.senderId } });

          await trx.pendingTransfer.create({
            data: {
              userId: refreshed.senderId,
              type: 'REFUND',
              amount: refreshed.remainingAmount.toString(),
              redPacketId: refreshed.id,
              targetAddress: senderWallet?.address ?? null,
              status: 'PENDING',
            },
          });

          const sender = await trx.user.findUnique({ where: { id: refreshed.senderId } });
          await this.dapService.enqueue('REFUND', refreshed.packetHash, {
            type: 'RED_PACKET',
            data: {
              action: 'REFUND',
              packetHash: refreshed.packetHash,
              fundingTxid: refreshed.fundingTxid,
              senderAddress: senderWallet?.address ?? null,
              senderTelegramUsername: sender?.username ?? null,
              amount: refreshed.remainingAmount.toString(),
              strategy: refreshed.type,
              blessMessage: refreshed.message ?? null,
            },
          });
        }

        await trx.redPacket.update({
          where: { id: packet.id },
          data: {
            status: Number(refreshed.remainingAmount) > 0 ? 'REFUNDED' : 'EXPIRED',
          },
        });
      });
    }
  }

  @Cron('*/20 * * * * *')
  async processPendingTransfers(): Promise<void> {
    const pendings = await this.prisma.pendingTransfer.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    for (const pending of pendings) {
      let targetAddress = pending.targetAddress;
      if (!targetAddress) {
        const wallet = await this.prisma.wallet.findUnique({ where: { userId: pending.userId } });
        if (!wallet?.address) {
          await this.prisma.pendingTransfer.update({
            where: { id: pending.id },
            data: {
              status: 'PENDING',
              errorMessage: 'Waiting for user wallet address',
            },
          });
          continue;
        }

        targetAddress = wallet.address;
        await this.prisma.pendingTransfer.update({
          where: { id: pending.id },
          data: {
            targetAddress,
            errorMessage: null,
          },
        });
      }

      const nextRetryCount = pending.retryCount + 1;
      await this.prisma.pendingTransfer.update({
        where: { id: pending.id },
        data: {
          status: 'PROCESSING',
          retryCount: nextRetryCount,
        },
      });

      try {
        let transferTxid: string | null = null;
        const transfer = await this.transferService.transferToAddress(
          pending.id,
          pending.amount.toString(),
          targetAddress,
        );
        transferTxid = transfer.txid;

        await this.prisma.pendingTransfer.update({
          where: { id: pending.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
            errorMessage: null,
          },
        });

        if (pending.claimId) {
          await this.prisma.redPacketClaim.updateMany({
            where: { id: pending.claimId, status: 'PENDING' },
            data: {
              status: 'COMPLETED',
              txid: transferTxid,
            },
          });
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Pending transfer ${pending.id} failed: ${reason}`);

        await this.prisma.pendingTransfer.update({
          where: { id: pending.id },
          data: {
            status: nextRetryCount >= 5 ? 'FAILED' : 'PENDING',
            errorMessage: reason,
          },
        });

        if (pending.claimId) {
          await this.prisma.redPacketClaim.updateMany({
            where: { id: pending.claimId, status: 'PENDING' },
            data: {
              status: nextRetryCount >= 5 ? 'FAILED' : 'PENDING',
            },
          });
        }
      }
    }
  }

  @Cron('*/25 * * * * *')
  async processDapEvents(): Promise<void> {
    const events = await this.prisma.dapEvent.findMany({
      where: {
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    for (const event of events) {
      try {
        // TODO: 替换为真实 scash-dap 广播逻辑
        const simulatedTxid = `dap_${event.id}_${Date.now()}`;
        await this.dapService.markBroadcasted(event.id, simulatedTxid);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        await this.dapService.markFailed(event.id, reason);
      }
    }
  }
}
