import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedPacketDapPayload } from './redpacket.types';

@Injectable()
export class DapService {
  private readonly logger = new Logger(DapService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async enqueue(action: string, packetHash: string, payload: RedPacketDapPayload): Promise<void> {
    await this.prisma.dapEvent.create({
      data: {
        action,
        packetHash,
        payload: JSON.stringify(payload),
        status: 'PENDING',
      },
    });
  }

  async markBroadcasted(id: number, txid?: string): Promise<void> {
    await this.prisma.dapEvent.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        txid: txid ?? null,
        errorMessage: null,
      },
    });
  }

  async markFailed(id: number, reason: string): Promise<void> {
    this.logger.warn(`DAP event ${id} failed: ${reason}`);
    await this.prisma.dapEvent.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage: reason,
      },
    });
  }
}
