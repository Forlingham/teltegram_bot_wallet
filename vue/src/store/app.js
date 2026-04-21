import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const env = ref('development')
  const apiBaseUrl = ref('')
  const isLoading = ref(false)
  const tgUser = ref(null)
  const sessionToken = ref('')

  const setEnv = (newEnv) => {
    env.value = newEnv
    apiBaseUrl.value = newEnv === 'production' ? 'https://api.scash.network' : 'http://localhost:3000'
  }

  const setTgUser = (user) => {
    tgUser.value = user
  }

  const setSessionToken = (token) => {
    sessionToken.value = token
  }

  const setLoading = (loading) => {
    isLoading.value = loading
  }

  return {
    env,
    apiBaseUrl,
    isLoading,
    tgUser,
    sessionToken,
    setEnv,
    setTgUser,
    setSessionToken,
    setLoading
  }
})