import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { scashToSatoshi, satoshiToScash } from '../../common/utils/money.util';

interface SelectedUtxo {
  txid: string;
  vout: number;
  amount: string;
  isUnconfirmed: boolean;
}

@Injectable()
export class UtxoService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async selectUtxos(address: string, amount: string, feeRate: number): Promise<{
    utxos: SelectedUtxo[];
    totalAmount: string;
  }> {
    const target = scashToSatoshi(amount);
    const confirmed = await this.prisma.utxo.findMany({
      where: {
        address,
        isSpent: false,
        isUnconfirmed: false,
      },
      orderBy: [{ blockHeight: 'asc' }, { createdAt: 'asc' }],
    });

    let selected = this.selectFromPool(confirmed, target, feeRate);
    if (!selected) {
      const unconfirmed = await this.prisma.utxo.findMany({
        where: {
          address,
          isSpent: false,
          isUnconfirmed: true,
        },
        orderBy: [{ blockHeight: 'asc' }, { createdAt: 'asc' }],
      });

      selected = this.selectFromPool([...confirmed, ...unconfirmed], target, feeRate);
    }

    if (!selected) {
      throw new AppException('Insufficient balance', 'UTXO_INSUFFICIENT', HttpStatus.BAD_REQUEST);
    }

    return {
      utxos: selected.utxos.map((item) => ({
        txid: item.txid,
        vout: item.vout,
        amount: satoshiToScash(scashToSatoshi(item.amount.toString())),
        isUnconfirmed: item.isUnconfirmed,
      })),
      totalAmount: satoshiToScash(selected.total),
    };
  }

  private selectFromPool(
    pool: Array<{ txid: string; vout: number; amount: any; isUnconfirmed: boolean }>,
    target: bigint,
    feeRate: number,
  ): { utxos: typeof pool; total: bigint } | null {
    let total = 0n;
    const selected: typeof pool = [];

    for (const utxo of pool) {
      selected.push(utxo);
      total += scashToSatoshi(utxo.amount.toString());

      const fee = this.estimateFee(selected.length, 2, feeRate);
      if (total >= target + fee) {
        return { utxos: selected, total };
      }
    }

    return null;
  }

  private estimateFee(inputs: number, outputs: number, feeRate: number): bigint {
    const vsize = 11 + inputs * 180 + outputs * 31;
    const fee = BigInt(Math.ceil(vsize * feeRate));
    return fee;
  }
}
