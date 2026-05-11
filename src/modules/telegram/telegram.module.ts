import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { I18nModule } from '../i18n/i18n.module';

@Module({
  imports: [PrismaModule, I18nModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
