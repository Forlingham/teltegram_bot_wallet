<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'
import Card from '../components/Card.vue'
import CoinLogo from '../components/CoinLogo.vue'
import { useAppStore } from '../store/app'

const router = useRouter()
const appStore = useAppStore()

const hasWallet = computed(() => appStore.hasWallet)

const menuItems = [
  {
    title: '创建钱包',
    desc: '生成全新的加密资产账户',
    icon: 'add_card',
    path: '/wallet/create',
    primary: true
  },
  {
    title: '导入钱包',
    desc: '使用助记词或私钥恢复账户',
    icon: 'vpn_key',
    path: '/wallet/import',
    primary: false
  },
  {
    title: '绑定钱包',
    desc: '绑定观察钱包，只能领取红包，无法发送',
    icon: 'link',
    path: '/wallet/bind',
    primary: false
  }
]

const navItems = [
  { label: '发送', icon: 'send', path: '/wallet/send', primary: true },
  { label: '接收', icon: 'download', path: '/wallet/receive', primary: false },
  { label: '刻字上链', icon: 'edit_note', path: '/wallet/inscribe', primary: false },
  { label: '扫码', icon: 'qr_code_scanner', path: '#', primary: false }
]

const navigate = (path) => {
  if (path !== '#') router.push(path)
}

const copyAddress = () => {
  navigator.clipboard.writeText(appStore.walletAddress)
}

const goToSettings = () => {
  router.push('/wallet/settings')
}
</script>

