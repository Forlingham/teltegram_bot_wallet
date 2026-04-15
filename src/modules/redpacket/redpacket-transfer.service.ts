import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bip39 from 'bip39';
import { HDKey } from '@scure/bip32';
import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { BlockchainService } from '../blockchain/blockchain.service';
import { getScashNetwork } from '../../config/scash.networks';
import { deriveAddressFromMnemonic } from '../../common/utils/wallet-crypto.util';
import { scashToSatoshi, satoshiToScash } from '../../common/utils/money.util';
import { buildDapOutputs } from './redpacket-dap.util';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const DEFAULT_TRANSFER_FEE_SATS = 10_000n;

@Injectable()
export class RedpacketTransferService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BlockchainService) private readonly blockchain: BlockchainService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async transferToAddress(
    pendingId: number,
    amount: string,
    toAddress: string,
  ): Promise<{ txid: string }> {
    if (!toAddress) {
      throw new AppException('Target address required', 'TRANSFER_ADDRESS_REQUIRED', HttpStatus.BAD_REQUEST);
    }

    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const mnemonic = this.configService.get<string>('COORDINATION_ACCOUNT_MNEMONIC') || '';
    if (!mnemonic) {
      throw new AppException('Coordination mnemonic missing', 'COORDINATION_MNEMONIC_MISSING', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const poolAddress = deriveAddressFromMnemonic(mnemonic, nodeEnv);
    const network = getScashNetwork(nodeEnv);
    const amountSat = scashToSatoshi(amount);
    const feeSat = DEFAULT_TRANSFER_FEE_SATS;

    const pending = await this.prisma.pendingTransfer.findUnique({
      where: { id: pendingId },
      include: {
        redPacket: true,
        user: true,
      },
    });
    if (!pending) {
      throw new AppException('Pending transfer not found', 'PENDING_TRANSFER_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const dapMessage = this.buildTransferDapMessage(pending, amount, toAddress);
    const dap = buildDapOutputs(nodeEnv, dapMessage);
    const dapCostSat = BigInt(dap.totalSats || 0);

    const { selected, totalSat } = await this.selectFundingUtxos(poolAddress, amountSat + feeSat + dapCostSat);

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive("m/84'/0'/0'/0/0");
    const privateKey = child.privateKey;
    if (!privateKey) {
      throw new AppException('Failed to derive coordination private key', 'COORDINATION_KEY_DERIVE_FAILED', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey));
    const psbt = new bitcoin.Psbt({ network });

    for (const utxo of selected) {
      if (!utxo.scriptPubKey) {
        throw new AppException('UTXO script missing', 'UTXO_SCRIPT_MISSING', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: Buffer.from(utxo.scriptPubKey, 'hex'),
          value: scashToSatoshi(utxo.amount.toString()),
        },
      });
    }

    psbt.addOutput({
      address: toAddress,
      value: amountSat,
    });

    for (const output of dap.outputs) {
      psbt.addOutput({
        address: output.address,
        value: BigInt(output.value),
      });
    }

    const changeSat = totalSat - amountSat - feeSat - dapCostSat;
    if (changeSat > 0n) {
      psbt.addOutput({
        address: poolAddress,
        value: changeSat,
      });
    }

    for (let i = 0; i < selected.length; i += 1) {
      psbt.signInput(i, keyPair);
    }
    psbt.finalizeAllInputs();

    const txHex = psbt.extractTransaction().toHex();
    const txid = await this.blockchain.broadcastTransaction(txHex);

    await this.prisma.$transaction(async (trx) => {
      for (const utxo of selected) {
        await trx.utxo.updateMany({
          where: {
            txid: utxo.txid,
            vout: utxo.vout,
            isSpent: false,
          },
          data: {
            isSpent: true,
            spentByTxid: txid,
          },
        });
      }

      await trx.pendingTransfer.update({
        where: { id: pendingId },
        data: {
          txid,
        },
      });
    });

    return { txid };
  }

  private async selectFundingUtxos(address: string, neededSat: bigint): Promise<{
    selected: Array<{ txid: string; vout: number; amount: any; scriptPubKey: string | null }>;
    totalSat: bigint;
  }> {
    const confirmed = await this.prisma.utxo.findMany({
      where: {
        address,
        isSpent: false,
        isUnconfirmed: false,
      },
      orderBy: [{ blockHeight: 'asc' }, { createdAt: 'asc' }],
    });

    const unconfirmed = await this.prisma.utxo.findMany({
      where: {
        address,
        isSpent: false,
        isUnconfirmed: true,
      },
      orderBy: [{ blockHeight: 'asc' }, { createdAt: 'asc' }],
    });

    const pool = [...confirmed, ...unconfirmed];
    let totalSat = 0n;
    const selected: Array<{ txid: string; vout: number; amount: any; scriptPubKey: string | null }> = [];

    for (const utxo of pool) {
      selected.push(utxo);
      totalSat += scashToSatoshi(utxo.amount.toString());
      if (totalSat >= neededSat) {
        return { selected, totalSat };
      }
    }

    throw new AppException(
      `Coordination balance insufficient: need ${satoshiToScash(neededSat)} SCASH`,
      'COORDINATION_BALANCE_INSUFFICIENT',
      HttpStatus.BAD_REQUEST,
    );
  }

  private buildTransferDapMessage(
    pending: {
      type: string;
      userId: number;
      redPacket: { packetHash: string; fundingTxid: string } | null;
      user: { telegramId: string; username: string | null } | null;
    },
    amount: string,
    toAddress: string,
  ): string {
    if (!pending.redPacket) {
      throw new AppException('Red packet missing for transfer', 'REDPACKET_NOT_FOUND_FOR_TRANSFER', HttpStatus.BAD_REQUEST);
    }

    const base = {
      type: 'RED_PACKET',
      data: {
        packetHash: pending.redPacket.packetHash,
        fundingTxid: pending.redPacket.fundingTxid,
        timestamp: Math.floor(Date.now() / 1000),
      } as Record<string, unknown>,
    };

    if (pending.type === 'REFUND') {
      base.data.action = 'REFUND';
      base.data.senderTelegramId = pending.user?.telegramId ?? String(pending.userId);
      base.data.senderTelegramUsername = pending.user?.username ?? null;
      base.data.senderAddress = toAddress;
      base.data.refundAmount = amount;
      return JSON.stringify(base);
    }

    base.data.action = 'CLAIM';
    base.data.claimerTelegramId = pending.user?.telegramId ?? String(pending.userId);
    base.data.claimerTelegramUsername = pending.user?.username ?? null;
    base.data.claimerAddress = toAddress;
    base.data.amount = amount;
    return JSON.stringify(base);
  }
}
