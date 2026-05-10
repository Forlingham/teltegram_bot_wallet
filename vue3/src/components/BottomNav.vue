<script setup lang="ts">
import { computed } from 'vue'
import { useWalletStore } from '@/stores'
import { useTelegram } from '@/composables/useTelegram'
import { useI18n } from '@/i18n'

defineProps<{
  active?: string
}>()

const walletStore = useWalletStore()
const { showAlert } = useTelegram()
const { t, locale } = useI18n()

// Recompute when the locale changes so labels stay reactive.
const navItems = computed(() => {
  void locale.value
  return [
    { key: 'home', icon: 'home', label: t('nav.home'), to: '/wallet', requireWallet: false },
    { key: 'redpacket', icon: 'card_giftcard', label: t('nav.redpacket'), to: '/wallet/redpacket', requireWallet: true },
    { key: 'history', icon: 'history', label: t('nav.history'), to: '/wallet/history', requireWallet: false },
    { key: 'about', icon: 'info', label: t('nav.about'), to: '/wallet/about', requireWallet: false },
  ]
})

function handleDisabledClick() {
  showAlert(t('header.needWalletForSettings'))
}
</script>

<template>
    <nav class="fixed bottom-0 w-full z-50 rounded-t-[2.5rem] bg-slate-50/90 backdrop-blur-2xl shadow-[0px_-12px_32px_rgba(145,40,173,0.08)] flex justify-around items-center px-4 pt-4" :style="{ paddingBottom: 'max(1rem, var(--safe-area-bottom, 0px))' }">
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
