<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BottomNav from '@/components/BottomNav.vue'
import { useAuthStore, useWalletStore, useNetworkStore, usePriceStore } from '@/stores'
import { useTelegram } from '@/composables/useTelegram'
import { useI18n } from '@/i18n'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t, locale } = useI18n()

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
const { setupBackButton, hideBackButton, showAlert, close: closeApp,
  setHeaderColor, setBackgroundColor, setBottomBarColor,
  disableVerticalSwipes,
  isMobilePlatform, requestFullscreen, getWebApp,
  getSafeAreaInset, getContentSafeAreaInset,
} = useTelegram()

const isClaimLayout = computed(() => route.meta.layout === 'claim')
const showBottomNav = computed(() => !!route.meta.activeNav)
const showSettings = computed(() => route.meta.activeNav === 'home')
const pageTitle = computed(() => {
  const key = (route.meta.titleKey as string | undefined) || 'route.home'
  // Depend on locale so the title reacts to language changes.
  void locale.value
  return t(key)
})

// Keep document.title in sync when the locale changes too (router.beforeEach
// only fires on navigation, not on language switch).
watch([locale, () => route.meta.titleKey], () => {
  document.title = pageTitle.value
})

// Whether fullscreen mode is active (mobile only)
const isAppFullscreen = ref(false)

// Safe area CSS variables for fullscreen mode
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

function onSafeAreaChanged() {
  updateSafeAreaVars()
}

// Fatal error modal (replaces Telegram showAlert for session errors)
const showFatalModal = ref(false)
const fatalModalTitle = ref('')
const fatalModalMessage = ref('')

// Background auth retry state
let bgAuthRetryCount = 0
const MAX_BG_AUTH_RETRIES = 2

function openFatalModal(title: string, message: string) {
  fatalModalTitle.value = title
  fatalModalMessage.value = message
  showFatalModal.value = true
}

async function handleBgError(e: any) {
  const msg = e?.message || ''
  // Only alert for fatal errors that auto-refresh cannot fix.
  if (msg.includes('重新打开') || msg.includes('无法获取 Telegram')) {
    bgAuthRetryCount++

    // On the first failure, silently retry once after a short delay —
    // Telegram WebApp SDK may still be initializing (slow load).
    if (bgAuthRetryCount <= MAX_BG_AUTH_RETRIES) {
      await new Promise(r => setTimeout(r, 1500))
      try {
        await authStore.ensureSession()
        // Success — reset counter
        bgAuthRetryCount = 0
        return
      } catch {
        // Still failing — fall through to show modal if retries exhausted
        if (bgAuthRetryCount < MAX_BG_AUTH_RETRIES) return
      }
    }

    openFatalModal(t('fatal.sessionExpiredTitle'), t('fatal.sessionExpiredBody'))
  }
}

// Non-blocking init: let Vue render immediately with persisted data,
// then refresh in background.
onMounted(() => {
  networkStore.fetchEnv().catch(() => {})

  // Restore session & user info in background (non-blocking)
  authStore.ensureSession().catch(handleBgError)
  authStore.handleUserSwitch().catch(() => {})

  // Main layout init is handled here; claim layout init is deferred
  // to the route watcher below (route may not be resolved yet at mount time).
  if (!isClaimLayout.value) {
    walletStore.fetchHome()
      .then(() => {
        if (walletStore.hasWallet) {
          walletStore.fetchBalance().catch(handleBgError)
          priceStore.fetchPrice().catch(() => {})
        }
      })
      .catch(handleBgError)

    authStore.fetchMe().catch(handleBgError)
    checkRoutePermission()
  }

  // Back button setup
  if (route.meta.backAsClose) {
    setupBackButton(() => closeApp())
  } else if (route.meta.activeNav) {
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
      await showAlert(t('permission.watchOnlyOnly'))
    } else {
      await showAlert(t('permission.needWallet'))
    }
    router.push('/wallet')
  }
}

// ---- Global fullscreen setup (mobile only) ----
let fullscreenSetupDone = false

function setupFullscreen() {
  if (fullscreenSetupDone) return
  fullscreenSetupDone = true

  const tg = getWebApp()
  const mobile = isMobilePlatform()
  console.log('[SCASH] Platform:', tg?.platform, 'version:', tg?.version, 'isMobile:', mobile)

  if (!mobile) {
    console.log('[SCASH] Desktop platform detected, skipping fullscreen')
    return
  }

  // Disable vertical swipes on mobile (Bot API 7.7+)
  disableVerticalSwipes()

  // Request fullscreen mode on mobile (Bot API 8.0+)
  try {
    const ok = requestFullscreen()
    console.log('[SCASH] requestFullscreen result:', ok)
    isAppFullscreen.value = ok

    if (ok && tg) {
      tg.onEvent('safeAreaChanged', onSafeAreaChanged)
      tg.onEvent('contentSafeAreaChanged', onSafeAreaChanged)
      tg.onEvent('fullscreenChanged', onSafeAreaChanged)
    }
  } catch (e) {
    console.warn('[SCASH] requestFullscreen failed:', e)
  }

  setTimeout(updateSafeAreaVars, 300)
  updateSafeAreaVars()
}

// Apply page-specific theme colors based on current route
function applyRouteTheme() {
  if (isClaimLayout.value) {
    // Claim page: dark theme to blend with red envelope background
    const claimBgColor = '#0f0f13'
    setHeaderColor(claimBgColor)
    setBackgroundColor(claimBgColor)
    setBottomBarColor(claimBgColor)
  } else {
    // Main layout: match the default wallet theme
    setHeaderColor('#f5f7f9')
    setBackgroundColor('#f5f7f9')
    setBottomBarColor('#f5f7f9')
  }
}

// Watch route changes: apply theme + trigger fullscreen on first resolved route.
// Using immediate: true because route may not be resolved at onMounted time.
watch(() => route.path, () => {
  // Setup fullscreen once on first route resolution
  setupFullscreen()
  // Apply route-specific colors
  applyRouteTheme()

  // Back button
  if (route.meta.backAsClose) {
    setupBackButton(() => closeApp())
  } else if (route.meta.activeNav) {
    hideBackButton()
  } else {
    setupBackButton(() => window.history.back())
  }
}, { immediate: true })
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
            {{ t('common.gotIt') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
