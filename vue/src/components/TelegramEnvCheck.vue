<script setup>
import Icon from './Icon.vue'
import { useAppStore } from '../store/app'

const appStore = useAppStore()
</script>

<template>
  <div v-if="!appStore.isTelegram" class="min-h-screen bg-surface flex flex-col items-center justify-center p-8">
    <div class="w-24 h-24 rounded-2xl bg-error/10 flex items-center justify-center mb-6">
      <Icon name="error" :size="48" class="text-error" filled />
    </div>
    <h1 class="font-headline text-2xl font-extrabold text-on-surface mb-4 text-center">
      仅限 Telegram 使用
    </h1>
    <p class="text-on-surface-variant text-center leading-relaxed max-w-[300px] mb-8">
      SCASH 钱包是一个 Telegram Mini App，需要在 Telegram 应用内打开才能正常使用。
    </p>
    <div class="space-y-3 text-sm text-on-surface-variant">
      <p class="text-center">请通过以下方式打开：</p>
      <ul class="list-none space-y-2 text-center">
        <li>1. 在 Telegram 搜索 SCASH 钱包</li>
        <li>2. 或点击好友分享的链接</li>
        <li>3. 使用 Telegram 内置浏览器打开</li>
      </ul>
    </div>
  </div>
  <slot v-else />
</template>