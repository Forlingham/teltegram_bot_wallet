import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './modules/health/health.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { RedpacketModule } from './modules/redpacket/redpacket.module';
import { CoverModule } from './modules/cover/cover.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { UtxoModule } from './modules/utxo/utxo.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { envValidationSchema } from './config/env.validation';
import { PagesModule } from './modules/pages/pages.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      cache: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    WalletModule,
    RedpacketModule,
    CoverModule,
    BlockchainModule,
    UtxoModule,
    PagesModule,
  ],
})
export class AppModule {}
