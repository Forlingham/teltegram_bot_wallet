/**
 * Module augmentation for Vue's ComponentCustomProperties so `$t` and
 * `$locale` are strongly typed inside templates.
 *
 * IMPORTANT: this file must be treated as a module (not a global script)
 * for `declare module 'vue'` to perform AUGMENTATION rather than full
 * REPLACEMENT of Vue's types. The `export {}` at the bottom guarantees
 * that — without it, `declare module 'vue'` silently overwrites Vue's
 * exports (wiping out `ref`, `watch`, `onMounted`, etc.).
 */
import 'vue'

declare module 'vue' {
  interface ComponentCustomProperties {
    $t: (key: string, params?: Record<string, string | number>) => string
    $locale: import('vue').Ref<import('@/i18n/types').Locale>
  }
}

export {}
