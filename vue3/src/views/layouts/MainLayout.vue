<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BottomNav from '@/components/BottomNav.vue'
import { useAuthStore, useWalletStore, useNetworkStore } from '@/stores'
import { useTelegram } from '@/composables/useTelegram'

const route = useRoute()
const authStore = useAuthStore()
const walletStore = useWalletStore()
const networkStore = useNetworkStore()
const { setupBackButton, hideBackButton } = useTelegram()

const showBottomNav = computed(() => route.meta.layout !== 'claim')
const activeNav = computed(() => (route.meta.activeNav as string) || '')

onMounted(async () => {
  // Initialize network config from server
  await networkStore.fetchEnv()

  // Setup Telegram back button
  if (route.meta.backAsClose) {
    hideBackButton()
  } else {
    setupBackButton(() => window.history.back())
  }

  // Auth + wallet init
  try {
    await authStore.ensureSession()
    await authStore.handleUserSwitch()

    const requireFull = route.meta.requireFullWallet as boolean | undefined
    const requireAny = route.meta.requireAnyWallet as boolean | undefined

    if (requireFull || requireAny) {
      const permitted = await walletStore.checkPermission(requireFull, requireAny)
      if (!permitted) {
        if (requireFull && walletStore.isWatchOnly) {
          alert('观察钱包仅支持接收，无法进行发送或签名操作')
        } else {
          alert('该操作需要先创建钱包')
        }
        window.location.href = '/wallet'
        return
      }
    }

    if (walletStore.hasWallet) {
      walletStore.fetchBalance()
    }
  } catch (e: any) {
    console.error('Init failed:', e)
  }
})

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
    <AppHeader :title="(route.meta.title as string) || 'SCASH 钱包'" :show-settings="activeNav === 'home'" />
    <main class="flex-1 px-4 py-4 space-y-6 max-w-lg mx-auto w-full" :class="{ 'pb-24': showBottomNav }">
      <RouterView />
    </main>
    <BottomNav v-if="showBottomNav" :active="activeNav" />
  </div>
</template>