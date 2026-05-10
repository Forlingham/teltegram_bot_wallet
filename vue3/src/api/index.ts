import { useAuthStore } from '@/stores/auth'
import { useTelegram } from '@/composables/useTelegram'
import router from '@/router'
import { t } from '@/i18n'

const BASE_URL = ''
const REQUEST_TIMEOUT_MS = 30000

/**
 * Check if an error message indicates a session/auth expiry (as opposed to
 * a business-level "expired" such as "red packet expired").
 *
 * We match against localized session-error copy across all supported locales
 * plus the canonical English server phrases so the detection works regardless
 * of which locale produced the message.
 */
function isSessionExpiredError(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    // English (server + translated)
    m.includes('initdata expired') ||
    m.includes('session expired') ||
    m.includes('session has expired') ||
    m.includes('token expired') ||
    m.includes('token has expired') ||
    m.includes('invalid session') ||
    m.includes('invalid token') ||
    // Chinese
    m.includes('会话已过期') ||
    m.includes('登录信息已过期') ||
    m.includes('登录状态已过期') ||
    // Russian (lowercase Cyrillic)
    m.includes('сессия истекла') ||
    m.includes('данные входа устарели') ||
    // Telegram initData replay attack detection
    (m.includes('replay') && (m.includes('init') || m.includes('auth') || m.includes('session')))
  )
}

export interface ApiError {
  status: number
  message: string
}

/**
 * Check if an error indicates the wallet was removed on the server
 * (e.g. unbound on another device). If so, clear local wallet cache
 * and redirect to home so the user sees the "create wallet" screen.
 */
function handleWalletGone(path: string, status: number, errMsg: string): boolean {
  if (
    status === 404 &&
    path.startsWith('/api/wallet') &&
    errMsg.toLowerCase().includes('wallet not found')
  ) {
    // Import wallet store lazily to avoid circular dependency at module load time.
    // useWalletStore() is safe to call here because Pinia is already initialized
    // by the time any API request fires.
    import('@/stores/wallet').then(({ useWalletStore }) => {
      const walletStore = useWalletStore()
      walletStore.$reset()
    })
    localStorage.removeItem('wallet')
    localStorage.removeItem('history')
    // Navigate to home — use replace so user can't go back to the broken page
    router.replace('/wallet')
    return true
  }
  return false
}

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
      reject(new Error(t('api.timeout')))
    }, timeoutMs)

    fetch(url, { ...options, signal: controller.signal })
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer))
  })
}

/**
 * Map HTTP / network errors to localised user-friendly messages.
 */
function getFriendlyErrorMessage(status: number, rawMessage: string): string {
  if (status === 0) return t('api.network0')
  if (status >= 500) {
    if (status === 502) return t('api.bad502')
    if (status === 503) return t('api.busy503')
    if (status === 504) return t('api.gateway504')
    return t('api.server500')
  }
  return rawMessage
}

/**
 * Translate common blockchain node (RPC) errors to the current locale.
 */
