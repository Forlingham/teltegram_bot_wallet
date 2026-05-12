import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AUTH_LOGIN_INITDATA_MAX_AGE_SECONDS,
  AUTH_NONCE_TTL_SECONDS,
  AUTH_SESSION_TTL_SECONDS,
  TELEGRAM_AUTH_MAX_AGE_SECONDS,
} from './auth.constants';
import {
  buildTelegramDataCheckString,
  generateSessionToken,
  sha256Hex,
  verifyTelegramHash,
} from './auth.utils';
import { ConfigService } from '@nestjs/config';
import { ParsedTelegramInitData, TelegramUser } from './types/telegram-user.type';
import { I18nService } from '../i18n/i18n.service';

export interface LoginResult {
  sessionToken: string;
  expiresAt: string;
  user: {
    id: number;
    telegramId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
    language: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async loginWithTelegram(initData: string): Promise<LoginResult> {
    this.logger.log(`Telegram login attempt, initData size=${initData.length}`);
    const parsed = this.parseAndVerifyInitData(initData, AUTH_LOGIN_INITDATA_MAX_AGE_SECONDS);
    await this.ensureNonceUnused(parsed.hash);

    const user = await this.upsertUser(parsed.user);
    const sessionToken = generateSessionToken();
    const tokenHash = sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_SECONDS * 1000);

    await this.prisma.session.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      sessionToken,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        language: user.language,
      },
    };
  }

  async validateSessionToken(token: string): Promise<{ userId: number; telegramId: string }> {
    if (!token || token.length < 32) {
      throw new UnauthorizedException('Invalid session token');
    }

    const tokenHash = sha256Hex(token);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    // Sliding window: extend expiration on every successful use
    const newExpiresAt = new Date(Date.now() + AUTH_SESSION_TTL_SECONDS * 1000);
    if (newExpiresAt.getTime() > session.expiresAt.getTime()) {
      await this.prisma.session.update({
        where: { tokenHash },
        data: { expiresAt: newExpiresAt },
      });
    }

    return {
      userId: session.userId,
      telegramId: session.user.telegramId,
    };
  }

  async revokeSession(token: string): Promise<void> {
    const tokenHash = sha256Hex(token);
    await this.prisma.session.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async getProfileById(userId: number): Promise<{
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
    language: string | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        language: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Update the user's language preference.
   */
  async updateLanguage(userId: number, language: string): Promise<{ language: string }> {
    if (!I18nService.isSupportedLanguage(language)) {
      throw new BadRequestException(`Unsupported language: ${language}. Supported: zh-CN, en, ru`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { language },
    });

    return { language };
  }

  /**
   * Verify a fresh initData signature without consuming the nonce.
   * Use this for sensitive actions that must be performed inside the
   * Telegram Mini App (e.g. claiming a red packet).
   */
  async verifyInitData(initData: string, maxAgeSeconds = 60): Promise<TelegramUser> {
    const parsed = this.parseAndVerifyInitData(initData, maxAgeSeconds);
    return parsed.user;
  }

  private parseAndVerifyInitData(initData: string, customMaxAge?: number): ParsedTelegramInitData {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    const authDateRaw = params.get('auth_date');
    const userRaw = params.get('user');

    if (!hash || !authDateRaw || !userRaw) {
      throw new BadRequestException('Invalid Telegram initData payload');
    }

    const authDate = Number(authDateRaw);
    if (!Number.isFinite(authDate)) {
      throw new BadRequestException('Invalid auth_date');
    }

    const age = Math.floor(Date.now() / 1000) - authDate;
    const maxAge = customMaxAge ?? TELEGRAM_AUTH_MAX_AGE_SECONDS;
    // Allow a small clock skew (up to 60s into the future) between the
    // Telegram client and our server. Negative age means the client clock
    // is slightly ahead of the server, which is normal.
    const CLOCK_SKEW_TOLERANCE = 60;
    if (age < -CLOCK_SKEW_TOLERANCE || age > maxAge) {
      throw new UnauthorizedException('initData expired');
    }

    const botToken = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    const dataCheckString = buildTelegramDataCheckString(params);
    const isValidHash = verifyTelegramHash(dataCheckString, hash, botToken);

    if (!isValidHash) {
      this.logger.warn('Telegram hash verification failed');
      throw new UnauthorizedException('Telegram hash verification failed');
    }

    let user: TelegramUser;
    try {
      user = JSON.parse(userRaw) as TelegramUser;
    } catch {
      throw new BadRequestException('Invalid Telegram user payload');
    }

    if (!user.id) {
      throw new BadRequestException('Telegram user id missing');
    }

    this.logger.log(`Telegram user verified: ${user.id}`);

    return {
      hash,
      authDate,
      user,
      queryId: params.get('query_id') ?? undefined,
      startParam: params.get('start_param') ?? undefined,
    };
  }

  private async ensureNonceUnused(nonce: string): Promise<void> {
    const now = new Date();
    await this.prisma.authNonce.deleteMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    });

    const expiresAt = new Date(now.getTime() + AUTH_NONCE_TTL_SECONDS * 1000);

    try {
      await this.prisma.authNonce.upsert({
        where: { nonce },
        create: { nonce, expiresAt },
        update: { expiresAt },
      });
    } catch (e: any) {
      // Only treat as replay if it's a unique constraint violation that
      // upsert couldn't handle (shouldn't happen, but guard defensively).
      if (e?.code === 'P2002') {
        this.logger.warn('Replay detected for Telegram nonce');
        throw new UnauthorizedException('Replay detected');
      }
      throw e;
    }
  }

  private upsertUser(user: TelegramUser) {
    const inferredLanguage = I18nService.mapTelegramLanguageCode(user.language_code);

    return this.prisma.user.upsert({
      where: { telegramId: String(user.id) },
      create: {
        telegramId: String(user.id),
        username: user.username ?? null,
        firstName: user.first_name ?? null,
        lastName: user.last_name ?? null,
        photoUrl: user.photo_url ?? null,
        language: inferredLanguage,
      },
      update: {
        username: user.username ?? null,
        firstName: user.first_name ?? null,
        lastName: user.last_name ?? null,
        photoUrl: user.photo_url ?? null,
      },
    }).then(async (dbUser) => {
      // Backfill: if existing user has no language set, infer from Telegram language_code
      if (!dbUser.language && inferredLanguage) {
        return this.prisma.user.update({
          where: { id: dbUser.id },
          data: { language: inferredLanguage },
        });
      }
      return dbUser;
    });
  }
}
