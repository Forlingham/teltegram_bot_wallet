import { Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { RedpacketService } from './redpacket.service';
import { RedpacketController } from './redpacket.controller';
import { RedpacketScheduler } from './redpacket.scheduler';
import { DapService } from './dap.service';
import { RedpacketTransferService } from './redpacket-transfer.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [BlockchainModule, AuthModule],
  controllers: [RedpacketController],
  providers: [RedpacketService, RedpacketScheduler, DapService, RedpacketTransferService],
  exports: [RedpacketService],
})
export class RedpacketModule {}
