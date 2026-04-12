import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { AuthenticatedUser } from '../auth/types/request-with-user.type';
import { WalletEncryptedPayloadDto } from './dto/wallet-encrypted-payload.dto';
import { BindWalletDto } from './dto/bind-wallet.dto';
import { WalletBalanceQueryDto } from './dto/wallet-balance-query.dto';
import { WalletBackupCompleteDto } from './dto/wallet-backup-complete.dto';
import { WalletHomeDto } from './dto/wallet-home.dto';
import { WalletBroadcastDto } from './dto/wallet-broadcast.dto';

@Controller('api/wallet')
@UseGuards(AuthGuard)
export class WalletController {
  constructor(
    @Inject(WalletService) private readonly walletService: WalletService,
    @Inject(BlockchainService) private readonly blockchainService: BlockchainService,
  ) {}

  @Post('create')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: WalletEncryptedPayloadDto,
  ): Promise<{ address: string }> {
    return this.walletService.createWallet(user.userId, payload);
  }

  @Post('import')
  import(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: WalletEncryptedPayloadDto,
  ): Promise<{ address: string }> {
    return this.walletService.importWallet(user.userId, payload);
  }

  @Post('bind')
  bind(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: BindWalletDto,
  ): Promise<{ address: string }> {
    return this.walletService.bindWatchWallet(user.userId, payload);
  }

  @Post('backup')
  backup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: WalletEncryptedPayloadDto,
  ): Promise<{ backedUp: boolean; address: string }> {
    return this.walletService.backupWallet(user.userId, payload);
  }

  @Post('recover')
  recover(
    @CurrentUser() user: AuthenticatedUser,
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
    return this.walletService.recoverWallet(user.userId);
  }

  @Get('balance')
  balance(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletBalanceQueryDto,
  ): Promise<{
    address: string;
    balance: string;
    utxos: Array<{ txid: string; vout: number; amount: string; isUnconfirmed: boolean }>;
  }> {
    return this.walletService.getBalance(user.userId, query.includeUnconfirmed ?? false);
  }

  @Get('home')
  home(@CurrentUser() user: AuthenticatedUser): Promise<WalletHomeDto> {
    return this.walletService.getHomeState(user.userId);
  }

  @Post('backup/complete')
  backupComplete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: WalletBackupCompleteDto,
  ): Promise<{ backedUp: boolean }> {
    return this.walletService.markBackupCompleted(user.userId, payload.backedUp);
  }

  @Post('broadcast')
  async broadcast(@Body() body: WalletBroadcastDto): Promise<{ txid: string }> {
    const txid = await this.blockchainService.broadcastTransaction(body.hex);
    return { txid };
  }
}
