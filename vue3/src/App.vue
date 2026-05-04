<script setup lang="ts">
import { computed, ref } from 'vue'
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
const { setupBackButton, hideBackButton, showAlert, close: closeApp } = useTelegram()

const isClaimLayout = computed(() => route.meta.layout === 'claim')
const showBottomNav = computed(() => !!route.meta.activeNav)
const showSettings = computed(() => route.meta.activeNav === 'home')
const pageTitle = computed(() => (route.meta.title as string) || 'SCASH 钱包')

// Fatal error modal (replaces Telegram showAlert for session errors)
const showFatalModal = ref(false)
const fatalModalTitle = ref('')
const fatalModalMessage = ref('')

function openFatalModal(title: string, message: string) {
  fatalModalTitle.value = title
  fatalModalMessage.value = message
  showFatalModal.value = true
}

function handleBgError(e: any) {
  const msg = e?.message || ''
  // Only alert for fatal errors that auto-refresh cannot fix.
  if (msg.includes('重新打开') || msg.includes('无法获取 Telegram')) {
    openFatalModal('登录状态已过期', '你的登录状态已过期，请重新打开 SCASH 钱包后继续使用。')
  }
}

// Non-blocking init: let Vue render immediately with persisted data,
// then refresh in background.
onMounted(() => {
  networkStore.fetchEnv().catch(() => {})

  // Restore session & user info in background (non-blocking)
  authStore.ensureSession().catch(handleBgError)
  authStore.handleUserSwitch().catch(() => {})

  // Claim layout: skip wallet init to speed up entry
  if (!isClaimLayout.value) {
    // Fetch wallet home in background. If persisted data exists, render it immediately
    // and silently refresh from server; otherwise fetch from server first.
    // Always call fetchHome() to sync with server — the user may have created a wallet
    // on another device, or migrated from the old EJS version.
    walletStore.fetchHome()
      .then(() => {
        if (walletStore.hasWallet) {
          walletStore.fetchBalance().catch(handleBgError)
          priceStore.fetchPrice().catch(() => {})
        }
      })
      .catch(handleBgError)

    // Always refresh user info in background —
    // if the account just switched, photoUrl/username were reset to null
    // and we must fetch the new user's data.
    authStore.fetchMe().catch(handleBgError)

    // Permission check in background (non-blocking)
    checkRoutePermission()
  }

  // Claim page: back button closes the app
  if (route.meta.backAsClose) {
    setupBackButton(() => closeApp())
  }
  // Top-level pages (with bottom nav): hide back button
  else if (route.meta.activeNav) {
    hideBackButton()
  }
  // All other pages: normal back navigation
  else {
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
    setupBackButton(() => closeApp())
  } else if (route.meta.activeNav) {
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

  <!-- Fatal error modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showFatalModal"
        class="fixed inset-0 z-[400] flex items-center justify-center p-6"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div class="relative bg-surface-container-lowest rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
          <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span class="material-symbols-outlined text-primary text-2xl">error</span>
          </div>
          <h3 class="font-headline text-lg font-bold text-on-surface mb-2">{{ fatalModalTitle }}</h3>
          <p class="text-sm text-on-surface-variant leading-relaxed mb-6">{{ fatalModalMessage }}</p>
          <button
            class="w-full h-12 primary-gradient text-white rounded-full font-bold active:scale-[0.98] transition-transform"
            @click="closeApp()"
          >
            我知道了
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
