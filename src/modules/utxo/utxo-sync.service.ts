import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { Subscriber } from 'zeromq';

type RawTransaction = {
  txid: string;
  vout: Array<{
    n: number;
    value: number;
    scriptPubKey: {
      hex: string;
      address?: string;
      addresses?: string[];
    };
  }>;
  vin: Array<{
    txid?: string;
    vout?: number;
    coinbase?: string;
  }>;
};

@Injectable()
export class UtxoSyncService implements OnModuleInit {
  private readonly logger = new Logger(UtxoSyncService.name);
  private blockSocket?: Subscriber;
  private txSocket?: Subscriber;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BlockchainService) private readonly blockchain: BlockchainService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.catchUpBlocks();
    void this.startZmqListeners();
  }

  private async catchUpBlocks(): Promise<void> {
    const tip = await this.blockchain.call<number>('getblockcount');
    const blockSync = await this.prisma.blockSync.findFirst();
    const startHeight = blockSync ? blockSync.lastBlockHeight + 1 : 0;

    if (startHeight > tip) {
      return;
    }

    for (let height = startHeight; height <= tip; height += 1) {
      const hash = await this.blockchain.call<string>('getblockhash', [height]);
      await this.processBlockByHash(hash, height);
      await this.prisma.blockSync.upsert({
        where: { id: blockSync?.id ?? 1 },
        create: {
          id: 1,
          lastBlockHeight: height,
          lastBlockHash: hash,
        },
        update: {
          lastBlockHeight: height,
          lastBlockHash: hash,
        },
      });
    }
  }

  private async startZmqListeners(): Promise<void> {
    const blockUrl = this.configService.getOrThrow<string>('ZMQ_BLOCK_URL');
    const txUrl = this.configService.getOrThrow<string>('ZMQ_TX_URL');

    this.blockSocket = new Subscriber();
    this.blockSocket.connect(blockUrl);
    this.blockSocket.subscribe('hashblock');

    this.txSocket = new Subscriber();
    this.txSocket.connect(txUrl);
    this.txSocket.subscribe('rawtx');

    void this.listenBlocks();
    void this.listenTransactions();
  }

  private async listenBlocks(): Promise<void> {
    if (!this.blockSocket) {
      return;
    }

    for await (const [topic, message] of this.blockSocket) {
      if (topic.toString() !== 'hashblock') {
        continue;
      }

      const hash = message.toString('hex');
      const height = await this.blockchain.call<number>('getblockcount');
      await this.processBlockByHash(hash, height);
      await this.prisma.blockSync.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          lastBlockHeight: height,
          lastBlockHash: hash,
        },
        update: {
          lastBlockHeight: height,
          lastBlockHash: hash,
        },
      });
    }
  }

  private async listenTransactions(): Promise<void> {
    if (!this.txSocket) {
      return;
    }

    for await (const [topic, message] of this.txSocket) {
      if (topic.toString() !== 'rawtx') {
        continue;
      }

      const rawTxHex = message.toString('hex');
      try {
        await this.processRawTransaction(rawTxHex, true);
      } catch (error) {
        this.logger.warn(`Failed to process mempool tx: ${String(error)}`);
      }
    }
  }

  private async processBlockByHash(hash: string, height: number): Promise<void> {
    const block = await this.blockchain.call<{ tx: RawTransaction[] }>('getblock', [hash, 2]);
    for (const tx of block.tx) {
      await this.processDecodedTransaction(tx, false, height);
    }
  }

  private async processRawTransaction(
    rawTxHex: string,
    isUnconfirmed: boolean,
    blockHeight = 0,
  ): Promise<void> {
    const tx = await this.blockchain.call<RawTransaction>('decoderawtransaction', [rawTxHex]);
    await this.processDecodedTransaction(tx, isUnconfirmed, blockHeight);
  }

  private async processDecodedTransaction(
    tx: RawTransaction,
    isUnconfirmed: boolean,
    blockHeight: number,
  ): Promise<void> {
    const txid = tx.txid;

    await this.prisma.$transaction(async (trx) => {
      for (const vin of tx.vin) {
        if (!vin.txid || typeof vin.vout !== 'number') {
          continue;
        }

        await trx.utxo.updateMany({
          where: {
            txid: vin.txid,
            vout: vin.vout,
          },
          data: {
            isSpent: true,
            spentByTxid: txid,
          },
        });
      }

      for (const output of tx.vout) {
        const address = output.scriptPubKey.address ?? output.scriptPubKey.addresses?.[0];
        if (!address) {
          continue;
        }

        await trx.utxo.upsert({
          where: {
            txid_vout: {
              txid,
              vout: output.n,
            },
          },
          create: {
            txid,
            vout: output.n,
            address,
            scriptPubKey: output.scriptPubKey.hex,
            amount: output.value,
            blockHeight: isUnconfirmed ? 0 : blockHeight,
            isUnconfirmed,
            isSpent: false,
            isCoinbase: !!tx.vin[0]?.coinbase,
          },
          update: {
            blockHeight: isUnconfirmed ? 0 : blockHeight,
            isUnconfirmed,
            isCoinbase: !!tx.vin[0]?.coinbase,
          },
        });
      }
    });
  }

}
