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

export const useHistoryStore = defineStore('history', () => {
  const transactions = ref<TxItem[]>([])
  const loading = ref(false)

  // In-flight request lock
  let historyPromise: Promise<void> | null = null

  async function fetchHistory(force = false) {
    if (historyPromise) return historyPromise
    if (!force && transactions.value.length > 0) {
      // Already have cached data, refresh silently in background
      refreshHistory()
      return
    }
    loading.value = true
    historyPromise = (async () => {
      try {
        const data = await api.get<{ transactions: TxItem[] }>('/api/wallet/history')
        transactions.value = data.transactions || []
      } catch {
        // Keep existing cache on failure
      } finally {
        loading.value = false
        historyPromise = null
      }
    })()
    return historyPromise
  }

  async function refreshHistory() {
    if (historyPromise) return historyPromise
    historyPromise = (async () => {
      try {
        const data = await api.get<{ transactions: TxItem[] }>('/api/wallet/history')
        transactions.value = data.transactions || []
      } catch {
        // Silently fail, keep existing cache
      } finally {
        historyPromise = null
      }
    })()
    return historyPromise
  }

  function $reset() {
    transactions.value = []
    loading.value = false
  }

  return {
    transactions,
    loading,
    fetchHistory,
    refreshHistory,
    $reset,
  }
}, {
  persist: {
    pick: ['transactions'],
  },
})
