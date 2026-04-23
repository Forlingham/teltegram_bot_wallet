<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BottomNav from '@/components/BottomNav.vue'
import { useAuthStore, useWalletStore, useNetworkStore, usePriceStore } from '@/stores'
import { useTelegram } from '@/composables/useTelegram'
import { onMounted, watch } from 'vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const walletStore = useWalletStore()
const networkStore = useNetworkStore()
const priceStore = usePriceStore()
const { setupBackButton, hideBackButton, showAlert } = useTelegram()

const showBottomNav = computed(() => !!route.meta.activeNav)
const showSettings = computed(() => route.meta.activeNav === 'home')
const pageTitle = computed(() => (route.meta.title as string) || 'SCASH 钱包')

// Non-blocking init: let Vue render immediately with persisted data,
// then refresh in background.
onMounted(() => {
  networkStore.fetchEnv().catch(() => {})

  // Restore session & user info in background (non-blocking)
  authStore.ensureSession().catch(() => {})
  authStore.handleUserSwitch().catch(() => {})

  // Fetch wallet home in background. If persisted data exists, render it immediately
  // and silently refresh balance; otherwise fetch from server.
  if (!walletStore.home) {
    walletStore.fetchHome()
      .then(() => {
        walletStore.fetchBalance().catch(() => {})
        if (walletStore.hasWallet) priceStore.fetchPrice().catch(() => {})
      })
      .catch(() => {})
  } else {
    walletStore.fetchBalance().catch(() => {})
    if (walletStore.hasWallet) priceStore.fetchPrice().catch(() => {})
  }

  if (!authStore.photoUrl) {
    authStore.fetchMe().catch(() => {})
  }

  // Permission check in background (non-blocking)
  checkRoutePermission()

  if (route.meta.backAsClose) {
    hideBackButton()
  } else {
    setupBackButton(() => window.history.back())
  }
})

async function checkRoutePermission() {
  const requireFull = route.meta.requireFullWallet as boolean | undefined
  const requireAny = route.meta.requireAnyWallet as boolean | undefined
  if (!requireFull && !requireAny) return

  const permitted = await walletStore.checkPermission(requireFull, requireAny)
  if (!permitted) {
    if (requireFull && walletStore.isWatchOnly) {
      await showAlert('观察钱包仅支持接收，无法进行发送或签名操作')
    } else {
      await showAlert('该操作需要先创建钱包')
    }
    router.push('/wallet')
  }
}

watch(() => route.path, () => {
  if (route.meta.backAsClose) {
    hideBackButton()
  } else {
    setupBackButton(() => window.history.back())
  }
})
</script>

<template>
  <div class="min-h-screen bg-surface text-on-surface flex flex-col">
    <AppHeader :title="pageTitle" :show-settings="showSettings" />
    <main class="flex-1 px-4 py-4 space-y-6 max-w-lg mx-auto w-full" :class="{ 'pb-24': showBottomNav }">
      <RouterView />
    </main>
    <BottomNav v-if="showBottomNav" :active="(route.meta.activeNav as string) || ''" />
  </div>
</template>
