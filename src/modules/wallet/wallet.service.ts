import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletEncryptedPayloadDto } from './dto/wallet-encrypted-payload.dto';
import { BindWalletDto } from './dto/bind-wallet.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { satoshiToScash, scashToSatoshi } from '../../common/utils/money.util';
import { WalletHomeDto } from './dto/wallet-home.dto';

type WalletHistoryItem = {
  txid: string;
  direction: 'in' | 'out';
  amount: string;
  address: string;
  time: string;
  isUnconfirmed?: boolean;
  kind?: 'wallet' | 'redpacket';
  redpacketType?: 'CREATE' | 'CLAIM' | 'REFUND';
  packetHash?: string;
  redpacketInfo?: {
    status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'REFUNDED';
    expiresAt: string;
    claimedCount: number;
    totalCount: number;
    totalAmount: string;
    remainingCount: number;
    remainingAmount: string;
    canShare: boolean;
    shareUrl?: string;
  };
};

@Injectable()
export class WalletService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async getHistory(userId: number): Promise<{
    transactions: WalletHistoryItem[];
  }> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      const claims = await this.prisma.redPacketClaim.findMany({
        where: { userId },
        include: { redPacket: true },
        orderBy: { claimedAt: 'desc' },
        take: 100,
      });

      return {
        transactions: claims.map((claim) => ({
          txid: claim.txid || `claim-${claim.id}`,
          direction: 'in',
          amount: claim.amount.toString(),
          address: claim.redPacket?.packetHash || '-',
          time: claim.claimedAt.toISOString(),
          isUnconfirmed: claim.status !== 'COMPLETED',
          kind: 'redpacket',
          redpacketType: 'CLAIM',
          packetHash: claim.redPacket?.packetHash,
        })),
      };
    }

    const [received, spentInputs] = await Promise.all([
      this.prisma.utxo.findMany({
        where: { address: wallet.address },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      this.prisma.utxo.findMany({
        where: {
          address: wallet.address,
          isSpent: true,
          spentByTxid: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
        take: 1000,
      }),
    ]);

    const perTx = new Map<string, {
      txid: string;
      receiveSat: bigint;
      spendSat: bigint;
      hasUnconfirmed: boolean;
      time: Date;
    }>();

    for (const row of received) {
      const current = perTx.get(row.txid) || {
        txid: row.txid,
        receiveSat: 0n,
        spendSat: 0n,
        hasUnconfirmed: false,
        time: row.createdAt,
      };
      current.receiveSat += scashToSatoshi(row.amount.toString());
      current.hasUnconfirmed = current.hasUnconfirmed || row.isUnconfirmed;
      if (row.createdAt > current.time) current.time = row.createdAt;
      perTx.set(row.txid, current);
    }

    for (const row of spentInputs) {
      if (!row.spentByTxid) continue;
      const current = perTx.get(row.spentByTxid) || {
        txid: row.spentByTxid,
        receiveSat: 0n,
        spendSat: 0n,
        hasUnconfirmed: false,
        time: row.updatedAt,
      };
      current.spendSat += scashToSatoshi(row.amount.toString());
      if (row.updatedAt > current.time) current.time = row.updatedAt;
      perTx.set(row.spentByTxid, current);
    }

    const transactions: WalletHistoryItem[] = Array.from(perTx.values())
      .map((tx) => {
        const netSat = tx.receiveSat - tx.spendSat;
        const direction: 'in' | 'out' = netSat >= 0n ? 'in' : 'out';
        const amountSat = netSat >= 0n ? netSat : -netSat;
        return {
          txid: tx.txid,
          direction,
          amount: satoshiToScash(amountSat),
          address: wallet.address,
          time: tx.time.toISOString(),
          isUnconfirmed: tx.hasUnconfirmed,
          kind: 'wallet',
        } as WalletHistoryItem;
      })
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 100);

    const txids = transactions.map((item) => item.txid);
    const [createdPackets, pendingTransfers] = await Promise.all([
      this.prisma.redPacket.findMany({
        where: {
          fundingTxid: { in: txids },
          senderId: userId,
        },
        include: {
          cover: {
            select: {
              botPath: true,
            },
          },
        },
      }),
      this.prisma.pendingTransfer.findMany({
        where: {
          txid: { in: txids },
          type: { in: ['REDPACKET_CLAIM', 'REFUND'] },
        },
        include: {
          redPacket: {
            select: {
              packetHash: true,
            },
          },
        },
      }),
    ]);

    const createByTxid = new Map<string, {
      packetHash: string;
      expiresAt: Date;
      claimedCount: number;
      totalCount: number;
      totalAmount: string;
      remainingCount: number;
      remainingAmount: string;
      status: string;
      botPath: string;
    }>();
    for (const item of createdPackets) {
      createByTxid.set(item.fundingTxid, {
        packetHash: item.packetHash,
        expiresAt: item.expiredAt,
        claimedCount: item.count - item.remainingCount,
        totalCount: item.count,
        totalAmount: item.totalAmount.toString(),
        remainingCount: item.remainingCount,
        remainingAmount: item.remainingAmount.toString(),
        status: item.status,
        botPath: item.cover?.botPath || 'open1',
      });
    }

    const transferByTxid = new Map<string, { type: 'CLAIM' | 'REFUND'; packetHash?: string }>();
    for (const item of pendingTransfers) {
      if (!item.txid) continue;
      transferByTxid.set(item.txid, {
        type: item.type === 'REFUND' ? 'REFUND' : 'CLAIM',
        packetHash: item.redPacket?.packetHash,
      });
    }

    for (const item of transactions) {
      const createPacket = createByTxid.get(item.txid);
      if (createPacket) {
        const isActive = createPacket.status === 'ACTIVE' && createPacket.remainingCount > 0;
        item.kind = 'redpacket';
        item.redpacketType = 'CREATE';
        item.packetHash = createPacket.packetHash;
        item.redpacketInfo = {
          status: createPacket.status as 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'REFUNDED',
          expiresAt: createPacket.expiresAt.toISOString(),
          claimedCount: createPacket.claimedCount,
          totalCount: createPacket.totalCount,
          totalAmount: createPacket.totalAmount,
          remainingCount: createPacket.remainingCount,
          remainingAmount: createPacket.remainingAmount,
          canShare: isActive,
          shareUrl: isActive
            ? this.buildShareUrl(createPacket.botPath, createPacket.packetHash)
            : undefined,
        };
        continue;
      }

      const transfer = transferByTxid.get(item.txid);
      if (transfer) {
        item.kind = 'redpacket';
        item.redpacketType = transfer.type;
        item.packetHash = transfer.packetHash;
      }
    }

    return { transactions };
  }

  async createWallet(userId: number, payload: WalletEncryptedPayloadDto): Promise<{ address: string }> {
    await this.ensureAddressNotUsedByOtherUser(payload.address, userId);

    await this.prisma.wallet.upsert({
      where: { userId },
      create: {
        userId,
        address: payload.address,
        encryptedMnemonic: payload.encryptedMnemonic,
        salt: payload.salt,
        iv: payload.iv,
        authTag: payload.authTag,
        isWatchOnly: false,
        isMnemonicBackedUp: false,
        backupCompletedAt: null,
      },
      update: {
        address: payload.address,
        encryptedMnemonic: payload.encryptedMnemonic,
        salt: payload.salt,
        iv: payload.iv,
        authTag: payload.authTag,
        isWatchOnly: false,
        isMnemonicBackedUp: false,
        backupCompletedAt: null,
      },
    });

    await this.prisma.pendingTransfer.updateMany({
      where: {
        userId,
        status: 'PENDING',
        errorMessage: 'Waiting for user wallet address',
      },
      data: {
        errorMessage: null,
        targetAddress: payload.address,
      },
    });

    return { address: payload.address };
  }

  async importWallet(userId: number, payload: WalletEncryptedPayloadDto): Promise<{ address: string }> {
    return this.createWallet(userId, payload);
  }

  async bindWatchWallet(userId: number, payload: BindWalletDto): Promise<{ address: string }> {
    await this.ensureAddressNotUsedByOtherUser(payload.address, userId);

    await this.prisma.wallet.upsert({
      where: { userId },
      create: {
        userId,
        address: payload.address,
        isWatchOnly: true,
        isMnemonicBackedUp: true,
        backupCompletedAt: new Date(),
      },
      update: {
        address: payload.address,
        encryptedMnemonic: null,
        salt: null,
        iv: null,
        authTag: null,
        isWatchOnly: true,
        isMnemonicBackedUp: true,
        backupCompletedAt: new Date(),
      },
    });

    await this.prisma.pendingTransfer.updateMany({
      where: {
        userId,
        status: 'PENDING',
        errorMessage: 'Waiting for user wallet address',
      },
      data: {
        errorMessage: null,
        targetAddress: payload.address,
      },
    });

    return { address: payload.address };
  }

  async backupWallet(
    userId: number,
    payload: WalletEncryptedPayloadDto,
  ): Promise<{ backedUp: boolean; address: string }> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppException('Wallet not found', 'WALLET_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (wallet.isWatchOnly) {
      throw new AppException(
        'Watch-only wallet cannot save encrypted mnemonic backup',
        'WATCH_ONLY_WALLET_BACKUP_FORBIDDEN',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.wallet.update({
      where: { userId },
      data: {
        address: payload.address,
        encryptedMnemonic: payload.encryptedMnemonic,
        salt: payload.salt,
        iv: payload.iv,
        authTag: payload.authTag,
        isMnemonicBackedUp: true,
        backupCompletedAt: new Date(),
      },
    });

    return {
      backedUp: true,
      address: payload.address,
    };
  }

  async recoverWallet(
    userId: number,
  ): Promise<
    | {
        backup: {
          address: string;
          encryptedMnemonic: string;
          salt: string;
          iv: string;
          authTag: string;
        };
      }
    | { backup: null }
  > {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (
      !wallet ||
      !wallet.encryptedMnemonic ||
      !wallet.salt ||
      !wallet.iv ||
      !wallet.authTag
    ) {
      return { backup: null };
    }

    return {
      backup: {
        address: wallet.address,
        encryptedMnemonic: wallet.encryptedMnemonic,
        salt: wallet.salt,
        iv: wallet.iv,
        authTag: wallet.authTag,
      },
    };
  }

  async getBalance(
    userId: number,
    includeUnconfirmed: boolean,
  ): Promise<{
    address: string;
    balance: string;
    utxos: Array<{ txid: string; vout: number; amount: string; isUnconfirmed: boolean }>;
  }> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppException('Wallet not found', 'WALLET_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const utxos = await this.prisma.utxo.findMany({
      where: {
        address: wallet.address,
        isSpent: false,
        ...(includeUnconfirmed ? {} : { isUnconfirmed: false }),
      },
      orderBy: [{ blockHeight: 'asc' }, { createdAt: 'asc' }],
    });

    const totalSatoshi = utxos.reduce((sum, item) => {
      return sum + scashToSatoshi(item.amount.toString());
    }, 0n);

    return {
      address: wallet.address,
      balance: satoshiToScash(totalSatoshi),
      utxos: utxos.map((item) => ({
        txid: item.txid,
        vout: item.vout,
        amount: satoshiToScash(scashToSatoshi(item.amount.toString())),
        isUnconfirmed: item.isUnconfirmed,
      })),
    };
  }

  async getHomeState(userId: number): Promise<WalletHomeDto & {
    pendingAirdrop?: {
      amount: string;
      count: number;
    }
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      // 查询是否有等待到账的金额
      const pendings = await this.prisma.pendingTransfer.findMany({
        where: {
          userId,
          status: 'PENDING',
          targetAddress: null, // 还没绑定地址的情况
        }
      });
      
      let pendingAirdrop;
      if (pendings.length > 0) {
        const totalPendingSats = pendings.reduce((sum, p) => sum + scashToSatoshi(p.amount.toString()), 0n);
        pendingAirdrop = {
          amount: satoshiToScash(totalPendingSats),
          count: pendings.length
        };
      }

      return {
        hasWallet: false,
        address: null,
        isWatchOnly: false,
        isMnemonicBackedUp: false,
        showBackupReminder: false,
        pendingAirdrop,
        avatarUrl: user?.photoUrl ?? null,
      };
    }

    return {
      hasWallet: true,
      address: wallet.address,
      isWatchOnly: wallet.isWatchOnly,
      isMnemonicBackedUp: wallet.isMnemonicBackedUp,
      showBackupReminder: !wallet.isWatchOnly && !wallet.isMnemonicBackedUp,
      avatarUrl: user?.photoUrl ?? null,
    };
  }

  async markBackupCompleted(userId: number, backedUp: boolean): Promise<{ backedUp: boolean }> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppException('Wallet not found', 'WALLET_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (wallet.isWatchOnly) {
      return { backedUp: true };
    }

    await this.prisma.wallet.update({
      where: { userId },
      data: {
        isMnemonicBackedUp: backedUp,
        backupCompletedAt: backedUp ? new Date() : null,
      },
    });

    return { backedUp };
  }

  async updatePassword(userId: number, payload: WalletEncryptedPayloadDto): Promise<void> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppException('Wallet not found', 'WALLET_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (wallet.isWatchOnly) {
      throw new AppException('Watch-only wallet cannot update password', 'WATCH_ONLY_UPDATE_FORBIDDEN', HttpStatus.BAD_REQUEST);
    }
    
    await this.prisma.wallet.update({
      where: { userId },
      data: {
        encryptedMnemonic: payload.encryptedMnemonic,
        salt: payload.salt,
        iv: payload.iv,
        authTag: payload.authTag,
      },
    });
  }

  async unbindWallet(userId: number): Promise<void> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new AppException('Wallet not found', 'WALLET_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    
    await this.prisma.wallet.delete({
      where: { userId },
    });
  }

  private async ensureAddressNotUsedByOtherUser(address: string, userId: number): Promise<void> {
    const existing = await this.prisma.wallet.findUnique({ where: { address } });
    if (existing && existing.userId !== userId) {
      throw new AppException(
        'Address already bound to another user',
        'WALLET_ADDRESS_ALREADY_BOUND',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private buildShareUrl(botPath: string, packetHash: string): string {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const botUsername = nodeEnv === 'production' ? 'SCASH_Wallet_bot' : 'scash_red_envelope_bot';
    return `https://t.me/${botUsername}/${botPath}?startapp=${encodeURIComponent(`rp_${packetHash}`)}`;
  }
}