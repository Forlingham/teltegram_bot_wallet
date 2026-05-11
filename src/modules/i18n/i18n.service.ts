import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { zhCN, en, ru } from './locales';

export type SupportedLanguage = 'zh-CN' | 'en' | 'ru';

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const locales: Record<SupportedLanguage, typeof en> = {
  'zh-CN': zhCN,
  en,
  ru,
};

@Injectable()
export class I18nService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /**
   * Map a Telegram language_code (e.g. "zh-hans", "ru", "en") to our supported languages.
   * Returns null if no mapping found (will fall back to default).
   */
  static mapTelegramLanguageCode(code?: string | null): SupportedLanguage | null {
    if (!code) return null;
    const lower = code.toLowerCase();

    if (lower.startsWith('zh')) return 'zh-CN';
    if (lower.startsWith('ru')) return 'ru';
    if (lower.startsWith('en')) return 'en';

    // Default: return null to let caller decide
    return null;
  }

  /**
   * Check if a value is a supported language string.
   */
  static isSupportedLanguage(lang: string): lang is SupportedLanguage {
    return lang === 'zh-CN' || lang === 'en' || lang === 'ru';
  }

  /**
   * Get translations object for a given language.
   */
  getTranslations(language?: string | null): typeof en {
    if (language && I18nService.isSupportedLanguage(language)) {
      return locales[language];
    }
    return locales[DEFAULT_LANGUAGE];
  }

  /**
   * Retrieve the user's language preference by telegramId.
   * Falls back to default language if user not found or language not set.
   */
  async getUserLanguage(telegramId: string): Promise<SupportedLanguage> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { language: true },
    });

    if (user?.language && I18nService.isSupportedLanguage(user.language)) {
      return user.language;
    }

    return DEFAULT_LANGUAGE;
  }

  /**
   * Get translations for a user by telegramId (queries DB for language preference).
   */
  async getTranslationsForUser(telegramId: string): Promise<typeof en> {
    const lang = await this.getUserLanguage(telegramId);
    return this.getTranslations(lang);
  }
}
