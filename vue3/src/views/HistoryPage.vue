<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue'
import { useWalletStore, useHistoryStore } from '@/stores'
import { useNetworkStore } from '@/stores/network'

const walletStore = useWalletStore()
const historyStore = useHistoryStore()

const hasWallet = computed(() => walletStore.hasWallet)

const sentinelRef = ref<HTMLDivElement | null>(null)
let observer: IntersectionObserver | null = null

function formatTime(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatTxid(txid: string): string {
  if (!txid) return '-'
  if (txid.length <= 20) return txid
  return txid.slice(0, 6) + '...' + txid.slice(-6)
}

function trimTrailingZeros(value: string): string {
  if (!value.includes('.')) return value
  return value.replace(/\.?0+$/, '') || '0'
}

function formatAmount(num: number | string): string {
  const s = String(num).trim()
  if (!s || s === 'null' || s === 'undefined') return '0'
  const n = Number(s)
  if (isNaN(n)) return '0'
  return trimTrailingZeros(s)
}

function getExplorerBaseUrl(): string {
  const store = useNetworkStore()
  return store.appEnv === 'production' ? 'https://explorer.scash.network' : 'http://38.76.197.97:3001'
}

function getTxExplorerUrl(txid: string): string {
  return getExplorerBaseUrl().replace(/\/$/, '') + '/tx/' + encodeURIComponent(txid)
}

onMounted(() => {
  historyStore.fetchHistory()

  nextTick(() => {
    if (sentinelRef.value) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && historyStore.hasMore && !historyStore.loadingMore) {
            historyStore.loadMore()
          }
        },
        { rootMargin: '100px' },
      )
      observer.observe(sentinelRef.value)
    }
  })
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})

