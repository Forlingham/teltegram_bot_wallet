import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/main.css'
import App from './App.vue'
import router from './router'
import { getAppEnv, getWalletHome } from './api/app'
import { useAppStore } from './store/app'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const appStore = useAppStore()

async function initApp() {
  appStore.initTelegram()

  const token = appStore.getSessionToken()
  if (token) {
    appStore.setSessionToken(token)
  }

  if (appStore.isTelegram) {
    try {
      const envData = await getAppEnv()
      appStore.setEnv(envData.env || 'development')
    } catch {
      appStore.setEnv('development')
    }

    try {
      const homeData = await getWalletHome()
      appStore.setWalletData(homeData)
    } catch (e) {
      console.error('Failed to load wallet home:', e)
    }
  }

  app.mount('#app')
}

initApp()