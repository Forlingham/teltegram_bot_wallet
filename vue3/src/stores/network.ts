import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface NetworkConfig {
  bech32: string
  pubKeyHash: number
  scriptHash: number
}

interface AppEnvResponse {
  env: string
  network: NetworkConfig
  poolAddress: string
  arrFeeAddress: string
}

export const useNetworkStore = defineStore('network', () => {
  const bech32 = ref('bcrt')
  const pubKeyHash = ref(0x3c)
  const scriptHash = ref(0x7d)
  const poolAddress = ref('')
  const arrFeeAddress = ref('')
  const appEnv = ref('development')
  const loaded = ref(false)

  // In-flight request lock
  let envPromise: Promise<void> | null = null

  async function fetchEnv() {
    if (envPromise) return envPromise
    envPromise = (async () => {
      try {
        const res = await fetch('/api/app/env')
        const json = await res.json()
        if (json?.success && json.data) {
          const data = json.data as AppEnvResponse
          bech32.value = data.network.bech32
          pubKeyHash.value = data.network.pubKeyHash
          scriptHash.value = data.network.scriptHash
          poolAddress.value = data.poolAddress
          arrFeeAddress.value = data.arrFeeAddress
          appEnv.value = data.env || 'development'
          loaded.value = true
        }
      } catch (e) {
        console.error('Failed to fetch app env:', e)
      } finally {
        envPromise = null
      }
    })()
    return envPromise
  }

  function init(config: {
    bech32?: string
    pubKeyHash?: number
    scriptHash?: number
    poolAddress?: string
    arrFeeAddress?: string
    appEnv?: string
  }) {
    if (config.bech32) bech32.value = config.bech32
    if (config.pubKeyHash !== undefined) pubKeyHash.value = config.pubKeyHash
    if (config.scriptHash !== undefined) scriptHash.value = config.scriptHash
    if (config.poolAddress) poolAddress.value = config.poolAddress
    if (config.arrFeeAddress) arrFeeAddress.value = config.arrFeeAddress
    if (config.appEnv) appEnv.value = config.appEnv
  }

  return {
    bech32,
    pubKeyHash,
    scriptHash,
    poolAddress,
    arrFeeAddress,
    appEnv,
    loaded,
    fetchEnv,
    init,
  }
}, {
  persist: {
    pick: ['bech32', 'pubKeyHash', 'scriptHash', 'poolAddress', 'arrFeeAddress', 'appEnv'],
  },
})