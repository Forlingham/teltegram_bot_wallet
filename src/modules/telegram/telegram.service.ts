import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';
import { satoshiToScash, scashToSatoshi } from '../../common/utils/money.util';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf | null = null;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(I18nService) private readonly i18n: I18nService,
  ) {}

  onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set, bot will not start');
      return;
    }

    this.bot = new Telegraf(token);
    this.registerCommands();
    
    this.bot.catch((err, ctx) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Bot error for ${ctx.updateType}: ${message}`);
    });

    this.bot.launch();
    this.logger.log('Telegram bot started');

    const bot = this.bot;
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }

  /**
   * Get the Mini App domain URL (used for web_app buttons in private chat).
   */
  private getMiniAppUrl(): string {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    return isProduction
      ? 'https://telegram.scash.network'
      : this.configService.get<string>('MINIAPP_URL', 'https://ttt.scash.network');
  }

  /**
   * Get the Mini App direct link (used for url buttons in group chats).
   * Format: https://t.me/bot_username/app_shortname
   * Falls back to MINIAPP_URL if MINIAPP_DIRECT_LINK is not configured.
   */
  private getMiniAppDirectLink(): string {
    return this.configService.get<string>('MINIAPP_DIRECT_LINK') || this.getMiniAppUrl();
  }

  private isPrivateChat(ctx: Context): boolean {
    return ctx.chat?.type === 'private';
  }

  /**
   * Build an inline keyboard button that opens the Mini App.
   * - In private chats: use web_app button (native Mini App experience).
   * - In groups/supergroups/channels: use url button with t.me direct link
   *   (web_app buttons are not allowed outside private chats).
   */
  private buildMiniAppButton(text: string, isPrivate: boolean, startParam?: string): { text: string; web_app?: { url: string }; url?: string } {
    if (isPrivate) {
      return { text, web_app: { url: this.getMiniAppUrl() } };
    }
    const directLink = this.getMiniAppDirectLink();
    const url = startParam ? `${directLink}?startapp=${startParam}` : directLink;
    return { text, url };
  }

  private registerCommands() {
    if (!this.bot) return;

    this.bot.start(async (ctx) => {
      try {
        const telegramId = ctx.from.id.toString();
        const isPrivate = this.isPrivateChat(ctx);
        const t = await this.i18n.getTranslationsForUser(telegramId);

        ctx.reply(t.bot.start.welcome, {
          reply_markup: {
            inline_keyboard: [
              [this.buildMiniAppButton(t.bot.start.openWallet, isPrivate)],
            ],
          },
        });
      } catch (error) {
        this.logger.error(`Error in /start command: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    this.bot.command('balance', async (ctx) => {
      try {
        const telegramId = ctx.from.id.toString();
        const isPrivate = this.isPrivateChat(ctx);
        const t = await this.i18n.getTranslationsForUser(telegramId);
        
        const user = await this.prisma.user.findUnique({
          where: { telegramId },
          include: { wallet: true },
        });

        if (!user) {
          ctx.reply(t.bot.balance.startFirst);
          return;
        }

        if (!user.wallet) {
          ctx.reply(t.bot.balance.noWallet, {
            reply_markup: {
              inline_keyboard: [
                [this.buildMiniAppButton(t.bot.balance.createWallet, isPrivate)],
              ],
            },
          });
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
          `${t.bot.balance.title}\n\n` +
          `${t.bot.balance.address}: \`${shortAddress}\`\n` +
          `${t.bot.balance.balance}: ${balance} SCASH\n` +
          `${t.bot.balance.utxoCount}: ${utxos.length}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [this.buildMiniAppButton(t.bot.balance.openDetails, isPrivate)],
              ],
            },
          }
        );
      } catch (error) {
        this.logger.error(`Error in /balance command: ${error instanceof Error ? error.message : String(error)}`);
        ctx.reply('❌ Error').catch(() => {});
      }
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
      const t = await this.i18n.getTranslationsForUser(telegramId);
      const senderName = senderUsername ? `@${senderUsername}` : 'Someone';
      const message = t.bot.notify.claimSuccess(senderName, amount, packetMessage);

      // Notifications are always sent to private chat (bot → user DM)
      await this.bot.telegram.sendMessage(telegramId, message, {
        reply_markup: {
          inline_keyboard: [
            [this.buildMiniAppButton(t.bot.notify.viewWallet, true)],
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
      const t = await this.i18n.getTranslationsForUser(telegramId);
      const shortHash = packetHash.slice(0, 8);
      const message = t.bot.notify.packetCompleted(shortHash, totalAmount, claimCount);

      // Notifications are always sent to private chat (bot → user DM)
      await this.bot.telegram.sendMessage(telegramId, message, {
        reply_markup: {
          inline_keyboard: [
            [this.buildMiniAppButton(t.bot.notify.viewDetails, true)],
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
