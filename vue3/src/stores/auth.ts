import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api'
import { useTelegram } from '@/composables/useTelegram'
import { useWalletStore } from './wallet'
import { usePriceStore } from './price'

const SESSION_KEY = 'SCASH_SESSION_TOKEN'
const TG_USER_KEY = 'SCASH_TG_USER_ID'
const TOKEN_PREFIX = 'SCASH_TOKEN_'
const SESSION_EXPIRES_KEY = 'SCASH_SESSION_EXPIRES_AT'
// Refresh proactively when less than this many seconds remain
const SESSION_REFRESH_BUFFER_SECONDS = 24 * 60 * 60

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

  // In-flight request locks
  let ensureSessionPromise: Promise<string> | null = null
  let fetchMePromise: Promise<void> | null = null

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

  function getSessionExpiresAt(): number {
    const raw = localStorage.getItem(SESSION_EXPIRES_KEY)
    return raw ? parseInt(raw, 10) : 0
  }

  function setSessionExpiresAt(expiresAt: string | number) {
    const ts = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt
    localStorage.setItem(SESSION_EXPIRES_KEY, String(ts))
  }

  function shouldRefreshSession(): boolean {
    const expiresAt = getSessionExpiresAt()
    if (!expiresAt) return true
    return Date.now() >= expiresAt - SESSION_REFRESH_BUFFER_SECONDS * 1000
  }

  async function doLogin(): Promise<{ token: string; expiresAt: string }> {
    const initData = getInitData()
    if (!initData) {
      throw new Error('无法获取 Telegram 登录信息，请重新打开 Mini App')
    }

    const loginRes = await fetch('/api/auth/telegram/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
    const loginJson = await loginRes.json()
    if (!loginRes.ok || !loginJson.success) {
      const errMsg = loginJson.error?.message || '登录失败'
      const lowerMsg = errMsg.toLowerCase()
      // Detect initData expiry / replay — these are unrecoverable without
      // the user closing and re-opening the Mini App.
      if (
        lowerMsg.includes('replay') ||
        lowerMsg.includes('initdata expired') ||
        lowerMsg.includes('expired') ||
        lowerMsg.includes('init_data') ||
        lowerMsg.includes('authorization')
      ) {
        throw new Error('登录信息已过期，请重新打开 Mini App')
      }
      if (loginRes.status >= 500) {
        throw new Error('服务器内部错误，请稍后重试')
      }
      throw new Error(errMsg)
    }
    const data = loginJson.data as { sessionToken: string; expiresAt: string; user: { id: number; telegramId: string } }
    return { token: data.sessionToken, expiresAt: data.expiresAt }
  }

  async function ensureSession(): Promise<string> {
    if (ensureSessionPromise) return ensureSessionPromise

    ensureSessionPromise = (async () => {
      try {
        const tgUserId = getCurrentTgUserId()

        // 1. If we have a cached token and it's not near expiry, use it directly
        if (tgUserId) {
          const userToken = getTokenForUser(tgUserId)
          if (userToken && !shouldRefreshSession()) {
            localStorage.setItem(SESSION_KEY, userToken)
            localStorage.setItem(TG_USER_KEY, tgUserId)
            sessionToken.value = userToken
            currentTgUserId.value = tgUserId
            return userToken
          }
        } else if (sessionToken.value && !shouldRefreshSession()) {
          return sessionToken.value
        }

        // 2. Token is missing or near expiry — proactively refresh with initData
        const { token, expiresAt } = await doLogin()

        if (tgUserId) {
          setTokenForUser(tgUserId, token)
        } else {
          localStorage.setItem(SESSION_KEY, token)
          sessionToken.value = token
        }
        setSessionExpiresAt(expiresAt)

        // 3. Update in-memory user info if available from login response
        // (login response currently only returns user.id and telegramId)
        // Fetch full profile in background
        fetchMe().catch(() => {})

        return token
      } finally {
        ensureSessionPromise = null
      }
    })()

    return ensureSessionPromise
  }

  function getCurrentTgUserId(): string {
    const tgUser = getTgUser()
    if (tgUser) return String(tgUser.id)
    const initData = getInitData()
    return parseTgUserId(initData) || ''
  }

  async function fetchMe() {
    if (fetchMePromise) return fetchMePromise
    fetchMePromise = (async () => {
      try {
        const data = await api.get<{ userId: number; telegramId: string; username: string | null; firstName: string | null; lastName: string | null; photoUrl: string | null }>('/api/auth/me')
        userId.value = data.userId
        telegramId.value = data.telegramId
        username.value = data.username
        firstName.value = data.firstName
        lastName.value = data.lastName
        photoUrl.value = data.photoUrl
      } finally {
        fetchMePromise = null
      }
    })()
    return fetchMePromise
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

    // Clear persisted caches for the logged-out user
    localStorage.removeItem('wallet')
    localStorage.removeItem('history')
    localStorage.removeItem('redpacket')
    localStorage.removeItem('SCASH_PRICE_CACHE')
    localStorage.removeItem('SCASH_PRICE_CACHE_TIME')
  }

  async function handleUserSwitch() {
    const newUserId = getCurrentTgUserId()
    if (newUserId && currentTgUserId.value && newUserId !== currentTgUserId.value) {
      // Clear persisted data of the previous account so it won't leak back
      localStorage.removeItem('auth')
      localStorage.removeItem('wallet')
      localStorage.removeItem('history')
      localStorage.removeItem('redpacket')
      localStorage.removeItem('SCASH_PRICE_CACHE')
      localStorage.removeItem('SCASH_PRICE_CACHE_TIME')
      // Reset in-memory auth fields from the old account
      userId.value = null
      telegramId.value = ''
      username.value = null
      firstName.value = null
      lastName.value = null
      photoUrl.value = null
      sessionToken.value = ''
      currentTgUserId.value = newUserId
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