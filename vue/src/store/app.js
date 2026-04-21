import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const env = ref('development')
  const isLoading = ref(false)
  const tgUser = ref(null)
  const sessionToken = ref('')
  const hasWallet = ref(false)
  const isWatchOnly = ref(false)
  const walletAddress = ref('')
  const avatarUrl = ref('')
  const showBackupReminder = ref(false)
  const pendingAirdrop = ref(null)

  const tg = ref(null)
  const isTelegram = ref(false)

  const setEnv = (newEnv) => {
    env.value = newEnv
  }

  const initTelegram = () => {
    const tgWebApp = window.Telegram?.WebApp
    if (tgWebApp?.initDataUnsafe?.user) {
      tg.value = tgWebApp
      isTelegram.value = true
      tg.value.ready()
      tgUser.value = tgWebApp.initDataUnsafe.user
    } else {
      tg.value = null
      isTelegram.value = false
    }
  }

  const setTgUser = (user) => {
    tgUser.value = user
  }

  const setSessionToken = (token) => {
    sessionToken.value = token
    localStorage.setItem('SCASH_SESSION_TOKEN', token)
  }

  const getSessionToken = () => {
    return localStorage.getItem('SCASH_SESSION_TOKEN') || ''
  }

  const setLoading = (loading) => {
    isLoading.value = loading
  }

  const setWalletData = (data) => {
    hasWallet.value = data.hasWallet || false
    isWatchOnly.value = data.isWatchOnly || false
    walletAddress.value = data.address || ''
    avatarUrl.value = data.avatarUrl || ''
    showBackupReminder.value = data.showBackupReminder || false
    pendingAirdrop.value = data.pendingAirdrop || null
  }

  const clearWalletData = () => {
    hasWallet.value = false
    isWatchOnly.value = false
    walletAddress.value = ''
    avatarUrl.value = ''
    showBackupReminder.value = false
    pendingAirdrop.value = null
  }

  return {
    env,
    isLoading,
    tgUser,
    sessionToken,
    tg,
    isTelegram,
    hasWallet,
    isWatchOnly,
    walletAddress,
    avatarUrl,
    showBackupReminder,
    pendingAirdrop,
    setEnv,
    initTelegram,
    setTgUser,
    setSessionToken,
    getSessionToken,
    setLoading,
    setWalletData,
    clearWalletData
  }
})