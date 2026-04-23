import { Buffer } from 'buffer'
if (typeof window !== 'undefined' && !(window as any).Buffer) {
  ;(window as any).Buffer = Buffer
}

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import router from './router'
import App from './App.vue'
import './styles/main.css'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')

// Hide pre-Vue loading screen after mount
const loader = document.getElementById('app-loading')
if (loader) {
  loader.classList.add('fade-out')
  setTimeout(() => loader.remove(), 350)
}