import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class RedpacketTransferService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BlockchainService) private readonly blockchain: BlockchainService,
  ) {}

  async transferToAddress(
    pendingId: number,
    amount: string,
    toAddress: string,
  ): Promise<{ txid: string }> {
    if (!toAddress) {
      throw new AppException('Target address required', 'TRANSFER_ADDRESS_REQUIRED', HttpStatus.BAD_REQUEST);
    }

    const txid = await this.blockchain.call<string>('sendtoaddress', [toAddress, Number(amount)]);

    await this.prisma.pendingTransfer.update({
      where: { id: pendingId },
      data: {
        txid,
      },
    });

    return { txid };
  }
}
