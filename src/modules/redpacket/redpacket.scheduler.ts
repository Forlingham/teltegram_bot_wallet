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

  /**
   * 计算下次重试延迟（阶梯退避）
   * - 第1次失败：2分钟
   * - 第2次失败：5分钟
   * - 第3次失败：10分钟
   * - 第4次失败：20分钟
   * - 第5次失败：30分钟
   * - 之后逐步增加，最大4小时
   */
  private getRetryDelayMs(retryCount: number): number {
    const delays = [
      2 * 60 * 1000,   // 1: 2分钟
      5 * 60 * 1000,   // 2: 5分钟
      10 * 60 * 1000,  // 3: 10分钟
      20 * 60 * 1000,  // 4: 20分钟
      30 * 60 * 1000,  // 5: 30分钟
      45 * 60 * 1000,  // 6: 45分钟
      60 * 60 * 1000,  // 7: 60分钟
      90 * 60 * 1000,  // 8: 90分钟
      120 * 60 * 1000, // 9: 120分钟
      180 * 60 * 1000, // 10: 180分钟
      240 * 60 * 1000, // 11: 240分钟(4小时封顶)
    ];

    const index = retryCount - 1;
    if (index < 0) return delays[0];
    if (index >= delays.length) return delays[delays.length - 1];
    return delays[index];
  }

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
      try {
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
              packetHashShort: refreshed.packetHash.slice(-4),
              fundingTxid: refreshed.fundingTxid,
              senderAddress: senderWallet?.address ?? null,
              senderTelegramUsername: sender?.username ?? null,
              amount: refreshed.remainingAmount.toString(),
              strategy: refreshed.type,
              blessMessage: refreshed.message ?? null,
              timestamp: new Date().toISOString(),
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
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to expire packet ${packet.id}: ${reason}`);
      }
    }
  }

  @Cron('*/40 * * * * *')
  async processPendingTransfers(): Promise<void> {
    const now = new Date();
    const pendings = await this.prisma.pendingTransfer.findMany({
      where: {
        status: 'PENDING',
        AND: [
          {
            OR: [
              { nextRetryAt: null },
              { nextRetryAt: { lte: now } },
            ],
          },
          {
            OR: [
              { errorMessage: null },
              { errorMessage: '' },
              {
                errorMessage: {
                  not: 'Waiting for user wallet address',
                },
              },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    if (pendings.length > 0) {
      this.logger.log(`Found ${pendings.length} pending transfers to process`);
    }

    for (const pending of pendings) {
      this.logger.log(`Processing pending transfer ${pending.id} (type: ${pending.type}, amount: ${pending.amount})`);
      
      let targetAddress = pending.targetAddress;

      if (!targetAddress) {
        const wallet = await this.prisma.wallet.findUnique({ where: { userId: pending.userId } });
        if (!wallet?.address) {
          const nextRetryAt = new Date(Date.now() + 60_000); // 1分钟后再次检查
          this.logger.log(
            `Pending transfer ${pending.id}: User ${pending.userId} has no wallet address yet. Will check again at ${nextRetryAt.toISOString()}`,
          );
          await this.prisma.pendingTransfer.update({
            where: { id: pending.id },
            data: {
              status: 'PENDING',
              errorMessage: 'Waiting for user wallet address',
              nextRetryAt,
            },
          });
          continue;
        }

        targetAddress = wallet.address;
        this.logger.log(`Found wallet address ${targetAddress} for user ${pending.userId}, updating pending transfer ${pending.id}`);
        await this.prisma.pendingTransfer.update({
          where: { id: pending.id },
          data: {
            targetAddress,
            errorMessage: null,
          },
        });
      }

      const nextRetryCount = pending.retryCount + 1;
      this.logger.log(`Pending transfer ${pending.id} set to PROCESSING, retryCount: ${nextRetryCount}`);
      
      await this.prisma.pendingTransfer.update({
        where: { id: pending.id },
        data: {
          status: 'PROCESSING',
          retryCount: nextRetryCount,
        },
      });

      try {
        let transferTxid: string | null = null;
        this.logger.log(`Calling transferToAddress for pending ${pending.id} to ${targetAddress}`);
        
        const transfer = await this.transferService.transferToAddress(
          pending.id,
          pending.amount.toString(),
          targetAddress,
        );
        transferTxid = transfer.txid;
        
        this.logger.log(`Transfer ${pending.id} success! txid: ${transferTxid}`);

        await this.prisma.pendingTransfer.update({
          where: { id: pending.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
            errorMessage: null,
            nextRetryAt: null,
          },
        });

        if (pending.claimId) {
          await this.prisma.redPacketClaim.updateMany({
            where: { id: pending.claimId, status: 'PENDING' },
            data: {
              status: 'COMPLETED',
              txid: transferTxid,
              nextRetryAt: null,
            },
          });
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(`Pending transfer ${pending.id} failed during transferToAddress: ${reason}`, error instanceof Error ? error.stack : undefined);

        const retryDelay = this.getRetryDelayMs(nextRetryCount);
        const nextRetryAt = new Date(Date.now() + retryDelay);

        this.logger.log(
          `Pending transfer ${pending.id} will retry after ${retryDelay}ms (retryCount: ${nextRetryCount}, nextRetryAt: ${nextRetryAt.toISOString()})`,
        );

        await this.prisma.pendingTransfer.update({
          where: { id: pending.id },
          data: {
            status: 'PENDING',
            errorMessage: reason,
            nextRetryAt,
          },
        });

        if (pending.claimId) {
          await this.prisma.redPacketClaim.updateMany({
            where: { id: pending.claimId, status: 'PENDING' },
            data: {
              status: 'PENDING',
              nextRetryAt,
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
