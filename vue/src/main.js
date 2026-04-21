import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/main.css'
import App from './App.vue'
import router from './router'
import { getAppEnv } from './api/app'
import { useAppStore } from './store/app'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

const appStore = useAppStore()

getAppEnv()
  .then((data) => {
    appStore.setEnv(data.env || 'development')
  })
  .catch(() => {
    appStore.setEnv('development')
  })

app.mount('#app')