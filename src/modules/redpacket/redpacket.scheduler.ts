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

        await trx.redPacket.update({
          where: { id: packet.id },
          data: {
            status: 'EXPIRED',
          },
        });

        if (Number(refreshed.remainingAmount) > 0) {
          await trx.pendingTransfer.create({
            data: {
              userId: refreshed.senderId,
              type: 'REFUND',
              amount: refreshed.remainingAmount.toString(),
              redPacketId: refreshed.id,
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
              senderTelegramId: sender?.telegramId ?? String(refreshed.senderId),
              senderAddress: null,
              refundAmount: refreshed.remainingAmount.toString(),
              timestamp: Math.floor(Date.now() / 1000),
            },
          });
        }
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
      await this.prisma.pendingTransfer.update({
        where: { id: pending.id },
        data: {
          status: 'PROCESSING',
          retryCount: pending.retryCount + 1,
        },
      });

      try {
        if (pending.targetAddress) {
          await this.transferService.transferToAddress(
            pending.id,
            pending.amount.toString(),
            pending.targetAddress,
          );
        }

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
              txid: pending.txid ?? null,
            },
          });
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Pending transfer ${pending.id} failed: ${reason}`);

        await this.prisma.pendingTransfer.update({
          where: { id: pending.id },
          data: {
            status: pending.retryCount + 1 >= 5 ? 'FAILED' : 'PENDING',
            errorMessage: reason,
          },
        });

        if (pending.claimId) {
          await this.prisma.redPacketClaim.updateMany({
            where: { id: pending.claimId, status: 'PENDING' },
            data: {
              status: 'FAILED',
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
