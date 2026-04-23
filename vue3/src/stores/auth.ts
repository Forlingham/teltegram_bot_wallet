import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api'
import { useTelegram } from '@/composables/useTelegram'
import { useWalletStore } from './wallet'
import { usePriceStore } from './price'

const SESSION_KEY = 'SCASH_SESSION_TOKEN'
const TG_USER_KEY = 'SCASH_TG_USER_ID'
const TOKEN_PREFIX = 'SCASH_TOKEN_'

export const useAuthStore = defineStore('auth', () => {
  const sessionToken = ref(localStorage.getItem(SESSION_KEY) || '')
  const currentTgUserId = ref(localStorage.getItem(TG_USER_KEY) || '')
  const userId = ref<number | null>(null)
  const telegramId = ref('')
  const username = ref<string | null>(null)
  const firstName = ref<string | null>(null)
  const lastName = ref<string | null>(null)
  const photoUrl = ref<string | null>(null)

  const isLoggedIn = computed(() => !!sessionToken.value)

  const { getTgUser, getInitData, parseTgUserId } = useTelegram()

  function getTokenForUser(tgUserId: string): string | null {
    return localStorage.getItem(TOKEN_PREFIX + tgUserId) || null
  }

  function setTokenForUser(tgUserId: string, token: string) {
    localStorage.setItem(TOKEN_PREFIX + tgUserId, token)
    localStorage.setItem(SESSION_KEY, token)
    localStorage.setItem(TG_USER_KEY, tgUserId)
    sessionToken.value = token
    currentTgUserId.value = tgUserId
  }

  async function ensureSession(): Promise<string> {
    const tgUserId = getCurrentTgUserId()

    if (tgUserId) {
      const userToken = getTokenForUser(tgUserId)
      if (userToken) {
        localStorage.setItem(SESSION_KEY, userToken)
        localStorage.setItem(TG_USER_KEY, tgUserId)
        sessionToken.value = userToken
        currentTgUserId.value = tgUserId
        return userToken
      }
    } else {
      if (sessionToken.value) return sessionToken.value
    }

    const initData = getInitData()
    if (!initData) {
      throw new Error('会话已过期，请关闭并重新打开 Mini App')
    }

    const data = await api.post<{ sessionToken: string; expiresAt: string; user: { id: number; telegramId: string } }>('/api/auth/telegram/login', {
      initData,
    })

    const newToken = data.sessionToken
    if (tgUserId) {
      setTokenForUser(tgUserId, newToken)
    } else {
      localStorage.setItem(SESSION_KEY, newToken)
      sessionToken.value = newToken
    }

    userId.value = data.user.id
    telegramId.value = data.user.telegramId

    return newToken
  }

  function getCurrentTgUserId(): string {
    const tgUser = getTgUser()
    if (tgUser) return String(tgUser.id)
    const initData = getInitData()
    return parseTgUserId(initData) || ''
  }

  async function fetchMe() {
    const data = await api.get<{ userId: number; telegramId: string; username: string | null; firstName: string | null; lastName: string | null; photoUrl: string | null }>('/api/auth/me')
    userId.value = data.userId
    telegramId.value = data.telegramId
    username.value = data.username
    firstName.value = data.firstName
    lastName.value = data.lastName
    photoUrl.value = data.photoUrl
  }

  async function logout() {
    try {
      await api.post('/api/auth/logout')
    } catch {}

    const uid = currentTgUserId.value
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(TG_USER_KEY)
    if (uid) localStorage.removeItem(TOKEN_PREFIX + uid)

    sessionToken.value = ''
    currentTgUserId.value = ''
    userId.value = null
    telegramId.value = ''
    username.value = null
    firstName.value = null
    lastName.value = null
    photoUrl.value = null

    const walletStore = useWalletStore()
    walletStore.$reset()
    const priceStore = usePriceStore()
    priceStore.$reset()
  }

  async function handleUserSwitch() {
    const newUserId = getCurrentTgUserId()
    if (newUserId && currentTgUserId.value && newUserId !== currentTgUserId.value) {
      const walletStore = useWalletStore()
      walletStore.$reset()
      const priceStore = usePriceStore()
      priceStore.$reset()
    }
  }

  return {
    sessionToken,
    currentTgUserId,
    userId,
    telegramId,
    username,
    firstName,
    lastName,
    photoUrl,
    isLoggedIn,
    ensureSession,
    fetchMe,
    logout,
    getTokenForUser,
    setTokenForUser,
    getCurrentTgUserId,
    handleUserSwitch,
  }
}, {
  persist: {
    pick: ['sessionToken', 'currentTgUserId', 'userId', 'telegramId', 'username', 'firstName', 'lastName', 'photoUrl'],
  },
})