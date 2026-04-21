import axios from 'axios'
import { useAppStore } from '../store/app'

const request = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

request.interceptors.request.use(
  (config) => {
    const appStore = useAppStore()
    if (appStore.sessionToken) {
      config.headers['x-session-token'] = appStore.sessionToken
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

request.interceptors.response.use(
  (response) => {
    const appStore = useAppStore()
    appStore.setLoading(false)

    const res = response.data
    if (res.success) {
      return res.data
    }
    return Promise.reject(new Error(res.error?.message || '请求失败'))
  },
  async (error) => {
    const appStore = useAppStore()
    appStore.setLoading(false)

    if (error.response?.status === 401) {
      appStore.setSessionToken('')
      return Promise.reject(new Error('会话已过期，请重新打开'))
    }

    return Promise.reject(error)
  }
)

export const get = (url, params = {}) => {
  return request.get(url, { params })
}

export const post = (url, data = {}) => {
  return request.post(url, data)
}

export default request