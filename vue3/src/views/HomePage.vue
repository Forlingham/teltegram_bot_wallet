<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useWalletStore, usePriceStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useTelegram } from '@/composables/useTelegram'
import BalanceDisplay from '@/components/BalanceDisplay.vue'
import CopyButton from '@/components/CopyButton.vue'
import PriceTag from '@/components/PriceTag.vue'

const walletStore = useWalletStore()
const priceStore = usePriceStore()
const authStore = useAuthStore()
const { showScanQr, showAlert } = useTelegram()

const refreshing = ref(false)
const pageLoading = ref(true)
const pageError = ref('')

const hasWallet = computed(() => walletStore.hasWallet)
const address = computed(() => walletStore.address)
const isWatchOnly = computed(() => walletStore.isWatchOnly)
const showBackupReminder = computed(() => walletStore.showBackupReminder)
const pendingAirdrop = computed(() => walletStore.home?.pendingAirdrop ?? null)
const userPhotoUrl = computed(() => authStore.photoUrl || '')

async function initHome() {
  pageLoading.value = true
  pageError.value = ''
  try {
    await walletStore.fetchHome()
    walletStore.fetchBalance()
    if (hasWallet.value) {
      priceStore.fetchPrice()
    }
    if (!authStore.photoUrl) {
      authStore.fetchMe().catch(() => {})
    }
  } catch (e: any) {
    console.error('[HomePage] init failed:', e)
    pageError.value = e?.message || e?.status?.message || '加载失败，请重试'
  } finally {
    pageLoading.value = false
  }
}

onMounted(initHome)

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
  try {
    const raw = await showScanQr('扫描收款地址二维码')
    let address = raw
    if (address.startsWith('scash:')) {
      address = address.slice(6)
    }
    const prefix = walletStore.home ? 'bcrt' : 'bcrt'
    if (address.startsWith(prefix + '1')) {
      window.location.href = '/wallet/send?address=' + encodeURIComponent(address)
    } else {
      await showAlert('不支持的地址格式')
    }
  } catch {}
}
</script>

<template>
  <!-- Loading -->
  <section v-if="pageLoading" class="flex flex-col items-center justify-center py-20 space-y-4">
    <div class="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    <p class="text-on-surface-variant text-sm font-medium">正在加载钱包信息…</p>
  </section>

  <!-- Error -->
  <section v-else-if="pageError" class="flex flex-col items-center justify-center py-16 space-y-4 px-4">
    <div class="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center">
      <span class="material-symbols-outlined text-3xl text-error" style="font-variation-settings: 'FILL' 1;">error</span>
    </div>
    <h1 class="font-headline text-lg font-bold text-on-surface">加载失败</h1>
    <p class="text-on-surface-variant text-sm text-center max-w-[280px]">{{ pageError }}</p>
    <button
      class="mt-2 px-6 py-2.5 bg-primary text-white rounded-full font-bold text-sm shadow-lg active:scale-[0.98] transition-transform"
      @click="initHome"
    >
      重新加载
    </button>
  </section>

  <!-- No wallet state -->
  <section v-else-if="!hasWallet" class="space-y-6">
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
          {{ walletStore.confirmedSats !== undefined ? (walletStore.confirmedSats / 100000000n).toString() : '0.00' }}
          <img src="/img/logo-128x128.png" class="w-4 h-4 object-contain" alt="SCASH" />
        </p>
      </div>
      <div class="bg-surface-container-low rounded-lg p-4 flex flex-col gap-1 border border-primary/5">
        <div class="flex items-center gap-1.5 text-primary mb-1">
          <span class="material-symbols-outlined text-sm">pending</span>
          <span class="text-[11px] font-bold font-headline uppercase tracking-tight">未确认 (内存池)</span>
        </div>
        <p class="text-sm font-bold text-primary flex items-center gap-1">
          {{ walletStore.unconfirmedSats !== undefined ? (walletStore.unconfirmedSats / 100000000n).toString() : '0.00' }}
          <img src="/img/logo-128x128.png" class="w-4 h-4 object-contain" alt="SCASH" />
        </p>
      </div>
    </section>

    <!-- Action buttons -->
    <nav class="grid grid-cols-4 gap-3 mt-6">
      <router-link to="/wallet/send" class="flex flex-col items-center gap-2 group">
        <div class="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white shadow-lg shadow-primary/20 group-active:scale-90 transition-all duration-300">
          <span class="material-symbols-outlined text-2xl">send</span>
        </div>
        <span class="text-xs font-bold text-on-surface">发送</span>
      </router-link>
      <router-link to="/wallet/receive" class="flex flex-col items-center gap-2 group">
        <div class="w-14 h-14 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm group-active:scale-90 transition-all duration-300">
          <span class="material-symbols-outlined text-2xl">download</span>
        </div>
        <span class="text-xs font-bold text-on-surface">接收</span>
      </router-link>
      <router-link to="/wallet/inscribe" class="flex flex-col items-center gap-2 group">
        <div class="w-14 h-14 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm group-active:scale-90 transition-all duration-300">
          <span class="material-symbols-outlined text-2xl">edit_note</span>
        </div>
        <span class="text-xs font-bold text-on-surface">刻字上链</span>
      </router-link>
      <a class="flex flex-col items-center gap-2 group cursor-pointer" @click.prevent="handleScanQr">
        <div class="w-14 h-14 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm group-active:scale-90 transition-all duration-300">
          <span class="material-symbols-outlined text-2xl">qr_code_scanner</span>
        </div>
        <span class="text-xs font-bold text-on-surface">扫码</span>
      </a>
    </nav>

    <!-- Price chart placeholder -->
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
      <div id="priceChartContainer" style="width:100%; height:180px;" class="w-full relative overflow-hidden bg-surface-container-lowest rounded-lg border border-outline-variant/10"></div>
    </div>
  </section>
</template>
