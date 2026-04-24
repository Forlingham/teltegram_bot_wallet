import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

export interface LeaderboardEntry {
  rank: number
  displayName: string
  photoUrl?: string
  totalCount: number
  totalAmount: number | string
}

export const useRedpacketStore = defineStore('redpacket', () => {
  const leaderboard = ref<LeaderboardEntry[]>([])
  const loading = ref(false)

  async function fetchLeaderboard(force = false) {
    if (!force && leaderboard.value.length > 0) {
      // Already have cached data, refresh silently in background
      refreshLeaderboard()
      return
    }
    loading.value = true
    try {
      const data = await api.get<LeaderboardEntry[]>('/api/redpacket/leaderboard')
      leaderboard.value = data || []
    } catch {
      // Keep existing cache on failure
    } finally {
      loading.value = false
    }
  }

  async function refreshLeaderboard() {
    try {
      const data = await api.get<LeaderboardEntry[]>('/api/redpacket/leaderboard')
      leaderboard.value = data || []
    } catch {
      // Silently fail, keep existing cache
    }
  }

  function $reset() {
    leaderboard.value = []
    loading.value = false
  }

  return {
    leaderboard,
    loading,
    fetchLeaderboard,
    refreshLeaderboard,
    $reset,
  }
}, {
  persist: {
    pick: ['leaderboard'],
  },
})
