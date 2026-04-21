<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()

const goBack = () => {
  router.back()
}

const goToSettings = () => {
  router.push('/wallet/settings')
}

onMounted(() => {
  const tg = window.Telegram?.WebApp
  if (tg) {
    tg.BackButton.show()
    tg.onEvent('backButtonClicked', goBack)
  }
})

onUnmounted(() => {
  const tg = window.Telegram?.WebApp
  if (tg) {
    tg.BackButton.hide()
    tg.offEvent('backButtonClicked', goBack)
  }
})
</script>

<template>
  <AppLayout title="备份助记词" :hide-bottom-nav="true">
    <div class="flex flex-col items-center text-center mb-8">
      <div class="w-16 h-16 rounded-full primary-gradient flex items-center justify-center shadow-lg mb-4">
        <Icon name="key" :size="32" class="text-white" filled />
      </div>
      <h1 class="font-headline text-2xl font-extrabold text-on-surface mb-3">查看 / 备份助记词</h1>
      <p class="text-on-surface-variant text-sm leading-relaxed max-w-[300px]">
        请务必妥善保管您的助记词，这是恢复钱包的唯一方式。
      </p>
    </div>

    <div class="bg-surface-container-lowest rounded-lg p-6 shadow-ambient mb-6">
      <div class="flex items-start gap-3 p-4 bg-error/5 border border-error/20 rounded-lg mb-6">
        <Icon name="warning" :size="20" class="text-error shrink-0" />
        <p class="text-xs text-error leading-relaxed">
          <strong>重要提示：</strong>任何人获取您的助记词都可以完全控制您的资产。请务必在安全的环境下查看，并妥善保管，切勿告知他人。
        </p>
      </div>

      <div class="space-y-4">
        <div>
          <label class="text-xs font-bold text-on-surface-variant tracking-wider uppercase ml-1 mb-2 block">输入钱包密码</label>
          <input
            type="password"
            class="w-full h-14 px-6 bg-surface-container-high border-none rounded-DEFAULT focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all duration-300 font-medium placeholder:text-outline"
            placeholder="请输入钱包密码"
          />
        </div>
      </div>
    </div>

    <button class="w-full primary-gradient h-16 rounded-full flex items-center justify-center gap-3 shadow-ambient hover:scale-[0.98] active:scale-95 transition-all duration-200">
      <span class="text-white font-headline font-extrabold text-lg">查看助记词</span>
      <Icon name="visibility" class="text-white text-xl" />
    </button>

    <div class="mt-8 text-center">
      <div @click="goToSettings" class="text-primary font-medium text-sm hover:underline cursor-pointer">
        返回设置
      </div>
    </div>
  </AppLayout>
</template>