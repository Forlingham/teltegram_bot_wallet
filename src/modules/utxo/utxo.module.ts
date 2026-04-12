import { Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuthModule } from '../auth/auth.module';
import { UtxoService } from './utxo.service';
import { UtxoController } from './utxo.controller';
import { UtxoSyncService } from './utxo-sync.service';

@Module({
  controllers: [UtxoController],
  providers: [UtxoService, UtxoSyncService],
  exports: [UtxoService],
  imports: [BlockchainModule, AuthModule],
})
export class UtxoModule {}
