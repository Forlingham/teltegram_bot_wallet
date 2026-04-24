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

// Detect account switch BEFORE dependent stores initialize.
// Pinia persistedstate restores data as soon as a store is first used.
// If the Telegram user changed, wipe ALL persisted user-specific data
// so the new account never sees the previous account's info.
const newTgId = authStore.getCurrentTgUserId()
const savedTgId = authStore.currentTgUserId
if (newTgId && savedTgId && newTgId !== savedTgId) {
  localStorage.removeItem('auth')
  localStorage.removeItem('wallet')
  localStorage.removeItem('history')
  localStorage.removeItem('redpacket')
  localStorage.removeItem('SCASH_PRICE_CACHE')
  localStorage.removeItem('SCASH_PRICE_CACHE_TIME')
  // Reset in-memory auth fields that came from the old account
  authStore.userId = null
  authStore.telegramId = ''
  authStore.username = null
  authStore.firstName = null
  authStore.lastName = null
  authStore.photoUrl = null
  authStore.sessionToken = ''
  authStore.currentTgUserId = newTgId
}

const walletStore = useWalletStore()
const networkStore = useNetworkStore()
const priceStore = usePriceStore()
const { setupBackButton, hideBackButton, showAlert } = useTelegram()

const isClaimLayout = computed(() => route.meta.layout === 'claim')
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

  // Claim layout: skip wallet init to speed up entry
  if (!isClaimLayout.value) {
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

    // Always refresh user info in background —
    // if the account just switched, photoUrl/username were reset to null
    // and we must fetch the new user's data.
    authStore.fetchMe().catch(() => {})

    // Permission check in background (non-blocking)
    checkRoutePermission()
  }

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
    <!-- Claim layout: full-screen standalone, no header/nav/main wrapper -->
    <template v-if="isClaimLayout">
      <RouterView />
    </template>

    <!-- Main layout: standard wallet app shell -->
    <template v-else>
      <AppHeader :title="pageTitle" :show-settings="showSettings" />
      <main class="flex-1 px-4 py-4 space-y-6 max-w-lg mx-auto w-full" :class="{ 'pb-24': showBottomNav }">
        <RouterView />
      </main>
      <BottomNav v-if="showBottomNav" :active="(route.meta.activeNav as string) || ''" />
    </template>
  </div>
</template>
