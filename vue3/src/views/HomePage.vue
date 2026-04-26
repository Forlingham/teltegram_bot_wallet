<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore, usePriceStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { useTelegram } from '@/composables/useTelegram'
import { satsToScash, satsToScashTrimmed } from '@/composables/useTransaction'
import BalanceDisplay from '@/components/BalanceDisplay.vue'
import CopyButton from '@/components/CopyButton.vue'
import PriceTag from '@/components/PriceTag.vue'
import { createChart, CrosshairMode, AreaSeries, type ISeriesApi, type IChartApi } from 'lightweight-charts'

const router = useRouter()
const walletStore = useWalletStore()
const priceStore = usePriceStore()
const authStore = useAuthStore()
const networkStore = useNetworkStore()
const { showScanQr, showAlert } = useTelegram()

const refreshing = ref(false)
const pageError = ref('')
const chartContainerRef = ref<HTMLDivElement | null>(null)
let lwChart: IChartApi | null = null
let lwSeries: ISeriesApi<'Area'> | null = null

const tooltipVisible = ref(false)
const tooltipPrice = ref('')
const tooltipTime = ref('')
const tooltipX = ref(0)
const tooltipY = ref(0)

const hasWallet = computed(() => walletStore.hasWallet)
const address = computed(() => walletStore.address)
const isWatchOnly = computed(() => walletStore.isWatchOnly)
const showBackupReminder = computed(() => walletStore.showBackupReminder)
const pendingAirdrop = computed(() => walletStore.home?.pendingAirdrop ?? null)
const userPhotoUrl = computed(() => authStore.photoUrl || '')

function dedupeChartData(data: { timestamp: string; price: string }[]) {
  const seen: Record<string, boolean> = {}
  const deduped: typeof data = []
  for (const d of data) {
    const key = d.timestamp.slice(0, 16)
    if (!seen[key]) {
      seen[key] = true
      deduped.push(d)
    }
  }
  return deduped
}

function renderChart() {
  const container = chartContainerRef.value
  if (!container) return
  const data = priceStore.chartData
  if (!data || data.length <= 1) return

  const deduped = dedupeChartData(data as { timestamp: string; price: string }[])
  if (deduped.length <= 1) return

  const firstPrice = parseFloat(deduped[0].price)
  const lastPrice = parseFloat(deduped[deduped.length - 1].price)
  const isUp = lastPrice >= firstPrice
  const lineColor = isUp ? '#2f7a42' : '#c0392b'
  const topColor = isUp ? 'rgba(47,122,66,0.28)' : 'rgba(192,57,43,0.20)'
  const bottomColor = isUp ? 'rgba(47,122,66,0.02)' : 'rgba(192,57,43,0.02)'

  if (lwChart) {
    lwChart.remove()
    lwChart = null
    lwSeries = null
  }

  lwChart = createChart(container, {
    width: container.clientWidth,
    height: 180,
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: '#999',
      fontSize: 10,
      attributionLogo: false,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: '#f0f0f0', style: 2 },
    },
    crosshair: {
      mode: CrosshairMode.Magnet,
      vertLine: { width: 1, color: 'rgba(47,122,66,0.3)', style: 0, labelVisible: false },
      horzLine: { visible: false, labelVisible: false },
    },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false,
      fixLeftEdge: true,
      fixRightEdge: true,
    },
    rightPriceScale: {
      borderVisible: false,
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    handleScroll: { vertTouchDrag: false },
    handleScale: { axisPressedMouseMove: false, pinch: false, mouseWheel: false },
  })

  lwSeries = lwChart.addSeries(AreaSeries, {
    lineColor,
    topColor,
    bottomColor,
    lineWidth: 2,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 4,
    crosshairMarkerBorderColor: '#fff',
    crosshairMarkerBackgroundColor: lineColor,
    priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
  })

  const seriesData = deduped.map((d) => ({
    time: Math.floor(new Date(d.timestamp).getTime() / 1000),
    value: parseFloat(d.price),
  }))

  lwSeries.setData(seriesData)
  lwChart.timeScale().fitContent()

  // Crosshair tooltip
  lwChart.subscribeCrosshairMove((param) => {
    if (!param || !param.time || !param.seriesData || !param.seriesData.size) {
      tooltipVisible.value = false
      return
    }
    const val = param.seriesData.get(lwSeries!)
    if (val && typeof val.value === 'number') {
      const t = new Date((param.time as number) * 1000)
      const pad = (n: number) => String(n).padStart(2, '0')
      tooltipTime.value = `${pad(t.getMonth() + 1)}/${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`
      tooltipPrice.value = '$' + val.value.toFixed(3)
      // Position tooltip near the crosshair
      const rect = container.getBoundingClientRect()
      const pointX = param.point?.x ?? rect.width / 2
      const pointY = param.point?.y ?? rect.height / 2
      tooltipX.value = Math.min(Math.max(pointX + 12, 4), rect.width - 100)
      tooltipY.value = Math.min(Math.max(pointY - 36, 4), rect.height - 40)
      tooltipVisible.value = true
    } else {
      tooltipVisible.value = false
    }
  })

  // Resize observer
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      if (lwChart && container) {
        lwChart.applyOptions({ width: container.clientWidth })
      }
    })
    ro.observe(container)
  }
}

