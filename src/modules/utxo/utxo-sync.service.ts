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

type RawTransactionVerbose = {
  txid: string;
  confirmations?: number;
  blockhash?: string;
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
    this.logger.log('UTXO sync service initializing');
    await this.catchUpBlocks();
    this.logger.log('UTXO catch-up completed');
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
      try {
        const hash = await this.blockchain.call<string>('getblockhash', [height]);
        const block = await this.blockchain.call<{ tx: RawTransaction[] }>('getblock', [hash, 2]);

        await this.prisma.$transaction(async (trx) => {
          for (const tx of block.tx) {
            await this.processDecodedTransaction(tx, false, height, trx);
          }

          await trx.blockSync.upsert({
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
        });

        this.logger.log(`Synced block ${height} (${hash})`);
      } catch (error) {
        this.logger.error(`Failed to sync block ${height}: ${String(error)}, continuing to next block`);
      }
    }
  }

  private async syncBlocksFromCheckpoint(): Promise<void> {
    try {
      await this.catchUpBlocks();
    } catch (error) {
      this.logger.warn(`Failed to sync blocks from checkpoint: ${String(error)}`);
    }
  }

  private async startZmqListeners(): Promise<void> {
    const blockUrl = this.configService.getOrThrow<string>('ZMQ_BLOCK_URL');
    const txUrl = this.configService.getOrThrow<string>('ZMQ_TX_URL');

    this.blockSocket = new Subscriber();
    this.blockSocket.connect(blockUrl);
    this.blockSocket.subscribe('rawblock');

    this.txSocket = new Subscriber();
    this.txSocket.connect(txUrl);
    this.txSocket.subscribe('rawtx');

    this.logger.log(`ZMQ subscribed: rawblock @ ${blockUrl}`);
    this.logger.log(`ZMQ subscribed: rawtx @ ${txUrl}`);

    void this.listenBlocks();
    void this.listenTransactions();
  }

  private async listenBlocks(): Promise<void> {
    if (!this.blockSocket) {
      return;
    }

    for await (const [topic] of this.blockSocket) {
      if (topic.toString() !== 'rawblock') {
        continue;
      }

      this.logger.log('ZMQ rawblock received, syncing blocks from checkpoint');
      await this.syncBlocksFromCheckpoint();
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

  private async processRawTransaction(
    rawTxHex: string,
    isUnconfirmed: boolean,
    blockHeight = 0,
  ): Promise<void> {
    const tx = await this.blockchain.call<RawTransaction>('decoderawtransaction', [rawTxHex]);

    if (isUnconfirmed) {
      try {
        const verbose = await this.blockchain.call<RawTransactionVerbose>('getrawtransaction', [tx.txid, true]);
        if ((verbose.confirmations ?? 0) > 0 && verbose.blockhash) {
          const header = await this.blockchain.call<{ height: number }>('getblockheader', [verbose.blockhash]);
          await this.processDecodedTransaction(tx, false, header.height);
          return;
        }
      } catch (error) {
        this.logger.warn(`Failed to check tx confirmation for ${tx.txid}: ${String(error)}`);
      }
    }

    await this.processDecodedTransaction(tx, isUnconfirmed, blockHeight);
  }

  private async processDecodedTransaction(
    tx: RawTransaction,
    isUnconfirmed: boolean,
    blockHeight: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trx?: any,
  ): Promise<void> {
    const txid = tx.txid;
    const client = trx ?? this.prisma;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await client.$transaction(async (db: any) => {
      for (const vin of tx.vin) {
        if (!vin.txid || typeof vin.vout !== 'number') {
          continue;
        }

        await db.utxo.updateMany({
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

        await db.utxo.upsert({
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

      if (!isUnconfirmed && blockHeight > 0) {
        await db.utxo.updateMany({
          where: {
            txid,
            isUnconfirmed: true,
          },
          data: {
            isUnconfirmed: false,
            blockHeight,
          },
        });
      }
    });
  }

}
