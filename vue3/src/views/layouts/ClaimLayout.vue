<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore, useNetworkStore } from '@/stores'
import { useTelegram } from '@/composables/useTelegram'

const authStore = useAuthStore()
const networkStore = useNetworkStore()
const {
  hideBackButton,
  setHeaderColor,
  setBackgroundColor,
  setBottomBarColor,
  disableVerticalSwipes,
  enableVerticalSwipes,
  requestFullscreen,
  exitFullscreen,
  isVersionAtLeast,
  getWebApp,
  getSafeAreaInset,
  getContentSafeAreaInset,
} = useTelegram()

// Expose safe area insets as CSS custom properties for child components
const safeTop = ref(0)
const safeBottom = ref(0)
const contentSafeTop = ref(0)

function updateSafeAreaVars() {
  const sa = getSafeAreaInset()
  const csa = getContentSafeAreaInset()
  safeTop.value = sa.top
  safeBottom.value = sa.bottom
  contentSafeTop.value = csa.top
}

// Listen for safe area changes (fullscreen transitions, orientation changes)
function onSafeAreaChanged() {
  updateSafeAreaVars()
}

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

  // ---- Fullscreen immersive mode for claim page ----
  // Set dark colors to blend with the red envelope theme
  const claimBgColor = '#0f0f13'
  setHeaderColor(claimBgColor)
  setBackgroundColor(claimBgColor)
  setBottomBarColor(claimBgColor)

  // Disable vertical swipes so users can scroll the claim list
  // without accidentally closing the Mini App (Bot API 7.7+)
  disableVerticalSwipes()

  // Request fullscreen mode (Bot API 8.0+)
  if (isVersionAtLeast('8.0')) {
    requestFullscreen()

    // Listen for safe area changes
    const tg = getWebApp()
    if (tg) {
      tg.onEvent('safeAreaChanged', onSafeAreaChanged)
      tg.onEvent('contentSafeAreaChanged', onSafeAreaChanged)
      tg.onEvent('fullscreenChanged', onSafeAreaChanged)
    }
  }

  // Initialize safe area values
  updateSafeAreaVars()
})

onUnmounted(() => {
  // Restore vertical swipes when leaving claim page
  enableVerticalSwipes()

  // Exit fullscreen when navigating away
  exitFullscreen()

  // Clean up event listeners
  const tg = getWebApp()
  if (tg) {
    tg.offEvent('safeAreaChanged', onSafeAreaChanged)
    tg.offEvent('contentSafeAreaChanged', onSafeAreaChanged)
    tg.offEvent('fullscreenChanged', onSafeAreaChanged)
  }
})
</script>

<template>
  <div
    class="min-h-screen bg-surface text-on-surface flex flex-col"
    :style="{
      '--safe-area-top': safeTop + 'px',
      '--safe-area-bottom': safeBottom + 'px',
      '--content-safe-top': contentSafeTop + 'px',
      '--total-safe-top': (safeTop + contentSafeTop) + 'px',
    }"
  >
    <main class="flex-1 w-full">
      <RouterView />
    </main>
  </div>
</template>