function translateNodeError(rawMessage: string): string | null {
  if (!rawMessage) return null
  const m = rawMessage.toLowerCase()

  // Mempool chain limits
  if (m.includes('too-long-mempool-chain')) {
    if (m.includes('too many descendants')) return t('api.nodeMempoolDesc')
    if (m.includes('too many ancestors')) return t('api.nodeMempoolAnc')
    return t('api.nodeMempoolTooLong')
  }

  // Fee issues
  if (
    m.includes('insufficient fee') ||
    m.includes('mempool min fee not met') ||
    m.includes('min relay fee not met') ||
    m.includes('insufficient priority')
  ) {
    return t('api.nodeLowFee')
  }

  // Double spend / input already spent
  if (m.includes('bad-txns-inputs-missingorspent')) return t('api.nodeDoubleSpent')
  if (m.includes('txn-mempool-conflict')) return t('api.nodeConflict')

  // Already known / confirmed
  if (
    m.includes('txn-already-in-mempool') ||
    m.includes('transaction already in') ||
    m.includes('already in block chain') ||
    m.includes('txn-already-known')
  ) {
    return t('api.nodeAlreadyKnown')
  }

  // Script / signature errors
  if (
    m.includes('non-mandatory-script-verify-flag') ||
    m.includes('mandatory-script-verify-flag')
  ) {
    return t('api.nodeScriptVerify')
  }

  // RPC connectivity / node overload
  if (m.includes('rpc')) {
    if (
      m.includes('econnrefused') ||
      m.includes('connection refused') ||
      m.includes('etimedout') ||
      m.includes('enotfound')
    ) {
      return t('api.nodeRpcRefused')
    }
    if (m.includes('work queue depth exceeded')) return t('api.nodeQueue')
    if (m.includes('method not found')) return t('api.nodeMethod')
    if (m.includes('internal error')) return t('api.nodeInternal')
  }

  return null
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const authStore = useAuthStore()
    const token = await authStore.ensureSession()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-session-token': token,
      ...(options.headers as Record<string, string> || {}),
    }

    let res = await fetchWithTimeout(BASE_URL + path, {
      ...options,
      headers,
    }, REQUEST_TIMEOUT_MS)

    if (res.status === 401) {
      // Session expired on server — clear local cache and attempt re-login.
      // Before retrying, check that Telegram initData is still available;
      // if not, there's no point in calling ensureSession() since doLogin()
      // will inevitably fail with the same stale initData.
      const { getInitData } = useTelegram()
      const initData = getInitData()
      if (!initData) {
        const err: ApiError = { status: 401, message: t('api.sessionExpired') }
        throw err
      }

      const uid = authStore.currentTgUserId
      localStorage.removeItem('SCASH_SESSION_TOKEN')
      localStorage.removeItem('SCASH_TG_USER_ID')
      localStorage.removeItem('SCASH_SESSION_EXPIRES_AT')
      if (uid) localStorage.removeItem('SCASH_TOKEN_' + uid)
      authStore.sessionToken = ''

      try {
        const newToken = await authStore.ensureSession()
        headers['x-session-token'] = newToken

        res = await fetchWithTimeout(BASE_URL + path, {
          ...options,
          headers,
        }, REQUEST_TIMEOUT_MS)
      } catch (retryErr: any) {
        // Re-login failed (e.g. initData expired on server side) —
        // throw a clear session error instead of a cryptic message.
        const retryMsg = retryErr?.message || ''
        if (isSessionExpiredError(retryMsg) || retryMsg.includes('重新打开') || retryMsg.includes('无法获取 Telegram')) {
          const err: ApiError = { status: 401, message: t('api.sessionExpired') }
          throw err
        }
        throw retryErr
      }
    }

    let json: any
    try {
      json = await res.json()
    } catch {
      const err: ApiError = { status: res.status, message: getFriendlyErrorMessage(res.status, t('api.generic')) }
      throw err
    }

    if (!res.ok || !json.success) {
      const errMsg = json.error?.message || t('api.generic')
      if (isSessionExpiredError(errMsg)) {
        const err: ApiError = { status: res.status, message: t('api.sessionExpired') }
        throw err
      }
      // Wallet was unbound/deleted on another device — reset and redirect
      if (handleWalletGone(path, res.status, errMsg)) {
        const err: ApiError = { status: res.status, message: t('api.walletGone') }
        throw err
      }
      const friendly = translateNodeError(errMsg) || getFriendlyErrorMessage(res.status, errMsg)
      const err: ApiError = { status: res.status, message: friendly }
      throw err
    }

    return json.data as T
  } catch (e: any) {
    // Already a structured ApiError — rethrow
    if (e && typeof e.status === 'number') {
      throw e
    }
    const msg = e?.message || ''
    // Translate known blockchain node errors first
    const nodeErr = translateNodeError(msg)
    if (nodeErr) {
      throw { status: 0, message: nodeErr } as ApiError
    }
    // Keep pre-localized messages (Chinese / Cyrillic) as-is (e.g. session expired, timeout).
    if (/[\u4e00-\u9fa5\u0400-\u04FF]/.test(msg)) {
      throw { status: 0, message: msg } as ApiError
    }
    // Network-level errors (TypeError: Failed to fetch, etc.)
    if (e instanceof TypeError || msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to')) {
      throw { status: 0, message: t('api.network0') } as ApiError
    }
    // Fallback: do not expose raw English errors to users
    throw { status: 0, message: t('api.generic') } as ApiError
  }
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'GET' })
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' })
  },
}
