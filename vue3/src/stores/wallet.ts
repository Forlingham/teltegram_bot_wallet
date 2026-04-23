import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api'
import { useAuthStore } from './auth'

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

export interface WalletBackup {
  encryptedMnemonic: string
  salt: string
  iv: string
  authTag: string
}

const BACKUP_PREFIX = 'SCASH_BACKUP_'

function getBackupKey(tgUserId: string): string {
  return BACKUP_PREFIX + tgUserId
}

function loadBackupFromStorage(tgUserId: string): WalletBackup | null {
  try {
    const raw = localStorage.getItem(getBackupKey(tgUserId))
    if (!raw) return null
    return JSON.parse(raw) as WalletBackup
  } catch {
    return null
  }
}

function saveBackupToStorage(tgUserId: string, backup: WalletBackup) {
  localStorage.setItem(getBackupKey(tgUserId), JSON.stringify(backup))
}

export const useWalletStore = defineStore('wallet', () => {
  const home = ref<WalletHome | null>(null)
  const balance = ref<WalletBalance | null>(null)
  const loading = ref(false)
  const backup = ref<WalletBackup | null>(null)

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
      // Auto-fetch backup if we have a wallet and haven't cached it yet
      if (home.value?.hasWallet && !backup.value) {
        const authStore = useAuthStore()
        const cached = loadBackupFromStorage(authStore.currentTgUserId)
        if (cached) {
          backup.value = cached
        } else {
          // No localStorage cache, fetch from server in background
          fetchBackup()
        }
      }
    } catch (e: any) {
      console.error('[wallet] fetchHome failed:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchBalance(): Promise<WalletBalance | null> {
    loading.value = true
    try {
      balance.value = await api.get<WalletBalance>('/api/wallet/balance?includeUnconfirmed=true')
      return balance.value
    } catch (e: any) {
      console.error('[wallet] fetchBalance failed:', e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function fetchBackup(): Promise<WalletBackup | null> {
    try {
      const data = await api.post<{ backup: WalletBackup | null }>('/api/wallet/recover', {})
      if (data.backup) {
        backup.value = data.backup
        const authStore = useAuthStore()
        saveBackupToStorage(authStore.currentTgUserId, data.backup)
        return data.backup
      }
      return null
    } catch {
      return null
    }
  }

  function saveBackup(b: WalletBackup) {
    backup.value = b
    const authStore = useAuthStore()
    saveBackupToStorage(authStore.currentTgUserId, b)
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
    backup.value = null
    // Do NOT clear localStorage backup cache.
    // Multiple Telegram accounts can run concurrently in separate Mini App instances,
    // each keyed by SCASH_BACKUP_<tgUserId>. Clearing here would break other sessions.
  }

  return {
    home,
    balance,
    loading,
    backup,
    hasWallet,
    isWatchOnly,
    address,
    showBackupReminder,
    confirmedSats,
    unconfirmedSats,
    totalSats,
    fetchHome,
    fetchBalance,
    fetchBackup,
    saveBackup,
    completeBackup,
    unbindWallet,
    checkPermission,
    $reset,
  }
})