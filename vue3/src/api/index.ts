import { useAuthStore } from '@/stores/auth'
import router from '@/router'

const BASE_URL = ''
const REQUEST_TIMEOUT_MS = 30000

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
      reject(new Error('请求超时，请检查网络后重试'))
    }, timeoutMs)

    fetch(url, { ...options, signal: controller.signal })
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer))
  })
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    const uid = authStore.currentTgUserId
    localStorage.removeItem('SCASH_SESSION_TOKEN')
    localStorage.removeItem('SCASH_TG_USER_ID')
    if (uid) localStorage.removeItem('SCASH_TOKEN_' + uid)
    authStore.sessionToken = ''

    const newToken = await authStore.ensureSession()
    headers['x-session-token'] = newToken

    res = await fetchWithTimeout(BASE_URL + path, {
      ...options,
      headers,
    }, REQUEST_TIMEOUT_MS)
  }

  const json = await res.json()

  if (!res.ok || !json.success) {
    const errMsg = json.error?.message || '请求失败'
    if (errMsg.toLowerCase().includes('replay') || errMsg.toLowerCase().includes('expired')) {
      const err: ApiError = { status: res.status, message: '会话已过期，请关闭并重新打开 Mini App' }
      throw err
    }
    // Wallet was unbound/deleted on another device — reset and redirect
    if (handleWalletGone(path, res.status, errMsg)) {
      const err: ApiError = { status: res.status, message: '钱包已在其他设备上解除绑定' }
      throw err
    }
    const err: ApiError = { status: res.status, message: errMsg }
    throw err
  }

  return json.data as T
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