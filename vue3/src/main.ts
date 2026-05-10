import { Buffer } from 'buffer'
if (typeof window !== 'undefined' && !(window as any).Buffer) {
  ;(window as any).Buffer = Buffer
}

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import router from './router'
import App from './App.vue'
import { createI18n } from './i18n'
import './styles/main.css'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)

// Catch unexpected runtime errors that would otherwise kill the mount
// silently and leave the preloader stuck on screen forever.
app.config.errorHandler = (err, _instance, info) => {
  console.error('[SCASH] Vue runtime error:', err, info)
}

function removeLoader() {
  const loader = document.getElementById('app-loading')
  if (!loader) return
  loader.classList.add('fade-out')
  setTimeout(() => loader.remove(), 350)
}

/**
 * Show a visible error message inside the pre-Vue loading screen when the
 * app fails to mount. Without this, the spinner would keep spinning forever
 * with no way for the user to know what's wrong unless they open devtools.
 */
function showFatalBootError(err: unknown) {
  const msg = (err as Error)?.stack || (err as Error)?.message || String(err)
  console.error('[SCASH] Fatal boot error:', err)

  const loader = document.getElementById('app-loading')
  if (!loader) return
  const text = loader.querySelector('.app-loading-text')
  if (text) {
    text.textContent = 'Boot failed — please reopen the Mini App'
    ;(text as HTMLElement).style.color = '#c0392b'
    ;(text as HTMLElement).style.whiteSpace = 'pre-wrap'
    ;(text as HTMLElement).style.maxWidth = '90vw'
    ;(text as HTMLElement).style.fontSize = '12px'
  }
  // Also dump the raw stack so the user can copy it without opening devtools.
  const pre = document.createElement('pre')
  pre.textContent = msg
  pre.style.cssText = [
    'max-width: 90vw',
    'max-height: 40vh',
    'overflow: auto',
    'margin-top: 12px',
    'padding: 8px',
    'background: rgba(0,0,0,0.04)',
    'border-radius: 6px',
    'font-size: 10px',
    'color: #374151',
    'white-space: pre-wrap',
    'word-break: break-all',
    'font-family: monospace',
  ].join(';')
  loader.appendChild(pre)
}

try {
  app.use(pinia)
  app.use(router)
  app.use(createI18n())
  app.mount('#app')
  removeLoader()
} catch (e) {
  showFatalBootError(e)
}