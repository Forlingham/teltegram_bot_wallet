<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'
import Card from '../components/Card.vue'
import CoinLogo from '../components/CoinLogo.vue'

const router = useRouter()
const balance = ref('1,234.56789012')
const address = ref('bcrt1qxy8kgqy8ysygqspg5gcfjryv5w6f8hn0w7d5h2')
const isWatchOnly = ref(false)

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
  navigator.clipboard.writeText(address.value)
}
</script>

<template>
  <AppLayout title="SCASH 钱包" active-nav="home" show-settings>
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
            <span class="text-4xl font-bold">{{ balance }}</span>
            <CoinLogo :size="16" />
          </h1>
        </div>
      </div>
    </Card>

    <Card padding="p-4" hoverable class="flex items-center justify-between">
      <div class="flex items-center gap-3 overflow-hidden">
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
          <Icon name="wallet" :size="18" />
        </div>
        <div class="overflow-hidden">
          <p class="text-[10px] text-on-surface-variant font-label uppercase tracking-wider mb-0.5">我的钱包地址</p>
          <p class="text-[9px] font-mono text-on-surface truncate pr-4">{{ address }}</p>
        </div>
      </div>
      <div class="flex-shrink-0 flex items-center gap-2">
        <span v-if="isWatchOnly" class="text-[10px] px-2 py-0.5 rounded-full font-bold" style="background: #f4f7f2; border: 1px dashed #c0392b; color: #c0392b;">观察钱包</span>
        <button @click="copyAddress" class="text-slate-400 hover:text-primary transition-colors">
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
          <span>1,000.00</span>
          <CoinLogo :size="16" />
        </p>
      </Card>
      <Card padding="p-4" class="border border-primary/5">
        <div class="flex items-center gap-1.5 text-primary mb-1">
          <Icon name="pending" :size="14" />
          <span class="text-[11px] font-bold uppercase tracking-tight">未确认 (内存池)</span>
        </div>
        <p class="text-sm font-bold text-primary flex items-center gap-1">
          <span>234.56789012</span>
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
          <p class="text-xs text-on-surface-variant font-medium">市场价格：<span>$0.123</span></p>
        </div>
        <div class="text-right">
          <span class="font-bold font-headline text-lg" style="color: #2f7a42;">+5.23%</span>
        </div>
      </div>
      <div class="w-full h-[180px] bg-surface-container-lowest rounded-lg border border-outline-variant/10 flex items-center justify-center text-on-surface-variant text-sm">
        图表区域
      </div>
    </Card>
  </AppLayout>
</template>