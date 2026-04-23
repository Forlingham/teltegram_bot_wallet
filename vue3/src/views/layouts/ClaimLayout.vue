<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore, useNetworkStore } from '@/stores'
import { useTelegram } from '@/composables/useTelegram'

const authStore = useAuthStore()
const networkStore = useNetworkStore()
const { hideBackButton } = useTelegram()

onMounted(async () => {
  await networkStore.fetchEnv()

  try {
    await authStore.ensureSession()
  } catch (e) {
    console.error('Claim page auth failed:', e)
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