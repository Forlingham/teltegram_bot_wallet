/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  Telegram: {
    WebApp: import('@/composables/useTelegram').TelegramWebApp
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $t: (key: string, params?: Record<string, string | number>) => string
    $locale: import('vue').Ref<import('@/i18n/types').Locale>
  }
}