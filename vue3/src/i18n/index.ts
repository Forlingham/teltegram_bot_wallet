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
 */
import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'

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

const MESSAGES: Record<Locale, Messages> = {
  'zh-CN': zhCN,
  en,
  ru,
}

// ---- Reactive locale ----

const locale = ref<Locale>(resolveInitialLocale())

function isSupported(code: string | undefined | null): code is Locale {
  return !!code && (SUPPORTED_LOCALES as string[]).includes(code)
}

/**
 * Normalise an arbitrary BCP-47 language tag to one of our supported locales.
 * Examples:
 *   "zh-Hans-CN" -> "zh-CN"
 *   "zh"         -> "zh-CN"
 *   "en-US"      -> "en"
 *   "ru-RU"      -> "ru"
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
    const saved = localStorage.getItem(STORAGE_KEY)
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

// Persist any change so reloads remember the user's selection.
watch(locale, (val) => {
  try {
    localStorage.setItem(STORAGE_KEY, val)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = val
    }
  } catch {}
}, { immediate: true })

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
}

/**
 * Global install — exposes `$t` and `$locale` to all components so plain
 * `<template>` interpolation works without importing `useI18n` everywhere.
 */
export function createI18n() {
  return {
    install(app: import('vue').App) {
      app.config.globalProperties.$t = t
      app.config.globalProperties.$locale = locale
      app.provide('i18n', { t, locale, setLocale })
    },
  }
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_LABELS } from './types'
export type { Locale, Messages } from './types'
