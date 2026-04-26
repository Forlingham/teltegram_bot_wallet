import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

export interface RedpacketInfo {
  status?: string
  canShare?: boolean
  shareUrl?: string
  totalCount?: number
  claimedCount?: number
  totalAmount?: number | string
  remainingAmount?: number | string
  expiresAt?: string
}

export interface TxItem {
  txid: string
  direction?: 'in' | 'out'
  amount: number | string
  address?: string
  time: string
  isUnconfirmed?: boolean
  kind?: 'wallet' | 'redpacket'
  redpacketType?: 'CREATE' | 'CLAIM' | 'REFUND'
  redpacketInfo?: RedpacketInfo
}

interface HistoryResponse {
  transactions: TxItem[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export const useHistoryStore = defineStore('history', () => {
  const transactions = ref<TxItem[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const page = ref(1)
  const hasMore = ref(true)
  const total = ref(0)

  let fetchPromise: Promise<void> | null = null

  async function fetchHistory(force = false) {
    if (fetchPromise) return fetchPromise
    if (!force && transactions.value.length > 0) {
      refreshHistory()
      return
    }
    loading.value = true
    page.value = 1
    hasMore.value = true
    fetchPromise = (async () => {
      try {
        const data = await api.get<HistoryResponse>('/api/wallet/history?page=1&limit=20')
        transactions.value = data.transactions || []
        total.value = data.total || 0
        hasMore.value = data.hasMore ?? false
        page.value = 1
      } catch {
        // Keep existing cache on failure
      } finally {
        loading.value = false
        fetchPromise = null
      }
    })()
    return fetchPromise
  }

  async function loadMore() {
    if (loadingMore.value || !hasMore.value || fetchPromise) return
    loadingMore.value = true
    const nextPage = page.value + 1
    fetchPromise = (async () => {
      try {
        const data = await api.get<HistoryResponse>(`/api/wallet/history?page=${nextPage}&limit=20`)
        const newItems = data.transactions || []
        transactions.value = [...transactions.value, ...newItems]
        total.value = data.total || 0
        hasMore.value = data.hasMore ?? false
        page.value = nextPage
      } catch {
        // Silently fail
      } finally {
        loadingMore.value = false
        fetchPromise = null
      }
    })()
    return fetchPromise
  }

  async function refreshHistory() {
    if (fetchPromise) return fetchPromise
    fetchPromise = (async () => {
      try {
        const data = await api.get<HistoryResponse>('/api/wallet/history?page=1&limit=20')
        transactions.value = data.transactions || []
        total.value = data.total || 0
        hasMore.value = data.hasMore ?? false
        page.value = 1
      } catch {
        // Silently fail, keep existing cache
      } finally {
        fetchPromise = null
      }
    })()
    return fetchPromise
  }

  function $reset() {
    transactions.value = []
    loading.value = false
    loadingMore.value = false
    page.value = 1
    hasMore.value = true
    total.value = 0
  }

  return {
    transactions,
    loading,
    loadingMore,
    hasMore,
    total,
    fetchHistory,
    loadMore,
    refreshHistory,
    $reset,
  }
}, {
  persist: {
    pick: ['transactions'],
  },
})
