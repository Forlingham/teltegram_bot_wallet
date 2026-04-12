import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoverController } from './cover.controller';
import { CoverService } from './cover.service';

@Module({
  imports: [AuthModule],
  controllers: [CoverController],
  providers: [CoverService],
  exports: [CoverService],
})
export class CoverModule {}
