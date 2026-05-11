<script setup lang="ts">
import { useWalletStore } from '@/stores'
import { useTelegram } from '@/composables/useTelegram'
import { useI18n } from '@/i18n'

defineProps<{
  title?: string
  showSettings?: boolean
}>()

const walletStore = useWalletStore()
const { showAlert } = useTelegram()
const { t } = useI18n()

function handleDisabledSettings() {
  showAlert(t('header.needWalletForSettings'))
}
</script>

<template>
  <!--
    全屏模式下（移动端）：
    - paddingTop 使用 --safe-area-top（设备刘海高度），使 header 和 Telegram 系统按钮同一行
    - paddingRight 使用 --content-safe-right 避开 Telegram 右上角按钮（关闭/更多菜单）
    非全屏模式下（桌面端），所有安全区变量为 0，无额外间距。
  -->
  <header
    class="sticky top-0 w-full z-50 glass-header shadow-sm shadow-purple-500/5 flex justify-between items-center px-6 py-2"
    :style="{
      paddingTop: 'calc(0.5rem + var(--safe-area-top, 0px))',
      paddingRight: 'calc(1.5rem + var(--content-safe-right, 0px))',
    }"
  >
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full border-2 border-primary/20 overflow-hidden bg-surface-container">
        <img alt="SCASH" class="w-full h-full object-cover" src="/img/logo-256x256.png" />
      </div>
      <span class="font-headline font-bold text-lg text-purple-700">{{ title || t('appName') }}</span>
    </div>
    <!-- Settings: disabled when no wallet -->
    <button
      v-if="showSettings && !walletStore.hasWallet"
      class="w-10 h-10 flex items-center justify-center rounded-full text-slate-300 cursor-not-allowed"
      @click="handleDisabledSettings"
    >
      <span class="material-symbols-outlined">settings</span>
    </button>
    <router-link
      v-else-if="showSettings"
      to="/wallet/settings"
      class="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-purple-50 transition-colors active:scale-95 duration-200"
    >
      <span class="material-symbols-outlined">settings</span>
    </router-link>
  </header>
</template>