// Watch for chart data changes and render when available
watch(() => priceStore.chartData, (val) => {
  if (val && val.length > 1) {
    nextTick(renderChart)
  }
}, { immediate: true })

async function initHome() {
  pageError.value = ''
  try {
    await walletStore.fetchHome()
    walletStore.fetchBalance()
    if (hasWallet.value) {
      await priceStore.fetchPrice()
    }
    if (!authStore.photoUrl) {
      authStore.fetchMe().catch(() => {})
    }
  } catch (e: any) {
    console.error('[HomePage] init failed:', e)
    pageError.value = e?.message || e?.status?.message || '加载失败，请重试'
  }
}

onMounted(() => {
  if (!walletStore.home) {
    initHome()
  } else if (priceStore.chartData.length > 1) {
    nextTick(renderChart)
  }
})

const handleRefresh = async () => {
  refreshing.value = true
  try {
    await walletStore.fetchBalance()
  } finally {
    refreshing.value = false
  }
}

const handleBackupDone = async () => {
  try {
    await walletStore.completeBackup()
  } catch (e: any) {
    await showAlert(e.message)
  }
}

const handleScanQr = async () => {
  if (walletStore.isWatchOnly) {
    await showAlert('当前为观察钱包，无法发送')
    return
  }
  try {
    const raw = await showScanQr('扫描收款地址二维码')
    let addr = raw.trim()

    // Handle URI schemes: scash:xxx, bcrt:xxx
    if (addr.includes(':')) {
      const parts = addr.split(':')
      addr = parts[1] || ''
    }

    // Strip query params (e.g. scash:xxx?amount=100)
    if (addr.includes('?')) {
      addr = addr.split('?')[0]
    }

    if (!addr) {
      await showAlert('未识别到有效地址')
      return
    }

    // Validate bech32 prefix
    const prefix = networkStore.bech32 || 'scash'
    if (!addr.startsWith(prefix + '1')) {
      await showAlert('地址格式不正确，请扫描 ' + prefix + ' 开头的地址')
      return
    }

    router.push({ path: '/wallet/send', query: { address: addr } })
  } catch {}
}
</script>

