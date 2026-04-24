<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useWalletStore, useHistoryStore } from '@/stores'
import { useNetworkStore } from '@/stores/network'

const walletStore = useWalletStore()
const historyStore = useHistoryStore()

const hasWallet = computed(() => walletStore.hasWallet)

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
    return `<span class="text-xl font-bold">${parts[0]}</span><span class="text-xs font-bold">.${parts[1]}</span>`
  }
  return `<span class="text-xl font-bold">${str}</span>`
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
    <div v-else class="space-y-4">
      <!-- Top-right refresh indicator when loading with cached data -->
      <div v-if="historyStore.loading" class="flex justify-end">
        <span class="material-symbols-outlined text-primary text-lg animate-spin">refresh</span>
      </div>

      <template v-for="tx in historyStore.transactions" :key="tx.txid">
        <!-- Red packet CREATE -->
        <section
          v-if="tx.kind === 'redpacket' && tx.redpacketType === 'CREATE' && tx.redpacketInfo"
          class="bg-surface-container-lowest rounded-lg p-5 shadow-[0px_12px_32px_rgba(44,47,49,0.06)] relative overflow-hidden group"
        >
          <div class="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors"></div>
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">outbox</span>
              </div>
              <div>
                <p class="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">发出的红包</p>
                <h3 class="text-on-surface font-headline" v-html="formatAmountTitle(tx.amount) + ' <span class=\'text-xs font-normal text-on-surface-variant ml-1\'>' + coinLogo + '</span>'"></h3>
              </div>
            </div>
            <span
              :class="{
                'bg-primary/10 text-primary': tx.redpacketInfo.status === 'ACTIVE',
                'bg-tertiary/10 text-tertiary': tx.redpacketInfo.status === 'COMPLETED',
                'bg-error/10 text-error': ['EXPIRED', 'REFUNDED'].includes(tx.redpacketInfo.status || ''),
              }"
              class="px-3 py-1 text-[11px] font-extrabold rounded-full tracking-wide"
            >
              {{ tx.redpacketInfo.status === 'ACTIVE' ? '进行中' : tx.redpacketInfo.status === 'COMPLETED' ? '已抢完' : ['EXPIRED', 'REFUNDED'].includes(tx.redpacketInfo.status || '') ? '已过期' : '已结束' }}
              <span v-if="tx.isUnconfirmed" class="text-[10px] text-error ml-1">(未确认)</span>
            </span>
          </div>

          <!-- Progress -->
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="bg-surface-container-low p-3 rounded">
              <p class="text-[10px] text-on-surface-variant font-bold uppercase mb-1">领取进度</p>
              <div class="flex justify-between items-end">
                <p class="text-sm font-bold text-on-surface">{{ tx.redpacketInfo.claimedCount || 0 }} <span class="text-xs font-normal text-on-surface-variant">/ {{ tx.redpacketInfo.totalCount || 0 }} 人</span></p>
                <p class="text-[10px] font-bold text-primary">{{ (tx.redpacketInfo.totalCount || 0) > 0 ? Math.round(((tx.redpacketInfo.claimedCount || 0) / tx.redpacketInfo.totalCount!) * 100) : 0 }}%</p>
              </div>
              <div class="w-full h-1.5 bg-surface-container-high rounded-full mt-2 overflow-hidden">
                <div class="h-full bg-primary rounded-full transition-all duration-500" :style="{ width: ((tx.redpacketInfo.totalCount || 0) > 0 ? Math.round(((tx.redpacketInfo.claimedCount || 0) / tx.redpacketInfo.totalCount!) * 100) : 0) + '%' }"></div>
              </div>
            </div>
            <div class="bg-surface-container-low p-3 rounded">
              <p class="text-[10px] text-on-surface-variant font-bold uppercase mb-1">金额进度</p>
              <p class="text-sm font-bold text-on-surface">{{ formatAmount(Number(tx.redpacketInfo.totalAmount || 0) - Number(tx.redpacketInfo.remainingAmount || 0)) }} <span class="text-xs font-normal text-on-surface-variant">/ {{ formatAmount(tx.redpacketInfo.totalAmount || 0) }}</span></p>
              <p class="text-[10px] font-bold text-on-surface-variant mt-1.5">剩余: {{ formatAmount(tx.redpacketInfo.remainingAmount || 0) }} <span v-html="coinLogo"></span></p>
            </div>
          </div>

          <!-- Refund notice -->
          <div v-if="['EXPIRED', 'REFUNDED'].includes(tx.redpacketInfo.status || '')" class="bg-error/5 border border-error/20 p-3 rounded mb-4 flex items-center gap-3">
            <span class="material-symbols-outlined text-error" style="font-variation-settings: 'FILL' 1;">assignment_return</span>
            <div>
              <p class="text-[10px] text-error font-bold uppercase">已原路退回</p>
              <p class="text-sm font-bold text-on-surface">{{ formatAmount(tx.redpacketInfo.remainingAmount || 0) }} <span v-html="coinLogo"></span><span class="font-normal text-xs text-on-surface-variant">(未领取部分)</span></p>
            </div>
          </div>

          <div class="flex flex-col gap-2 border-t border-surface-container pt-3">
            <div class="flex justify-between items-center text-[11px]">
              <span class="text-on-surface-variant font-medium">交易哈希</span>
              <a v-if="tx.txid && !tx.txid.startsWith('claim-')" class="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded" :href="getTxExplorerUrl(tx.txid)" target="_blank" rel="noopener noreferrer">{{ formatTxid(tx.txid) }}</a>
              <span v-else class="font-mono text-on-surface-variant">{{ formatTxid(tx.txid || '') }}</span>
            </div>
            <div class="flex justify-between items-center text-[11px]">
              <span class="text-on-surface-variant font-medium">创建时间</span>
              <span class="text-on-surface font-semibold">{{ formatTime(tx.time) }}</span>
            </div>
            <div v-if="tx.redpacketInfo.status === 'ACTIVE' && tx.redpacketInfo.expiresAt" class="flex justify-between items-center text-[11px]">
              <span class="text-on-surface-variant font-medium">到期时间</span>
              <span class="text-on-surface font-semibold">{{ formatTime(tx.redpacketInfo.expiresAt) }}</span>
            </div>
          </div>

          <div v-if="tx.redpacketInfo.canShare && tx.redpacketInfo.shareUrl" class="mt-4 flex justify-end">
            <button class="px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-full" @click="shareLink(tx.redpacketInfo!.shareUrl!)">再次分享</button>
          </div>
        </section>

        <!-- Red packet REFUND -->
        <section
          v-else-if="tx.kind === 'redpacket' && tx.redpacketType === 'REFUND'"
          class="bg-surface-container-lowest rounded-lg p-5 shadow-[0px_12px_32px_rgba(44,47,49,0.06)] relative overflow-hidden group"
        >
          <div class="absolute top-0 right-0 w-24 h-24 bg-error/5 rounded-full -mr-12 -mt-12"></div>
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-error/10 rounded-full flex items-center justify-center">
                <span class="material-symbols-outlined text-error" style="font-variation-settings: 'FILL' 1;">assignment_return</span>
              </div>
              <div>
                <p class="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">退回红包</p>
                <h3 class="text-error font-headline"><span class="text-xl font-bold">+</span><span v-html="formatAmountTitle(tx.amount)"></span> <span class="text-xs font-normal text-on-surface-variant ml-1" v-html="coinLogo"></span></h3>
              </div>
            </div>
            <span class="px-3 py-1 bg-error/10 text-error text-[11px] font-extrabold rounded-full tracking-wide">已退款<span v-if="tx.isUnconfirmed" class="text-[10px] ml-1">(未确认)</span></span>
          </div>
          <div class="bg-error/5 border border-error/20 p-3 rounded mb-4">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-error scale-75" style="font-variation-settings: 'FILL' 1;">inbox</span>
              <p class="text-xs text-error font-bold uppercase">红包过期 · 未领取部分原路退回</p>
            </div>
          </div>
          <div class="flex flex-col gap-2 border-t border-surface-container pt-3">
            <div class="flex justify-between items-center text-[11px]">
              <span class="text-on-surface-variant font-medium">交易哈希</span>
              <a v-if="tx.txid" class="font-mono text-error bg-error/10 px-2 py-0.5 rounded" :href="getTxExplorerUrl(tx.txid)" target="_blank" rel="noopener noreferrer">{{ formatTxid(tx.txid) }}</a>
            </div>
            <div class="flex justify-between items-center text-[11px]">
              <span class="text-on-surface-variant font-medium">退回时间</span>
              <span class="text-on-surface font-semibold">{{ formatTime(tx.time) }}</span>
            </div>
          </div>
        </section>

        <!-- Red packet CLAIM -->
        <section
          v-else-if="tx.kind === 'redpacket' && tx.redpacketType === 'CLAIM'"
          class="bg-surface-container-lowest rounded-lg p-5 shadow-[0px_12px_32px_rgba(44,47,49,0.06)] relative overflow-hidden group"
        >
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-tertiary/10 rounded-full flex items-center justify-center">
                <span class="material-symbols-outlined text-tertiary" style="font-variation-settings: 'FILL' 1;">task_alt</span>
              </div>
              <div>
                <p class="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">收到的红包</p>
                <h3 class="text-tertiary font-headline"><span class="text-xl font-bold">+</span><span v-html="formatAmountTitle(tx.amount)"></span> <span class="text-xs font-normal text-on-surface-variant ml-1" v-html="coinLogo"></span></h3>
              </div>
            </div>
            <span class="px-3 py-1 bg-tertiary/10 text-tertiary text-[11px] font-extrabold rounded-full tracking-wide">已领取<span v-if="tx.isUnconfirmed" class="text-[10px] text-error ml-1">(未确认)</span></span>
          </div>
          <div class="flex flex-col gap-2 border-t border-surface-container pt-3">
            <div class="flex justify-between items-center text-[11px]">
              <span class="text-on-surface-variant font-medium">交易哈希</span>
              <a v-if="tx.txid && !tx.txid.startsWith('claim-')" class="font-mono text-tertiary bg-tertiary/10 px-2 py-0.5 rounded" :href="getTxExplorerUrl(tx.txid)" target="_blank" rel="noopener noreferrer">{{ formatTxid(tx.txid) }}</a>
              <span v-else class="font-mono text-on-surface-variant text-[11px]">{{ formatTxid(tx.txid || '') }}</span>
            </div>
            <div class="flex justify-between items-center text-[11px]">
              <span class="text-on-surface-variant font-medium">领取时间</span>
              <span class="text-on-surface font-semibold">{{ formatTime(tx.time) }}</span>
            </div>
          </div>
        </section>

        <!-- Regular transfer -->
        <section
          v-else
          class="bg-surface-container-lowest rounded-lg p-5 shadow-[0px_12px_32px_rgba(44,47,49,0.06)] relative overflow-hidden group"
        >
          <div class="flex justify-between items-start mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full flex items-center justify-center" :class="tx.direction === 'in' ? 'bg-tertiary/10' : 'bg-error/10'">
                <span class="material-symbols-outlined" :class="tx.direction === 'in' ? 'text-tertiary' : 'text-error'" style="font-variation-settings: 'FILL' 1;">{{ tx.direction === 'in' ? 'call_received' : 'call_made' }}</span>
              </div>
              <div>
                <p class="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">链上转账</p>
                <h3 :class="tx.direction === 'in' ? 'text-tertiary' : 'text-error'" class="font-headline">
                  <span class="text-xl font-bold">{{ tx.direction === 'in' ? '+' : '-' }}</span><span v-html="formatAmountTitle(tx.amount)"></span>
                  <span class="text-xs font-normal text-on-surface-variant ml-1" v-html="coinLogo"></span>
                </h3>
              </div>
            </div>
            <span class="px-3 py-1 bg-surface-container-low text-on-surface-variant text-[11px] font-extrabold rounded-full tracking-wide">
              {{ tx.direction === 'in' ? '转入' : '转出' }}
              <span v-if="tx.isUnconfirmed" class="text-[10px] text-error ml-1">(未确认)</span>
            </span>
          </div>
          <div class="flex flex-col gap-2 border-t border-surface-container pt-3">
            <div v-if="tx.txid" class="flex justify-between items-center text-[11px]">
              <span class="text-on-surface-variant font-medium">交易哈希</span>
              <a class="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded" :href="getTxExplorerUrl(tx.txid)" target="_blank" rel="noopener noreferrer">{{ formatTxid(tx.txid) }}</a>
            </div>
            <div class="flex justify-between items-center text-[11px]">
              <span class="text-on-surface-variant font-medium">时间</span>
              <span class="text-on-surface font-semibold">{{ formatTime(tx.time) }}</span>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
