import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api'

export interface UtxoItem {
  txid: string
  vout: number
  amount: number
  isUnconfirmed: boolean
  address: string
  scriptPubKey: string
}

export interface WalletHome {
  hasWallet: boolean
  address: string
  isWatchOnly: boolean
  showBackupReminder: boolean
  avatarUrl: string | null
  pendingAirdrop: { amount: string; count: number } | null
}

export interface WalletBalance {
  address: string
  balance: number
  utxos: UtxoItem[]
}

export const useWalletStore = defineStore('wallet', () => {
  const home = ref<WalletHome | null>(null)
  const balance = ref<WalletBalance | null>(null)
  const loading = ref(false)

  const hasWallet = computed(() => home.value?.hasWallet ?? false)
  const isWatchOnly = computed(() => home.value?.isWatchOnly ?? false)
  const address = computed(() => home.value?.address ?? '')
  const showBackupReminder = computed(() => home.value?.showBackupReminder ?? false)

  const confirmedSats = computed(() => {
    if (!balance.value?.utxos) return 0n
    return balance.value.utxos
      .filter((u) => !u.isUnconfirmed)
      .reduce((sum, u) => sum + BigInt(Math.round(u.amount * 1e8)), 0n)
  })

  const unconfirmedSats = computed(() => {
    if (!balance.value?.utxos) return 0n
    return balance.value.utxos
      .filter((u) => u.isUnconfirmed)
      .reduce((sum, u) => sum + BigInt(Math.round(u.amount * 1e8)), 0n)
  })

  const totalSats = computed(() => confirmedSats.value + unconfirmedSats.value)

  async function fetchHome() {
    loading.value = true
    try {
      home.value = await api.get<WalletHome>('/api/wallet/home')
    } finally {
      loading.value = false
    }
  }

  async function fetchBalance() {
    loading.value = true
    try {
      balance.value = await api.get<WalletBalance>('/api/wallet/balance?includeUnconfirmed=true')
    } finally {
      loading.value = false
    }
  }

  async function completeBackup() {
    await api.post('/api/wallet/backup/complete', { backedUp: true })
    if (home.value) {
      home.value.showBackupReminder = false
    }
  }

  async function unbindWallet() {
    await api.post('/api/wallet/unbind')
    $reset()
  }

  async function checkPermission(requireFull?: boolean, requireAny?: boolean) {
    if (!requireFull && !requireAny) return true
    if (!home.value) await fetchHome()
    if (!home.value?.hasWallet) {
      return false
    }
    if (requireFull && home.value.isWatchOnly) {
      return false
    }
    return true
  }

  function $reset() {
    home.value = null
    balance.value = null
    loading.value = false
  }

  return {
    home,
    balance,
    loading,
    hasWallet,
    isWatchOnly,
    address,
    showBackupReminder,
    confirmedSats,
    unconfirmedSats,
    totalSats,
    fetchHome,
    fetchBalance,
    completeBackup,
    unbindWallet,
    checkPermission,
    $reset,
  }
})