<template>
  <!-- Error banner -->
  <div v-if="pageError" class="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg flex items-center gap-3">
    <span class="material-symbols-outlined text-error text-sm">error</span>
    <p class="text-error text-sm flex-1">{{ pageError }}</p>
    <button class="text-error text-xs font-bold underline" @click="initHome">重试</button>
  </div>

  <!-- No wallet state -->
  <section v-if="!hasWallet" class="space-y-6">
    <!-- Pending airdrop -->
    <div v-if="pendingAirdrop" class="mb-6">
      <div class="bg-surface-container-lowest rounded-lg p-4 ambient-shadow border border-warning/20">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-warning" style="font-variation-settings: 'FILL' 1;">mail</span>
          </div>
          <div class="flex-1">
            <p class="text-xs font-bold text-warning uppercase tracking-wider mb-0.5">待入账红包</p>
            <p class="text-xl font-bold font-headline text-on-surface flex items-center gap-1">
              {{ pendingAirdrop.amount }}
              <img src="/img/logo-128x128.png" class="w-5 h-5 object-contain" alt="SCASH" />
            </p>
          </div>
          <div class="text-right">
            <p class="text-[10px] text-on-surface-variant font-medium">{{ pendingAirdrop.count }} 个红包</p>
            <p class="text-[10px] text-on-surface-variant mt-0.5">创建钱包后自动入账</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Welcome card -->
    <header class="w-full flex flex-col items-center text-center mb-8">
      <div class="mb-6 relative">
        <div class="absolute -inset-4 bg-primary-container/20 blur-3xl rounded-full"></div>
        <div class="w-20 h-20 relative z-10 bg-surface-container-low rounded-2xl flex items-center justify-center shadow-lg">
          <span class="material-symbols-outlined text-4xl text-primary" style="font-variation-settings: 'FILL' 1;">account_balance_wallet</span>
        </div>
      </div>
      <h1 class="font-headline text-2xl font-extrabold tracking-tight text-on-background mb-3">
        欢迎使用 SCASH 钱包
      </h1>
      <p class="text-on-surface-variant font-medium leading-relaxed max-w-[280px] text-sm">
        创建、导入或绑定钱包后即可开始使用
      </p>
    </header>

    <!-- Action links -->
    <div class="w-full space-y-4">
      <router-link to="/wallet/create" class="w-full group flex items-center p-5 bg-surface-container-lowest rounded-lg ambient-shadow transition-all duration-200 active:scale-[0.98] text-left border border-transparent hover:border-primary/10">
        <div class="primary-gradient w-14 h-14 rounded-full flex items-center justify-center text-on-primary mr-5 shrink-0 shadow-lg shadow-primary/20">
          <span class="material-symbols-outlined text-2xl" style="font-variation-settings: 'FILL' 1;">add_card</span>
        </div>
        <div class="flex-1">
          <h2 class="font-headline text-lg font-bold text-on-surface">创建钱包</h2>
          <p class="text-on-surface-variant text-sm font-medium">生成全新的加密资产账户</p>
        </div>
        <span class="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
      </router-link>

      <router-link to="/wallet/import" class="w-full group flex items-center p-5 bg-surface-container-lowest rounded-lg ambient-shadow transition-all duration-200 active:scale-[0.98] text-left border border-transparent hover:border-primary/10">
        <div class="bg-surface-container-high w-14 h-14 rounded-full flex items-center justify-center text-primary mr-5 shrink-0">
          <span class="material-symbols-outlined text-2xl">vpn_key</span>
        </div>
        <div class="flex-1">
          <h2 class="font-headline text-lg font-bold text-on-surface">导入钱包</h2>
          <p class="text-on-surface-variant text-sm font-medium">使用助记词或私钥恢复账户</p>
        </div>
        <span class="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
      </router-link>

      <router-link to="/wallet/bind" class="w-full group flex items-center p-5 bg-surface-container-lowest rounded-lg ambient-shadow transition-all duration-200 active:scale-[0.98] text-left border border-transparent hover:border-primary/10">
        <div class="bg-surface-container-high w-14 h-14 rounded-full flex items-center justify-center text-primary mr-5 shrink-0">
          <span class="material-symbols-outlined text-2xl">link</span>
        </div>
        <div class="flex-1">
          <h2 class="font-headline text-lg font-bold text-on-surface">绑定钱包</h2>
          <p class="text-on-surface-variant text-sm font-medium">绑定观察钱包，只能领取红包，无法发送</p>
        </div>
        <span class="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
      </router-link>
    </div>

    <footer class="w-full flex flex-col items-center mt-8 mb-4">
      <p class="text-[11px] text-on-surface-variant/60 text-center leading-relaxed">
        继续操作即表示您同意我们的<br/>
        <span class="text-primary-dim font-bold">服务协议</span> 与 <span class="text-primary-dim font-bold">隐私政策</span>
      </p>
    </footer>
  </section>

  <!-- Wallet home state -->
  <section v-else>
    <!-- Backup reminder -->
    <div v-if="showBackupReminder" class="relative overflow-hidden rounded-lg p-5 mb-4 ambient-shadow primary-gradient">
      <div class="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      <div class="relative z-10 flex items-start gap-4">
        <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-white" style="font-variation-settings: 'FILL' 1;">key</span>
        </div>
        <div class="flex-1">
          <h3 class="font-headline text-lg font-bold text-white mb-1">请尽快备份助记词</h3>
          <p class="text-white/80 text-sm leading-relaxed mb-4">你尚未完成助记词备份，请尽快备份防止资产无法恢复。</p>
          <div class="flex gap-3">
            <button @click="handleBackupDone" class="px-5 py-2.5 bg-white text-primary rounded-full font-bold text-sm shadow-lg active:scale-[0.98] transition-transform">我已备份</button>
            <router-link to="/wallet/recover" class="px-5 py-2.5 bg-white/20 backdrop-blur-md text-white rounded-full font-bold text-sm border border-white/30 active:scale-[0.98] transition-transform">去备份</router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Balance section -->
    <section class="relative overflow-hidden">
      <div class="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl"></div>
      <div class="relative z-10 space-y-1">
        <div class="flex justify-between items-start">
          <div class="flex items-center gap-2">
            <img
              v-if="userPhotoUrl"
              :src="userPhotoUrl"
              alt="avatar"
              class="w-7 h-7 rounded-full object-cover border border-outline-variant/30 shadow-sm"
            />
            <p class="text-on-surface-variant text-sm font-medium">总余额</p>
          </div>
          <button
            id="btnRefresh"
            class="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-primary active:scale-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="refreshing"
            @click="handleRefresh"
          >
            <span class="material-symbols-outlined text-lg block" :class="{ 'animate-spin-fast': refreshing }">refresh</span>
          </button>
        </div>
        <BalanceDisplay :sats="walletStore.totalSats" :show-fiat="true" :price-usd="priceStore.currentPrice" />
        <PriceTag v-if="priceStore.currentPrice > 0" :price="priceStore.currentPrice" :change-24h="priceStore.change24h" />
      </div>
    </section>

    <!-- Wallet address -->
    <section class="bg-surface-container-lowest rounded-lg p-4 shadow-sm flex items-center justify-between group cursor-pointer hover:bg-surface-container-low transition-colors duration-200 mt-4">
      <div class="flex items-center gap-3 overflow-hidden">
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
          <span class="material-symbols-outlined text-lg">wallet</span>
        </div>
        <div class="overflow-hidden">
          <p class="text-[10px] text-on-surface-variant uppercase tracking-wider mb-0.5">我的钱包地址</p>
          <p class="text-[9px] mono text-on-surface truncate pr-4">{{ address }}</p>
        </div>
      </div>
      <div class="flex-shrink-0 flex items-center gap-2">
        <span v-if="isWatchOnly" class="text-[10px] px-2 py-0.5 rounded-full font-bold" style="background: #f4f7f2; border: 1px dashed #c0392b; color: #c0392b;">观察钱包</span>
        <CopyButton :text="address" />
      </div>
    </section>

    <!-- Confirmed / Unconfirmed -->
    <section class="grid grid-cols-2 gap-4 mt-4">
      <div class="bg-surface-container-low rounded-lg p-4 flex flex-col gap-1">
        <div class="flex items-center gap-1.5 text-on-surface-variant mb-1">
          <span class="material-symbols-outlined text-sm">check_circle</span>
          <span class="text-[11px] font-bold font-headline uppercase tracking-tight">已确认 (链上)</span>
        </div>
        <p class="text-sm font-bold text-on-surface flex items-center gap-1">
          {{ walletStore.confirmedSats !== undefined ? satsToScashTrimmed(walletStore.confirmedSats) : '0' }}
          <img src="/img/logo-128x128.png" class="w-4 h-4 object-contain" alt="SCASH" />
        </p>
      </div>
      <div class="bg-surface-container-low rounded-lg p-4 flex flex-col gap-1 border border-primary/5">
        <div class="flex items-center gap-1.5 text-primary mb-1">
          <span class="material-symbols-outlined text-sm">pending</span>
          <span class="text-[11px] font-bold font-headline uppercase tracking-tight">未确认 (内存池)</span>
        </div>
        <p class="text-sm font-bold text-primary flex items-center gap-1">
          {{ walletStore.unconfirmedSats !== undefined ? satsToScashTrimmed(walletStore.unconfirmedSats) : '0' }}
          <img src="/img/logo-128x128.png" class="w-4 h-4 object-contain" alt="SCASH" />
        </p>
      </div>
    </section>

    <!-- Action buttons -->
    <nav class="grid grid-cols-4 gap-3 mt-6">
      <a class="flex flex-col items-center gap-2 group" :class="isWatchOnly ? 'cursor-pointer' : ''" @click.prevent="isWatchOnly ? showAlert('当前为观察钱包，无法发送') : $router.push('/wallet/send')">
        <div class="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300" :class="isWatchOnly ? 'bg-surface-container-high text-on-surface-variant/40' : 'bg-gradient-to-br from-primary to-primary-container text-white shadow-lg shadow-primary/20 group-active:scale-90'">
          <span class="material-symbols-outlined text-2xl">send</span>
        </div>
        <span class="text-xs font-bold" :class="isWatchOnly ? 'text-on-surface-variant/40' : 'text-on-surface'">发送</span>
      </a>
      <router-link to="/wallet/receive" class="flex flex-col items-center gap-2 group">
        <div class="w-14 h-14 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm group-active:scale-90 transition-all duration-300">
          <span class="material-symbols-outlined text-2xl">download</span>
        </div>
        <span class="text-xs font-bold text-on-surface">接收</span>
      </router-link>
      <a class="flex flex-col items-center gap-2 group" :class="isWatchOnly ? 'cursor-pointer' : ''" @click.prevent="isWatchOnly ? showAlert('当前为观察钱包，无法刻字上链') : $router.push('/wallet/inscribe')">
        <div class="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300" :class="isWatchOnly ? 'bg-surface-container-high text-on-surface-variant/40' : 'bg-surface-container-lowest text-primary shadow-sm group-active:scale-90'">
          <span class="material-symbols-outlined text-2xl">edit_note</span>
        </div>
        <span class="text-xs font-bold" :class="isWatchOnly ? 'text-on-surface-variant/40' : 'text-on-surface'">刻字上链</span>
      </a>
      <a class="flex flex-col items-center gap-2 cursor-pointer" @click.prevent="handleScanQr">
        <div class="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300" :class="isWatchOnly ? 'bg-surface-container-high text-on-surface-variant/40' : 'bg-surface-container-lowest text-primary shadow-sm group-active:scale-90'">
          <span class="material-symbols-outlined text-2xl">qr_code_scanner</span>
        </div>
        <span class="text-xs font-bold" :class="isWatchOnly ? 'text-on-surface-variant/40' : 'text-on-surface'">扫码</span>
      </a>
    </nav>

    <!-- Price chart -->
    <div v-if="priceStore.chartData.length > 1" class="mt-4">
      <div class="flex justify-between items-end mb-2">
        <div>
          <h2 class="text-base font-headline font-bold text-on-surface">SCASH 7日走势</h2>
          <p class="text-xs text-on-surface-variant font-medium">市场价格：${{ priceStore.currentPrice.toFixed(3) }}</p>
        </div>
        <div class="text-right">
          <span class="font-bold font-headline text-lg" :class="priceStore.change7d >= 0 ? 'text-green-700' : 'text-red-600'">
            {{ priceStore.change7d >= 0 ? '+' : '' }}{{ priceStore.change7d.toFixed(2) }}%
          </span>
        </div>
      </div>
      <div class="w-full relative overflow-hidden bg-surface-container-lowest rounded-lg border border-outline-variant/10">
        <div class="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none">
          <div class="w-full h-[1px] bg-outline-variant absolute top-1/4"></div>
          <div class="w-full h-[1px] bg-outline-variant absolute top-2/4"></div>
          <div class="w-full h-[1px] bg-outline-variant absolute top-3/4"></div>
        </div>
        <div ref="chartContainerRef" style="width:100%; height:180px;"></div>
        <!-- Crosshair tooltip -->
        <div
          v-show="tooltipVisible"
          class="absolute pointer-events-none z-10 bg-surface/90 backdrop-blur-sm rounded-md px-2 py-1 shadow-lg border border-outline-variant/20 text-[10px] font-semibold"
          :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
        >
          <div class="text-on-surface">{{ tooltipPrice }}</div>
          <div class="text-on-surface-variant">{{ tooltipTime }}</div>
        </div>
      </div>
    </div>
  </section>
</template>
