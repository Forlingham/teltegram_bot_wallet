/**
 * Supported locale codes for the SCASH wallet UI.
 * Keep in sync with the files under `src/i18n/locales/`.
 */
export type Locale = 'zh-CN' | 'en' | 'ru'

export const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en', 'ru']

export const DEFAULT_LOCALE: Locale = 'en'

/**
 * A translation dictionary is a plain nested object whose leaves are strings.
 * Interpolation uses `{name}` placeholders.
 */
export type Messages = Record<string, any>

/**
 * Human-readable labels for the locale picker.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-CN': '中文',
  en: 'English',
  ru: 'Русский',
}
