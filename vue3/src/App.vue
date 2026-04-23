<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BottomNav from '@/components/BottomNav.vue'
import { useAuthStore, useWalletStore, useNetworkStore } from '@/stores'
import { useTelegram } from '@/composables/useTelegram'
import { onMounted, watch } from 'vue'

const route = useRoute()
const authStore = useAuthStore()
const walletStore = useWalletStore()
const networkStore = useNetworkStore()
const { setupBackButton, hideBackButton } = useTelegram()

const showBottomNav = computed(() => route.meta.layout !== 'claim')
const showSettings = computed(() => route.meta.activeNav === 'home')
const pageTitle = computed(() => (route.meta.title as string) || 'SCASH 钱包')

onMounted(async () => {
  await networkStore.fetchEnv()

  try {
    await authStore.ensureSession()
    await authStore.handleUserSwitch()

    const requireFull = route.meta.requireFullWallet as boolean | undefined
    const requireAny = route.meta.requireAnyWallet as boolean | undefined

    if (requireFull || requireAny) {
      const permitted = await walletStore.checkPermission(requireFull, requireAny)
      if (!permitted) {
        const tg = useTelegram()
        if (requireFull && walletStore.isWatchOnly) {
          await tg.showAlert('观察钱包仅支持接收，无法进行发送或签名操作')
        } else {
          await tg.showAlert('该操作需要先创建钱包')
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

  if (route.meta.backAsClose) {
    hideBackButton()
  } else {
    setupBackButton(() => window.history.back())
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
    <AppHeader :title="pageTitle" :show-settings="showSettings" />
    <main class="flex-1 px-4 py-4 space-y-6 max-w-lg mx-auto w-full" :class="{ 'pb-24': showBottomNav }">
      <RouterView />
    </main>
    <BottomNav v-if="showBottomNav" :active="(route.meta.activeNav as string) || ''" />
  </div>
</template>