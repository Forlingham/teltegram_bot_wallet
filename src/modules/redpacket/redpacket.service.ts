import { createHash, randomBytes } from 'crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { RedpacketCreateDto, RedPacketTypeDto } from './dto/redpacket-create.dto';
import { scashToSatoshi, satoshiToScash } from '../../common/utils/money.util';
import { DapService } from './dap.service';

export interface CreateResult {
  packetId: string;
  expiredAt: string;
}

@Injectable()
export class RedpacketService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DapService) private readonly dapService: DapService,
  ) {}

  async createPacket(userId: number, payload: RedpacketCreateDto): Promise<CreateResult> {
    if (payload.count <= 0) {
      throw new AppException('Count must be positive', 'REDPACKET_COUNT_INVALID', HttpStatus.BAD_REQUEST);
    }

    const totalAmount = scashToSatoshi(payload.totalAmount);
    if (totalAmount <= 0n) {
      throw new AppException('Amount must be positive', 'REDPACKET_AMOUNT_INVALID', HttpStatus.BAD_REQUEST);
    }

    const feeReserve = scashToSatoshi(payload.feeReserve);
    if (feeReserve < 0n) {
      throw new AppException('Fee reserve invalid', 'REDPACKET_FEE_RESERVE_INVALID', HttpStatus.BAD_REQUEST);
    }

    const packetHash = payload.packetHash || this.buildPacketHash(userId, payload.txid);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const sender = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!sender) {
      throw new AppException('User not found', 'USER_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const created = await this.prisma.redPacket.create({
      data: {
        packetHash,
        senderId: userId,
        type: payload.type === RedPacketTypeDto.EQUAL ? 'EQUAL' : 'RANDOM',
        totalAmount: payload.totalAmount,
        remainingAmount: payload.totalAmount,
        count: payload.count,
        remainingCount: payload.count,
        message: payload.message ?? null,
        coverId: payload.coverId ?? null,
        chatId: 'unknown',
        fundingTxid: payload.txid,
        expiredAt: expiresAt,
      },
    });

    await this.dapService.enqueue('CREATE', packetHash, {
      type: 'RED_PACKET',
      data: {
        action: 'CREATE',
        packetHash,
        senderTelegramId: sender.telegramId,
        senderTelegramUsername: sender.username,
        senderAddress: payload.senderAddress || null,
        fundingTxid: payload.txid,
        amount: payload.totalAmount,
        count: payload.count,
        strategy: payload.type,
        expiredAt: Math.floor(expiresAt.getTime() / 1000),
        timestamp: Math.floor(Date.now() / 1000),
      },
    });

    return {
      packetId: created.packetHash,
      expiredAt: expiresAt.toISOString(),
    };
  }

  async getPacket(userId: number, packetHash: string) {
    const packet = await this.prisma.redPacket.findUnique({
      where: { packetHash },
      include: { claims: true },
    });

    if (!packet) {
      throw new AppException('Red packet not found', 'REDPACKET_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const hasClaimed = await this.prisma.redPacketClaim.findUnique({
      where: {
        redPacketId_userId: {
          redPacketId: packet.id,
          userId,
        },
      },
    });

    return {
      redPacket: packet,
      claims: packet.claims,
      canClaim: packet.status === 'ACTIVE' && !hasClaimed,
    };
  }

  async listPackets(userId: number, type?: 'sent' | 'received') {
    if (type === 'received') {
      const claims = await this.prisma.redPacketClaim.findMany({
        where: { userId },
        include: { redPacket: true },
        orderBy: { claimedAt: 'desc' },
      });
      return claims.map((claim) => claim.redPacket);
    }

    return this.prisma.redPacket.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async claimPacket(userId: number, packetHash: string, address?: string) {
    return this.prisma.$transaction(async (trx) => {
      const packet = await trx.redPacket.findUnique({
        where: { packetHash },
        include: { claims: true, sender: true },
      });

      if (!packet) {
        throw new AppException('Red packet not found', 'REDPACKET_NOT_FOUND', HttpStatus.NOT_FOUND);
      }

      if (packet.status !== 'ACTIVE') {
        throw new AppException('Red packet is not active', 'REDPACKET_NOT_ACTIVE', HttpStatus.BAD_REQUEST);
      }

      if (packet.expiredAt.getTime() <= Date.now()) {
        throw new AppException('Red packet expired', 'REDPACKET_EXPIRED', HttpStatus.BAD_REQUEST);
      }

      const existing = await trx.redPacketClaim.findUnique({
        where: {
          redPacketId_userId: {
            redPacketId: packet.id,
            userId,
          },
        },
      });

      if (existing) {
        return {
          amount: existing.amount.toString(),
          message: 'Already claimed',
        };
      }

      if (packet.remainingCount <= 0) {
        throw new AppException('No remaining packets', 'REDPACKET_SOLD_OUT', HttpStatus.BAD_REQUEST);
      }

      const amount = this.allocateAmount(packet.type, packet.remainingAmount.toString(), packet.remainingCount);
      const receiverWallet = await trx.wallet.findUnique({ where: { userId } });
      const targetAddress = address ?? receiverWallet?.address ?? null;

      const claim = await trx.redPacketClaim.create({
        data: {
          redPacketId: packet.id,
          userId,
          amount,
          status: 'PENDING',
        },
      });

      await trx.redPacket.update({
        where: { id: packet.id },
        data: {
          remainingCount: packet.remainingCount - 1,
          remainingAmount: satoshiToScash(scashToSatoshi(packet.remainingAmount.toString()) - scashToSatoshi(amount)),
          status: packet.remainingCount - 1 === 0 ? 'COMPLETED' : 'ACTIVE',
        },
      });

      await trx.pendingTransfer.create({
        data: {
          userId,
          type: 'REDPACKET_CLAIM',
          amount,
          redPacketId: packet.id,
          claimId: claim.id,
          targetAddress,
          status: 'PENDING',
        },
      });

      const claimer = await trx.user.findUnique({ where: { id: userId } });
      await this.dapService.enqueue('CLAIM', packetHash, {
        type: 'RED_PACKET',
        data: {
          action: 'CLAIM',
          packetHash,
          fundingTxid: packet.fundingTxid,
          claimerTelegramId: claimer?.telegramId ?? String(userId),
          claimerTelegramUsername: claimer?.username ?? null,
          claimerAddress: targetAddress,
          amount,
          timestamp: Math.floor(Date.now() / 1000),
        },
      });

      return {
        amount,
        message: address ? 'Claimed' : 'Claimed without wallet',
      };
    });
  }

  private allocateAmount(type: string, remainingAmount: string, remainingCount: number): string {
    const total = scashToSatoshi(remainingAmount);
    if (remainingCount <= 1) {
      return satoshiToScash(total);
    }

    if (type === 'EQUAL') {
      const per = total / BigInt(remainingCount);
      return satoshiToScash(per);
    }

    const min = 1n;
    const max = (total / BigInt(remainingCount)) * 2n;
    const restMinimum = BigInt(remainingCount - 1);
    let upper = max;
    const safeUpper = total - restMinimum;
    if (upper > safeUpper) {
      upper = safeUpper;
    }
    if (upper < min) {
      upper = min;
    }

    const range = upper - min + 1n;
    const random = BigInt(Math.floor(Math.random() * Number(range)));
    return satoshiToScash(min + random);
  }

  private buildPacketHash(userId: number, txid: string): string {
    const seed = `${userId}:${txid}:${Date.now()}:${randomBytes(8).toString('hex')}`;
    return createHash('sha256').update(seed).digest('hex').slice(0, 32);
  }
}
