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
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to expire packet ${packet.id}: ${reason}`);
      }
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

    if (pendings.length > 0) {
      // 过滤掉因为没有钱包地址而挂起的，不要每次都打印总数，只打印真正要处理的
      const actionablePendings = pendings.filter(p => p.errorMessage !== 'Waiting for user wallet address' || p.targetAddress);
      if (actionablePendings.length > 0) {
        this.logger.log(`Found ${actionablePendings.length} actionable pending transfers to process`);
      }
    }

    for (const pending of pendings) {
      if (pending.errorMessage !== 'Waiting for user wallet address' || pending.targetAddress) {
        this.logger.log(`Processing pending transfer ${pending.id} (type: ${pending.type}, amount: ${pending.amount})`);
      }
      
      let targetAddress = pending.targetAddress;
      
      if (!targetAddress) {
        const wallet = await this.prisma.wallet.findUnique({ where: { userId: pending.userId } });
        if (!wallet?.address) {
          // 只在第一次失败时打印日志，避免每 20 秒刷屏
          if (pending.errorMessage !== 'Waiting for user wallet address') {
            this.logger.log(`Pending transfer ${pending.id} failed: User ${pending.userId} has no wallet address yet. Will retry when wallet is created.`);
            await this.prisma.pendingTransfer.update({
              where: { id: pending.id },
              data: {
                status: 'PENDING',
                errorMessage: 'Waiting for user wallet address',
              },
            });
          }
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
        this.logger.error(`Pending transfer ${pending.id} failed during transferToAddress: ${reason}`, error instanceof Error ? error.stack : undefined);

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
