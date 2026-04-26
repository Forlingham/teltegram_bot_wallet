<script setup lang="ts">
import { useWalletStore } from '@/stores'
import { useTelegram } from '@/composables/useTelegram'

defineProps<{
  active?: string
}>()

const walletStore = useWalletStore()
const { showAlert } = useTelegram()

const navItems = [
  { key: 'home', icon: 'home', label: '首页', to: '/wallet', requireWallet: false },
  { key: 'redpacket', icon: 'card_giftcard', label: '红包', to: '/wallet/redpacket', requireWallet: true },
  { key: 'history', icon: 'history', label: '记录', to: '/wallet/history', requireWallet: false },
  { key: 'about', icon: 'info', label: '关于', to: '/wallet/about', requireWallet: false },
]

function handleDisabledClick() {
  showAlert('请先创建或导入钱包')
}
</script>

<template>
  <nav class="fixed bottom-0 w-full z-50 rounded-t-[2.5rem] bg-slate-50/90 backdrop-blur-2xl shadow-[0px_-12px_32px_rgba(145,40,173,0.08)] flex justify-around items-center px-4 pb-[env(safe-area-inset-bottom)] pt-4">
    <template v-for="item in navItems" :key="item.key">
      <!-- Disabled: no wallet -->
      <button
        v-if="item.requireWallet && !walletStore.hasWallet"
        class="flex flex-col items-center justify-center py-2.5 px-5 text-slate-300 cursor-not-allowed"
        @click="handleDisabledClick"
      >
        <span class="material-symbols-outlined">{{ item.icon }}</span>
        <span class="font-headline font-medium text-[10px] mt-0.5">{{ item.label }}</span>
      </button>
      <!-- Normal -->
      <router-link
        v-else
        :to="item.to"
        class="flex flex-col items-center justify-center py-2.5 px-5 transition-all duration-300 ease-out active:scale-90"
        :class="active === item.key
          ? 'bg-gradient-to-br from-purple-600 to-purple-400 text-white rounded-full shadow-lg shadow-purple-500/30'
          : 'text-slate-400 hover:text-purple-500'"
      >
        <span class="material-symbols-outlined">{{ item.icon }}</span>
        <span class="font-headline font-medium text-[10px] mt-0.5">{{ item.label }}</span>
      </router-link>
    </template>
  </nav>
</template>