function shareLink(url: string) {
  const shareText = '我发了一个SCASH红包，快来领取！'
  const shareIntent = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`
  const tg = (window as any).Telegram?.WebApp
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(shareIntent)
  } else {
    window.location.href = shareIntent
  }
}

function formatAmountTitle(num: number | string): string {
  const str = formatAmount(num)
  const parts = str.split('.')
  if (parts.length === 2) {
    return `${parts[0]}<span class="text-xs font-bold">.${parts[1]}</span>`
  }
  return str
}

const coinLogo = '<img src="/img/logo-128x128.png" class="inline-block w-4 h-4 object-contain align-middle mb-0.5" alt="SCASH" />'
</script>

<template>
  <div class="px-4 pb-6">
    <!-- Loading state: only show full-screen spinner when no cached data -->
    <div v-if="historyStore.loading && historyStore.transactions.length === 0" class="text-center py-8 text-on-surface-variant text-sm">加载中…</div>

    <!-- Empty -->
    <div v-else-if="historyStore.transactions.length === 0" class="text-center py-8 text-on-surface-variant text-sm">
      {{ hasWallet ? '暂无交易记录' : '暂无记录（未创建钱包时仅展示抢到的红包）' }}
    </div>

    <!-- Transaction List -->
    <div v-else class="space-y-2">
      <!-- Top-right refresh indicator when loading with cached data -->
      <div v-if="historyStore.loading" class="flex justify-end">
        <span class="material-symbols-outlined text-primary text-lg animate-spin">refresh</span>
      </div>

      <template v-for="tx in historyStore.transactions" :key="tx.txid">
        <!-- Red packet CREATE -->
        <section
          v-if="tx.kind === 'redpacket' && tx.redpacketType === 'CREATE' && tx.redpacketInfo"
          class="bg-surface-container-lowest rounded-lg px-4 py-3 shadow-[0px_4px_12px_rgba(44,47,49,0.04)] relative overflow-hidden group"
        >
          <div class="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
          <div class="flex justify-between items-center mb-2">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1;">outbox</span>
              </div>
              <div>
                <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">发出的红包</p>
                <h3 class="text-on-surface font-headline text-base font-bold" v-html="formatAmountTitle(tx.amount) + ' <span class=\'text-[10px] font-normal text-on-surface-variant ml-0.5\'>' + coinLogo + '</span>'"></h3>
              </div>
            </div>
            <span
              :class="{
                'bg-primary/10 text-primary': tx.redpacketInfo.status === 'ACTIVE',
                'bg-tertiary/10 text-tertiary': tx.redpacketInfo.status === 'COMPLETED',
                'bg-error/10 text-error': ['EXPIRED', 'REFUNDED'].includes(tx.redpacketInfo.status || ''),
              }"
              class="px-2 py-0.5 text-[10px] font-extrabold rounded-full"
            >
              {{ tx.redpacketInfo.status === 'ACTIVE' ? '进行中' : tx.redpacketInfo.status === 'COMPLETED' ? '已抢完' : ['EXPIRED', 'REFUNDED'].includes(tx.redpacketInfo.status || '') ? '已过期' : '已结束' }}
            </span>
          </div>

          <!-- Progress -->
          <div class="mb-2 bg-surface-container-low rounded px-3 py-2 text-[11px]">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-on-surface-variant">领取进度</span>
              <span class="font-bold text-primary">{{ tx.redpacketInfo.claimedCount || 0 }}/{{ tx.redpacketInfo.totalCount || 0 }} · {{ (tx.redpacketInfo.totalCount || 0) > 0 ? Math.round(((tx.redpacketInfo.claimedCount || 0) / tx.redpacketInfo.totalCount!) * 100) : 0 }}%</span>
            </div>
            <div class="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <div class="h-full bg-primary rounded-full transition-all duration-500" :style="{ width: ((tx.redpacketInfo.totalCount || 0) > 0 ? Math.round(((tx.redpacketInfo.claimedCount || 0) / tx.redpacketInfo.totalCount!) * 100) : 0) + '%' }"></div>
            </div>
            <div class="flex items-center justify-between mt-1.5">
              <span class="text-on-surface-variant">剩余</span>
              <span class="font-bold text-on-surface">{{ formatAmount(tx.redpacketInfo.remainingAmount || 0) }} <span v-html="coinLogo"></span></span>
            </div>
          </div>

          <!-- Refund notice -->
          <div v-if="['EXPIRED', 'REFUNDED'].includes(tx.redpacketInfo.status || '')" class="bg-error/5 border border-error/15 rounded px-3 py-1.5 mb-2 flex items-center gap-2 text-[11px]">
            <span class="material-symbols-outlined text-error text-sm" style="font-variation-settings: 'FILL' 1;">assignment_return</span>
            <span class="text-error font-bold">已退回 {{ formatAmount(tx.redpacketInfo.remainingAmount || 0) }} <span v-html="coinLogo"></span></span>
          </div>

          <div class="flex items-center justify-between text-[10px] text-on-surface-variant pt-2 border-t border-surface-container">
            <a v-if="tx.txid && !tx.txid.startsWith('claim-')" class="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded" :href="getTxExplorerUrl(tx.txid)" target="_blank" rel="noopener noreferrer">{{ formatTxid(tx.txid) }}</a>
            <span v-else class="font-mono">{{ formatTxid(tx.txid || '') }}</span>
            <span>{{ formatTime(tx.time) }}</span>
          </div>

          <div v-if="tx.redpacketInfo.canShare && tx.redpacketInfo.shareUrl" class="mt-2 flex justify-end">
            <button class="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full" @click="shareLink(tx.redpacketInfo!.shareUrl!)">再次分享</button>
          </div>
        </section>

        <!-- Red packet REFUND -->
        <section
          v-else-if="tx.kind === 'redpacket' && tx.redpacketType === 'REFUND'"
          class="bg-surface-container-lowest rounded-lg px-4 py-3 shadow-[0px_4px_12px_rgba(44,47,49,0.04)] relative overflow-hidden"
        >
          <div class="absolute top-0 right-0 w-16 h-16 bg-error/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
          <div class="flex justify-between items-center mb-2">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 bg-error/10 rounded-full flex items-center justify-center">
                <span class="material-symbols-outlined text-error text-base" style="font-variation-settings: 'FILL' 1;">assignment_return</span>
              </div>
              <div>
                <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">退回红包</p>
                <h3 class="text-error font-headline text-base font-bold"><span>+</span><span v-html="formatAmountTitle(tx.amount)"></span> <span class="text-[10px] font-normal text-on-surface-variant ml-0.5" v-html="coinLogo"></span></h3>
              </div>
            </div>
            <span class="px-2 py-0.5 bg-error/10 text-error text-[10px] font-extrabold rounded-full">已退款</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-on-surface-variant pt-2 border-t border-surface-container">
            <a v-if="tx.txid" class="font-mono text-error bg-error/5 px-1.5 py-0.5 rounded" :href="getTxExplorerUrl(tx.txid)" target="_blank" rel="noopener noreferrer">{{ formatTxid(tx.txid) }}</a>
            <span v-else>-</span>
            <span>{{ formatTime(tx.time) }}</span>
          </div>
        </section>

        <!-- Red packet CLAIM -->
        <section
          v-else-if="tx.kind === 'redpacket' && tx.redpacketType === 'CLAIM'"
          class="bg-surface-container-lowest rounded-lg px-4 py-3 shadow-[0px_4px_12px_rgba(44,47,49,0.04)] relative overflow-hidden"
        >
          <div class="flex justify-between items-center mb-2">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 bg-tertiary/10 rounded-full flex items-center justify-center">
                <span class="material-symbols-outlined text-tertiary text-base" style="font-variation-settings: 'FILL' 1;">task_alt</span>
              </div>
              <div>
                <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">收到的红包</p>
                <h3 class="text-tertiary font-headline text-base font-bold"><span>+</span><span v-html="formatAmountTitle(tx.amount)"></span> <span class="text-[10px] font-normal text-on-surface-variant ml-0.5" v-html="coinLogo"></span></h3>
              </div>
            </div>
            <span class="px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-extrabold rounded-full">已领取</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-on-surface-variant pt-2 border-t border-surface-container">
            <a v-if="tx.txid && !tx.txid.startsWith('claim-')" class="font-mono text-tertiary bg-tertiary/5 px-1.5 py-0.5 rounded" :href="getTxExplorerUrl(tx.txid)" target="_blank" rel="noopener noreferrer">{{ formatTxid(tx.txid) }}</a>
            <span v-else class="font-mono">{{ formatTxid(tx.txid || '') }}</span>
            <span>{{ formatTime(tx.time) }}</span>
          </div>
        </section>

        <!-- Regular transfer -->
        <section
          v-else
          class="bg-surface-container-lowest rounded-lg px-4 py-3 shadow-[0px_4px_12px_rgba(44,47,49,0.04)] relative overflow-hidden"
        >
          <div class="flex justify-between items-center mb-2">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full flex items-center justify-center" :class="tx.direction === 'in' ? 'bg-tertiary/10' : 'bg-error/10'">
                <span class="material-symbols-outlined text-base" :class="tx.direction === 'in' ? 'text-tertiary' : 'text-error'" style="font-variation-settings: 'FILL' 1;">{{ tx.direction === 'in' ? 'call_received' : 'call_made' }}</span>
              </div>
              <div>
                <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">链上转账</p>
                <h3 :class="tx.direction === 'in' ? 'text-tertiary' : 'text-error'" class="font-headline text-base font-bold">
                  <span>{{ tx.direction === 'in' ? '+' : '-' }}</span><span v-html="formatAmountTitle(tx.amount)"></span>
                  <span class="text-[10px] font-normal text-on-surface-variant ml-0.5" v-html="coinLogo"></span>
                </h3>
              </div>
            </div>
            <span class="px-2 py-0.5 bg-surface-container-low text-on-surface-variant text-[10px] font-extrabold rounded-full">
              {{ tx.direction === 'in' ? '转入' : '转出' }}
            </span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-on-surface-variant pt-2 border-t border-surface-container">
            <a v-if="tx.txid" class="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded" :href="getTxExplorerUrl(tx.txid)" target="_blank" rel="noopener noreferrer">{{ formatTxid(tx.txid) }}</a>
            <span v-else>-</span>
            <span>{{ formatTime(tx.time) }}</span>
          </div>
        </section>
      </template>

      <!-- Load more sentinel & indicators -->
      <div ref="sentinelRef" class="py-4 text-center">
        <div v-if="historyStore.loadingMore" class="flex items-center justify-center gap-2 text-on-surface-variant text-sm">
          <span class="material-symbols-outlined text-base animate-spin">refresh</span>
          加载更多…
        </div>
        <div v-else-if="!historyStore.hasMore && historyStore.transactions.length > 0" class="text-on-surface-variant/50 text-xs">
          — 共 {{ historyStore.total }} 条记录，已全部加载 —
        </div>
      </div>
    </div>
  </div>
</template>
