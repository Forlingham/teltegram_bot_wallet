<script setup lang="ts">
import { useWalletStore } from '@/stores'
import { useTelegram } from '@/composables/useTelegram'
import { useI18n } from '@/i18n'

const props = defineProps<{
  title?: string
  showSettings?: boolean
  fullscreen?: boolean
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
    - header 内容居中显示，在 Telegram 左右按钮之间
    - 隐藏设置按钮（全屏模式有 Telegram SettingsButton 替代）
    非全屏模式下（桌面端），正常左右布局。
  -->
  <header
    class="sticky top-0 w-full z-50 glass-header shadow-sm shadow-purple-500/5"
    :class="fullscreen ? 'header-fullscreen' : 'header-normal'"
    :style="{ paddingTop: 'calc(0.5rem + var(--safe-area-top, 0px))' }"
  >
    <!-- 全屏模式：居中 logo + 标题 -->
    <template v-if="fullscreen">
      <div class="flex items-center justify-center gap-2 w-full py-1">
        <div class="w-8 h-8 rounded-full border-2 border-primary/20 overflow-hidden bg-surface-container flex-shrink-0">
          <img alt="SCASH" class="w-full h-full object-cover" src="/img/logo-256x256.png" />
        </div>
        <span class="font-headline font-bold text-base text-purple-700 truncate">{{ title || t('appName') }}</span>
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
      </div>
    </template>

    <!-- 非全屏模式：正常左右布局 -->
    <template v-else>
      <div class="flex justify-between items-center w-full px-6 py-2">
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
      </div>
    </template>
  </header>
</template>

<style scoped>
.header-fullscreen {
  /* 全屏模式：不加左右 padding，内容自身居中 */
  padding-left: 0;
  padding-right: 0;
}
.header-normal {
  /* 非全屏模式：无额外处理，内部 div 自带 px-6 */
}
</style>
