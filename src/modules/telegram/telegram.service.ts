import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import { satoshiToScash, scashToSatoshi } from '../../common/utils/money.util';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf | null = null;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set, bot will not start');
      return;
    }

    this.bot = new Telegraf(token);
    this.registerCommands();
    this.bot.launch();
    this.logger.log('Telegram bot started');

    const bot = this.bot;
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }

  private getMiniAppUrl(): string {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    return isProduction
      ? 'https://telegram.scash.network'
      : this.configService.get<string>('MINIAPP_URL', 'https://ttt.scash.network');
  }

  private registerCommands() {
    if (!this.bot) return;

    const miniAppUrl = this.getMiniAppUrl();

    this.bot.start((ctx) => {
      ctx.reply(
        '🎉 欢迎使用 SCASH 红包钱包！\n\n' +
        '这是一个基于 Scash 区块链的红包钱包，你可以：\n' +
        '• 发送和接收 SCASH 红包\n' +
        '• 管理你的钱包\n' +
        '• 查看交易记录\n\n' +
        '点击下方按钮打开钱包 👇',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 打开钱包', web_app: { url: miniAppUrl } }],
            ],
          },
        }
      );
    });

    this.bot.command('balance', async (ctx) => {
      const telegramId = ctx.from.id.toString();
      
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        include: { wallet: true },
      });

      if (!user) {
        ctx.reply('❌ 请先使用 /start 命令开始');
        return;
      }

      if (!user.wallet) {
        ctx.reply(
          '❌ 你还没有钱包\n\n' +
          '点击下方按钮创建钱包 👇',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💰 创建钱包', web_app: { url: miniAppUrl } }],
              ],
            },
          }
        );
        return;
      }

      const utxos = await this.prisma.utxo.findMany({
        where: {
          address: user.wallet.address,
          isSpent: false,
        },
      });

      const totalSatoshi = utxos.reduce((sum, item) => {
        return sum + scashToSatoshi(item.amount.toString());
      }, 0n);

      const balance = satoshiToScash(totalSatoshi);
      const address = user.wallet.address;
      const shortAddress = `${address.slice(0, 8)}...${address.slice(-6)}`;

      ctx.reply(
        `💰 钱包余额\n\n` +
        `地址: \`${shortAddress}\`\n` +
        `余额: ${balance} SCASH\n` +
        `UTXO 数量: ${utxos.length}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📱 打开钱包详情', web_app: { url: miniAppUrl } }],
            ],
          },
        }
      );
    });
  }

  async notifyClaimSuccess(
    telegramId: string,
    amount: string,
    senderUsername: string | null,
    packetMessage: string | null,
  ): Promise<void> {
    if (!this.bot) return;

    try {
      const senderName = senderUsername ? `@${senderUsername}` : 'Someone';
      const message = packetMessage
        ? `🧧 恭喜！你领取了 ${senderName} 的红包\n\n` +
          `💰 金额: ${amount} SCASH\n` +
          `📝 祝福: ${packetMessage}`
        : `🧧 恭喜！你领取了 ${senderName} 的红包\n\n` +
          `💰 金额: ${amount} SCASH`;

      const miniAppUrl = this.getMiniAppUrl();

      await this.bot.telegram.sendMessage(telegramId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 查看钱包', web_app: { url: miniAppUrl } }],
          ],
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to notify claim success to ${telegramId}: ${message}`);
    }
  }

  async notifyPacketCompleted(
    telegramId: string,
    packetHash: string,
    totalAmount: string,
    claimCount: number,
  ): Promise<void> {
    if (!this.bot) return;

    try {
      const shortHash = packetHash.slice(0, 8);
      const message = `🎊 你的红包已被领完！\n\n` +
        `📦 红包ID: ${shortHash}...\n` +
        `💰 总金额: ${totalAmount} SCASH\n` +
        `👥 领取人数: ${claimCount} 人`;

      const miniAppUrl = this.getMiniAppUrl();

      await this.bot.telegram.sendMessage(telegramId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 查看详情', web_app: { url: miniAppUrl } }],
          ],
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to notify packet completed to ${telegramId}: ${message}`);
    }
  }

  getBot(): Telegraf | null {
    return this.bot || null;
  }
}
