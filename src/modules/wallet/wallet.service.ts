import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletEncryptedPayloadDto } from './dto/wallet-encrypted-payload.dto';
import { BindWalletDto } from './dto/bind-wallet.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { satoshiToScash, scashToSatoshi } from '../../common/utils/money.util';
import { WalletHomeDto } from './dto/wallet-home.dto';

@Injectable()
export class WalletService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

  async getHomeState(userId: number): Promise<WalletHomeDto> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      return {
        hasWallet: false,
        address: null,
        isWatchOnly: false,
        isMnemonicBackedUp: false,
        showBackupReminder: false,
      };
    }

    return {
      hasWallet: true,
      address: wallet.address,
      isWatchOnly: wallet.isWatchOnly,
      isMnemonicBackedUp: wallet.isMnemonicBackedUp,
      showBackupReminder: !wallet.isWatchOnly && !wallet.isMnemonicBackedUp,
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
}
