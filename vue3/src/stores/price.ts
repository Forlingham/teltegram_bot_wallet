import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface PriceData {
  price: {
    price: string
    changePercent24h: string
    changePercent7d: string
  }
  priceChart: { timestamp: string; price: string }[]
}

const CACHE_KEY = 'SCASH_PRICE_CACHE'
const CACHE_TIME_KEY = 'SCASH_PRICE_CACHE_TIME'
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export const usePriceStore = defineStore('price', () => {
  const priceData = ref<PriceData | null>(null)
  const loading = ref(false)

  // In-flight request lock
  let pricePromise: Promise<void> | null = null

  const currentPrice = computed(() => {
    const p = priceData.value?.price?.price
    return p ? parseFloat(p) : 0
  })

  const change24h = computed(() => {
    const p = priceData.value?.price?.changePercent24h
    return p ? parseFloat(p) : 0
  })

  const change7d = computed(() => {
    const p = priceData.value?.price?.changePercent7d
    return p ? parseFloat(p) : 0
  })

  const chartData = computed(() => priceData.value?.priceChart ?? [])

  function loadFromCache(): PriceData | null {
    try {
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY)
      if (cachedTime && Date.now() - parseInt(cachedTime, 10) < CACHE_TTL) {
        const cachedData = localStorage.getItem(CACHE_KEY)
        if (cachedData) {
          return JSON.parse(cachedData)
        }
      }
    } catch {}
    return null
  }

  function saveToCache(data: PriceData) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
      localStorage.setItem(CACHE_TIME_KEY, Date.now().toString())
    } catch {}
  }

  async function fetchPrice(force = false) {
    // If a request is already in flight, wait for it
    if (pricePromise) return pricePromise

    // If we already have data in memory and cache is still valid, skip the request
    if (!force && priceData.value) {
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY)
      if (cachedTime && Date.now() - parseInt(cachedTime, 10) < CACHE_TTL) {
        return
      }
    }

    // Try cache first (when no memory data)
    const cached = loadFromCache()
    if (cached) {
      priceData.value = cached
      // If cache is fresh and not forced, skip network request
      if (!force) return
    }

    // Fetch fresh data
    loading.value = true
    pricePromise = (async () => {
      try {
        const res = await fetch('https://explorer.scash.network/api/explorer/home/overview')
        const json = await res.json()
        if (json && json.price) {
          priceData.value = json as PriceData
          saveToCache(json)
        }
      } catch {
        // On failure, try stale cache
        if (!priceData.value) {
          try {
            const staleData = localStorage.getItem(CACHE_KEY)
            if (staleData) {
              priceData.value = JSON.parse(staleData)
            }
          } catch {}
        }
      } finally {
        loading.value = false
        pricePromise = null
      }
    })()
    return pricePromise
  }

  function $reset() {
    priceData.value = null
    loading.value = false
  }

  return {
    priceData,
    loading,
    currentPrice,
    change24h,
    change7d,
    chartData,
    fetchPrice,
    $reset,
  }
})