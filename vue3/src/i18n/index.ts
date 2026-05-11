/**
 * Lightweight in-repo i18n for the SCASH wallet.
 *
 * Design goals:
 *   - Reactive locale switching via Vue's `ref`.
 *   - Nested keys via dot notation (e.g. `settings.title`).
 *   - `{placeholder}` interpolation.
 *   - Automatic detection based on Telegram `language_code` first,
 *     then `navigator.language`. Falls back to English when nothing
 *     matches the supported set.
 *   - Persistence in localStorage so subsequent launches remember the
 *     user's explicit selection.
 *
 * This module is intentionally dependency-free to avoid pulling in
 * `vue-i18n`. It exposes a `useI18n()` composable shaped similarly to
 * `vue-i18n` so view code reads naturally (`const { t, locale } = useI18n()`).
 *
 * ---- Boot-safety notes ----
 * Everything a consumer imports from here must be safe to evaluate before
 * the Vue app is created. That means:
 *   - NO module-level `watch()` / `effect()` calls.
 *   - NO `createApp` / component instantiation.
 *   - Side effects (localStorage, document.documentElement.lang) happen
 *     lazily inside `setLocale` / `createI18n().install`, never at import.
 *
 * ---- Bundle-size notes ----
 * Only the English dictionary is statically imported (needed as the
 * synchronous fallback for any t() call). The zh-CN and ru dictionaries
 * are loaded via dynamic import() so they end up in separate chunks and
 * don't bloat the initial bundle. Once the active locale's dictionary
 * has loaded, t() starts returning its strings; until then, it falls
 * back to English — so users see English for a frame or two on a cold
 * non-English launch. That's a fair trade for a faster TTI on slow
 * connections (Telegram WebView, mobile data, etc.).
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue'

import en from './locales/en'
import zhCN from './locales/zh-CN'
import ru from './locales/ru'
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
  type Messages,
} from './types'

const STORAGE_KEY = 'SCASH_LOCALE'

// All locale dictionaries are bundled synchronously for instant rendering
// without any language flash.
const MESSAGES: Record<Locale, Messages> = {
  en,
  'zh-CN': zhCN,
  ru,
}

function isSupported(code: string | undefined | null): code is Locale {
  return !!code && (SUPPORTED_LOCALES as string[]).includes(code)
}

/**
 * Normalise an arbitrary BCP-47 language tag to one of our supported locales.
 */
function normalise(tag: string | undefined | null): Locale | null {
  if (!tag) return null
  const lower = tag.toLowerCase()
  if (lower.startsWith('zh')) return 'zh-CN'
  if (lower.startsWith('en')) return 'en'
  if (lower.startsWith('ru')) return 'ru'
  return null
}

function detectFromTelegram(): Locale | null {
  try {
    const tg = (window as any)?.Telegram?.WebApp
    const code = tg?.initDataUnsafe?.user?.language_code
    return normalise(code)
  } catch {
    return null
  }
}

function detectFromNavigator(): Locale | null {
  try {
    const langs = navigator.languages && navigator.languages.length
      ? Array.from(navigator.languages)
      : [navigator.language]
    for (const lang of langs) {
      const hit = normalise(lang)
      if (hit) return hit
    }
  } catch {}
  return null
}

function resolveInitialLocale(): Locale {
  // 1. Explicit user choice from a previous session.
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (isSupported(saved)) return saved
  } catch {}

  // 2. Telegram Mini App locale (most accurate on the platform).
  const tgHit = detectFromTelegram()
  if (tgHit) return tgHit

  // 3. Browser / OS language.
  const navHit = detectFromNavigator()
  if (navHit) return navHit

  // 4. Fallback.
  return DEFAULT_LOCALE
}

// ---- Reactive locale (module singleton) ----
// A plain ref — no watchers, no effects, no side effects at module load.
const locale = ref<Locale>(resolveInitialLocale())

// Apply initial side-effects lazily from the first plugin install so that
// module evaluation itself never touches document.
let htmlLangApplied = false
function applyHtmlLangOnce() {
  if (htmlLangApplied) return
  htmlLangApplied = true
  try {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale.value
    }
  } catch {}
}

// ---- Message resolution ----

function resolveKey(msgs: Messages, key: string): string | undefined {
  const parts = key.split('.')
  let cur: any = msgs
  for (const part of parts) {
    if (cur == null) return undefined
    cur = cur[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    return params[name] != null ? String(params[name]) : `{${name}}`
  })
}

/**
 * Translate a key. Falls back to the English dictionary, then the raw key,
 * so missing keys surface visibly during development but never crash.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw =
    resolveKey(MESSAGES[locale.value], key) ??
    resolveKey(MESSAGES[DEFAULT_LOCALE], key) ??
    key
  return interpolate(raw, params)
}

/**
 * Composable usable in `<script setup>` and plain helper modules.
 * Returns the reactive `locale` ref, the translator `t`, and a setter.
 */
export function useI18n(): {
  locale: Ref<Locale>
  t: typeof t
  setLocale: (l: Locale) => void
  availableLocales: ComputedRef<Locale[]>
} {
  return {
    locale,
    t,
    setLocale,
    availableLocales: computed(() => SUPPORTED_LOCALES),
  }
}

export function setLocale(l: Locale) {
  if (!isSupported(l)) return
  locale.value = l
  try {
    localStorage.setItem(STORAGE_KEY, l)
  } catch {}
  try {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = l
    }
  } catch {}
}

/**
 * Global install — exposes `$t` and `$locale` to all components so plain
 * `<template>` interpolation works without importing `useI18n` everywhere.
 * Also applies the initial html lang attribute.
 */
export function createI18n() {
  return {
    install(app: import('vue').App) {
      applyHtmlLangOnce()
      app.config.globalProperties.$t = t
      app.config.globalProperties.$locale = locale
      app.provide('i18n', { t, locale, setLocale })
    },
  }
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_LABELS } from './types'
export type { Locale, Messages } from './types'