<template>
  <AppLayout title="SCASH 钱包" :active-nav="hasWallet ? 'home' : ''" :show-settings="hasWallet">
    <template v-if="!hasWallet">
      <div v-if="appStore.pendingAirdrop" class="mb-6">
        <Card padding="p-4" class="flex items-center gap-3 border border-warning/20">
          <div class="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center shrink-0">
            <Icon name="mail" :size="24" class="text-warning" filled />
          </div>
          <div class="flex-1">
            <p class="text-xs font-bold text-warning uppercase tracking-wider mb-0.5">待入账红包</p>
            <p class="text-xl font-bold flex items-center gap-1">
              <span>{{ appStore.pendingAirdrop.amount }}</span>
              <CoinLogo :size="20" />
            </p>
          </div>
          <div class="text-right">
            <p class="text-[10px] text-on-surface-variant"><span>{{ appStore.pendingAirdrop.count }}</span> 个红包</p>
            <p class="text-[10px] text-on-surface-variant mt-0.5">创建钱包后自动入账</p>
          </div>
        </Card>
      </div>

      <header class="w-full flex flex-col items-center text-center mb-8">
        <div class="mb-6 relative">
          <div class="absolute -inset-4 bg-primary-container/20 blur-3xl rounded-full"></div>
          <div class="w-20 h-20 relative z-10 bg-surface-container-low rounded-2xl flex items-center justify-center shadow-lg">
            <Icon name="account_balance_wallet" :size="40" filled />
          </div>
        </div>
        <h1 class="font-headline text-2xl font-extrabold tracking-tight text-on-background mb-3">
          欢迎使用 SCASH 钱包
        </h1>
        <p class="text-on-surface-variant font-medium leading-relaxed max-w-[280px] text-sm">
          创建、导入或绑定钱包后即可开始使用
        </p>
      </header>

      <div class="w-full space-y-4">
        <div
          v-for="item in menuItems"
          :key="item.path"
          @click="navigate(item.path)"
          class="w-full group flex items-center p-5 bg-surface-container-lowest rounded-lg shadow-ambient transition-all duration-200 active:scale-[0.98] text-left border border-transparent hover:border-primary/10 cursor-pointer"
        >
          <div
            :class="[
              'w-14 h-14 rounded-full flex items-center justify-center mr-5 shrink-0',
              item.primary
                ? 'primary-gradient text-white shadow-lg shadow-primary/20'
                : 'bg-surface-container-high text-primary'
            ]"
          >
            <Icon :name="item.icon" :size="24" />
          </div>
          <div class="flex-1">
            <h2 class="font-headline text-lg font-bold text-on-surface">{{ item.title }}</h2>
            <p class="text-on-surface-variant text-sm font-medium">{{ item.desc }}</p>
          </div>
          <Icon name="chevron_right" class="text-on-surface-variant group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      <footer class="w-full flex flex-col items-center mt-8 mb-4">
        <p class="text-[11px] text-on-surface-variant/60 text-center leading-relaxed">
          继续操作即表示您同意我们的<br/>
          <span class="text-primary-dim font-bold">服务协议</span> 与 <span class="text-primary-dim font-bold">隐私政策</span>
        </p>
      </footer>
    </template>

    <template v-else>
      <div v-if="appStore.showBackupReminder" class="relative overflow-hidden rounded-lg p-5 mb-4 shadow-ambient primary-gradient">
        <div class="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div class="relative z-10 flex items-start gap-4">
          <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <Icon name="key" :size="24" class="text-white" filled />
          </div>
          <div class="flex-1">
            <h3 class="font-headline text-lg font-bold text-white mb-1">请尽快备份助记词</h3>
            <p class="text-white/80 text-sm leading-relaxed mb-4">你尚未完成助记词备份，请尽快备份防止资产无法恢复。</p>
            <div class="flex gap-3">
              <button class="px-5 py-2.5 bg-white text-primary rounded-full font-bold text-sm shadow-lg active:scale-[0.98] transition-transform">我已备份</button>
              <button @click="navigate('/wallet/recover')" class="px-5 py-2.5 bg-white/20 backdrop-blur-md text-white rounded-full font-bold text-sm border border-white/30 active:scale-[0.98] transition-transform">去备份</button>
            </div>
          </div>
        </div>
      </div>

      <Card padding="p-5" class="relative overflow-hidden">
        <div class="absolute -top-12 -right-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl"></div>
        <div class="relative z-10 space-y-1">
          <div class="flex justify-between items-start">
            <p class="text-on-surface-variant font-label text-sm font-medium">总余额</p>
            <button class="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-primary active:scale-90 transition-all duration-300">
              <Icon name="refresh" class="text-lg block" />
            </button>
          </div>
          <div class="flex flex-col items-start">
            <h1 class="font-headline font-extrabold tracking-tight text-on-surface flex items-baseline gap-2">
              <span class="text-4xl font-bold">0.00</span>
              <CoinLogo :size="16" />
            </h1>
          </div>
        </div>
      </Card>

      <Card padding="p-4" hoverable class="flex items-center justify-between" @click="copyAddress">
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
            <Icon name="wallet" :size="18" />
          </div>
          <div class="overflow-hidden">
            <p class="text-[10px] text-on-surface-variant font-label uppercase tracking-wider mb-0.5">我的钱包地址</p>
            <p class="text-[9px] font-mono text-on-surface truncate pr-4">{{ appStore.walletAddress || '-' }}</p>
          </div>
        </div>
        <div class="flex-shrink-0 flex items-center gap-2">
          <span v-if="appStore.isWatchOnly" class="text-[10px] px-2 py-0.5 rounded-full font-bold" style="background: #f4f7f2; border: 1px dashed #c0392b; color: #c0392b;">观察钱包</span>
          <button class="text-slate-400 hover:text-primary transition-colors">
            <Icon name="content_copy" :size="18" />
          </button>
        </div>
      </Card>

      <div class="grid grid-cols-2 gap-4">
        <Card padding="p-4">
          <div class="flex items-center gap-1.5 text-on-surface-variant mb-1">
            <Icon name="check_circle" :size="14" />
            <span class="text-[11px] font-bold uppercase tracking-tight">已确认 (链上)</span>
          </div>
          <p class="text-sm font-bold text-on-surface flex items-center gap-1">
            <span>0.00</span>
            <CoinLogo :size="16" />
          </p>
        </Card>
        <Card padding="p-4" class="border border-primary/5">
          <div class="flex items-center gap-1.5 text-primary mb-1">
            <Icon name="pending" :size="14" />
            <span class="text-[11px] font-bold uppercase tracking-tight">未确认 (内存池)</span>
          </div>
          <p class="text-sm font-bold text-primary flex items-center gap-1">
            <span>0.00</span>
            <CoinLogo :size="16" />
          </p>
        </Card>
      </div>

      <nav class="grid grid-cols-4 gap-3 mt-6">
        <div
          v-for="item in navItems"
          :key="item.label"
          @click="navigate(item.path)"
          class="flex flex-col items-center gap-2 group cursor-pointer"
        >
          <div
            :class="[
              'nav-icon-btn',
              item.primary ? 'nav-icon-btn-primary' : 'nav-icon-btn-secondary'
            ]"
          >
            <Icon :name="item.icon" :size="24" />
          </div>
          <span class="text-xs font-bold text-on-surface">{{ item.label }}</span>
        </div>
      </nav>

      <Card padding="p-5" class="mt-4">
        <div class="flex justify-between items-end mb-2">
          <div>
            <h2 class="text-base font-headline font-bold text-on-surface">SCASH 7日走势</h2>
            <p class="text-xs text-on-surface-variant font-medium">市场价格：<span>$0.000</span></p>
          </div>
          <div class="text-right">
            <span class="font-bold font-headline text-lg" style="color: #2f7a42;">+0.00%</span>
          </div>
        </div>
        <div class="w-full h-[180px] bg-surface-container-lowest rounded-lg border border-outline-variant/10 flex items-center justify-center text-on-surface-variant text-sm">
          图表区域
        </div>
      </Card>
    </template>
  </AppLayout>
</template>