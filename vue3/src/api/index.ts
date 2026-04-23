import { useAuthStore } from '@/stores/auth'

const BASE_URL = ''

export interface ApiError {
  status: number
  message: string
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authStore = useAuthStore()
  const token = await authStore.ensureSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-session-token': token,
    ...(options.headers as Record<string, string> || {}),
  }

  let res = await fetch(BASE_URL + path, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    const uid = authStore.currentTgUserId
    localStorage.removeItem('SCASH_SESSION_TOKEN')
    localStorage.removeItem('SCASH_TG_USER_ID')
    if (uid) localStorage.removeItem('SCASH_TOKEN_' + uid)
    authStore.sessionToken = ''

    const newToken = await authStore.ensureSession()
    headers['x-session-token'] = newToken

    res = await fetch(BASE_URL + path, {
      ...options,
      headers,
    })
  }

  const json = await res.json()

  if (!res.ok || !json.success) {
    const errMsg = json.error?.message || '请求失败'
    if (errMsg.toLowerCase().includes('replay') || errMsg.toLowerCase().includes('expired')) {
      const err: ApiError = { status: res.status, message: '会话已过期，请关闭并重新打开 Mini App' }
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