<script setup lang="ts">
import { onMounted } from 'vue'
import { useRedpacketStore } from '@/stores'

const redpacketStore = useRedpacketStore()

function getAvatar(item: { photoUrl?: string; displayName: string }): string {
  return item.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(item.displayName)}`
}

function formatAmount(num: number | string): string {
  const n = parseFloat(String(num))
  if (isNaN(n)) return String(num)
  return Math.round(n).toLocaleString()
}

function rankClass(rank: number): string {
  if (rank === 1) return 'absolute -top-1 -right-1 bg-yellow-400 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white'
  if (rank === 2) return 'absolute -top-1 -right-1 bg-slate-300 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white'
  if (rank === 3) return 'absolute -top-1 -right-1 bg-on-surface-variant/20 text-on-surface-variant w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold'
  return 'absolute -top-1 -right-1 bg-on-surface-variant/20 text-on-surface-variant w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold'
}

function avatarSize(rank: number): string {
  if (rank <= 2) return 'w-14 h-14'
  return 'w-12 h-12 opacity-80'
}

function rowBg(rank: number): string {
  if (rank <= 2) return 'bg-surface-container-lowest'
  return 'bg-surface-container-low/50'
}

onMounted(() => {
  redpacketStore.fetchLeaderboard()
})
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-8">
    <section class="relative group overflow-hidden rounded-lg">
      <div class="absolute -top-8 -right-8 w-32 h-32 bg-primary/10 blur-3xl rounded-full pointer-events-none"></div>
      <router-link to="/wallet/redpacket/create" class="relative w-full text-white py-6 px-8 rounded-lg flex items-center justify-between shadow-[0px_12px_32px_rgba(142,36,170,0.15)] active:scale-[0.98] transition-all duration-200 fluid-gradient-bg block">
        <div class="flex items-center gap-4">
          <div class="bg-white/20 p-3 rounded-full backdrop-blur-md">
            <span class="material-symbols-outlined text-white text-3xl" style="font-variation-settings: 'FILL' 1;">featured_seasonal_and_gifts</span>
          </div>
          <span class="text-2xl font-headline font-extrabold tracking-tight">发红包</span>
        </div>
        <span class="material-symbols-outlined text-white/80">chevron_right</span>
      </router-link>
    </section>

    <section>
      <div class="bg-surface-container-lowest rounded-lg p-5 flex items-center gap-4 shadow-[0px_12px_32px_rgba(44,47,49,0.04)] border border-outline-variant/10">
        <div class="w-12 h-12 flex-shrink-0 bg-[#FFF9C4] rounded-full flex items-center justify-center">
          <span class="material-symbols-outlined text-[#FBC02D]" style="font-variation-settings: 'FILL' 1;">confirmation_number</span>
        </div>
        <div class="flex-1">
          <p class="text-on-surface-variant text-sm font-semibold leading-snug">红包封面功能还在开发中</p>
          <p class="text-on-surface-variant/60 text-xs mt-0.5">敬请期待更多个性化定制选项</p>
        </div>
      </div>
    </section>

    <section class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-headline font-bold text-on-background">🏆 红包发送排行榜</h2>
        <div class="flex items-center gap-2">
          <span v-if="redpacketStore.loading" class="material-symbols-outlined text-primary text-lg animate-spin">refresh</span>
          <span class="text-primary text-xs font-bold uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full">实时数据</span>
        </div>
      </div>
      <div class="space-y-3">
        <div v-if="redpacketStore.loading && redpacketStore.leaderboard.length === 0" class="text-center py-8 text-on-surface-variant">加载中…</div>
        <div v-else-if="redpacketStore.leaderboard.length === 0" class="text-center py-8 text-on-surface-variant">暂无发送记录</div>
        <template v-else>
          <div
            v-for="item in redpacketStore.leaderboard"
            :key="item.rank"
            :class="rowBg(item.rank)"
            class="p-4 rounded-lg flex items-center gap-4 shadow-[0px_12px_32px_rgba(44,47,49,0.04)] relative overflow-hidden"
          >
            <div class="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full -translate-y-8 translate-x-8 pointer-events-none"></div>
            <div class="relative">
              <img :class="avatarSize(item.rank)" class="rounded-full object-cover" :src="getAvatar(item)" alt="avatar" />
              <div :class="rankClass(item.rank)">{{ item.rank }}</div>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-on-background font-bold font-headline truncate">{{ item.displayName }}</h3>
              <p class="text-on-surface-variant text-sm">发送 {{ item.totalCount }} 次</p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-primary font-headline font-extrabold text-lg">{{ formatAmount(item.totalAmount) }}</p>
              <p class="text-on-surface-variant text-[10px] font-bold uppercase tracking-tighter">SCASH</p>
            </div>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
