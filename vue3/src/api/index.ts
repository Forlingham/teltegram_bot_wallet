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

/**
 * Map HTTP / network errors to user-friendly Chinese messages.
 */
function getFriendlyErrorMessage(status: number, rawMessage: string): string {
  if (status === 0) return '网络连接失败，请检查网络后重试'
  if (status >= 500) {
    if (status === 502) return '节点服务异常，请稍后重试'
    if (status === 503) return '服务器繁忙，请稍后重试'
    if (status === 504) return '网关超时，请稍后重试'
    return '服务器内部错误，请稍后重试'
  }
  return rawMessage
}

/**
 * Translate common blockchain node (RPC) errors to Chinese.
 */
function translateNodeError(rawMessage: string): string | null {
  if (!rawMessage) return null
  const m = rawMessage.toLowerCase()

  // Mempool chain limits
  if (m.includes('too-long-mempool-chain')) {
    if (m.includes('too many descendants')) return '该笔交易的前置交易在内存池中排队过多，请稍后重试'
    if (m.includes('too many ancestors')) return '交易依赖链过长，请稍后重试'
    return '交易链过长，请稍后重试'
  }

  // Fee issues
  if (
    m.includes('insufficient fee') ||
    m.includes('mempool min fee not met') ||
    m.includes('min relay fee not met') ||
    m.includes('insufficient priority')
  ) {
    return '链上手续费不足，请提高手续费后重试'
  }

  // Double spend / input already spent
  if (m.includes('bad-txns-inputs-missingorspent')) return '交易输入已被花费，请刷新余额后重试'
  if (m.includes('txn-mempool-conflict')) return '检测到双花冲突，请刷新后重试'

  // Already known / confirmed
  if (
    m.includes('txn-already-in-mempool') ||
    m.includes('transaction already in') ||
    m.includes('already in block chain') ||
    m.includes('txn-already-known')
  ) {
    return '交易已提交，请稍后查询确认状态'
  }

  // Script / signature errors
  if (
    m.includes('non-mandatory-script-verify-flag') ||
    m.includes('mandatory-script-verify-flag')
  ) {
    return '交易签名验证失败，请检查钱包密码或数据是否完整'
  }

  // RPC connectivity / node overload
  if (m.includes('rpc')) {
    if (
      m.includes('econnrefused') ||
      m.includes('connection refused') ||
      m.includes('etimedout') ||
      m.includes('enotfound')
    ) {
      return '节点连接失败，请稍后重试'
    }
    if (m.includes('work queue depth exceeded')) return '节点繁忙，请稍后重试'
    if (m.includes('method not found')) return '节点不支持该操作'
    if (m.includes('internal error')) return '节点内部错误，请稍后重试'
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

    let json: any
    try {
      json = await res.json()
    } catch {
      const err: ApiError = { status: res.status, message: getFriendlyErrorMessage(res.status, '请求失败') }
      throw err
    }

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
    // Keep Chinese messages as-is (e.g. session expired, timeout)
    if (/[\u4e00-\u9fa5]/.test(msg)) {
      throw { status: 0, message: msg } as ApiError
    }
    // Network-level errors (TypeError: Failed to fetch, etc.)
    if (e instanceof TypeError || msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to')) {
      throw { status: 0, message: '网络连接失败，请检查网络后重试' } as ApiError
    }
    // Fallback: do not expose raw English errors to users
    throw { status: 0, message: '请求失败，请稍后重试' } as ApiError
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