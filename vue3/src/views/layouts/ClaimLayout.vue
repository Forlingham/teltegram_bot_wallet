<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore, useNetworkStore } from '@/stores'
import { useTelegram } from '@/composables/useTelegram'

const authStore = useAuthStore()
const networkStore = useNetworkStore()
const { hideBackButton } = useTelegram()

onMounted(async () => {
  await networkStore.fetchEnv()

  // Attempt session login with one retry.
  // The first attempt may fail if Telegram WebApp SDK is still initializing
  // (initData not yet available). Wait briefly and try again.
  try {
    await authStore.ensureSession()
  } catch (e) {
    console.warn('Claim page auth first attempt failed, retrying...', e)
    await new Promise(r => setTimeout(r, 1000))
    try {
      await authStore.ensureSession()
    } catch (e2) {
      console.error('Claim page auth retry also failed:', e2)
    }
  }

  hideBackButton()
})
</script>

<template>
  <div class="min-h-screen bg-surface text-on-surface flex flex-col">
    <main class="flex-1 px-4 py-4 space-y-6 max-w-lg mx-auto w-full">
      <RouterView />
    </main>
  </div>
</template>