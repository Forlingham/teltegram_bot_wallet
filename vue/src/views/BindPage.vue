<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()

const goBack = () => {
  router.back()
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
  <AppLayout title="绑定钱包" :hide-bottom-nav="true">
    <div class="flex flex-col items-center text-center mb-8">
      <div class="w-16 h-16 rounded-full primary-gradient flex items-center justify-center shadow-lg mb-4">
        <Icon name="link" :size="32" class="text-white" filled />
      </div>
      <h1 class="font-headline text-2xl font-extrabold text-on-surface mb-3">绑定观察钱包</h1>
      <p class="text-on-surface-variant text-sm leading-relaxed max-w-[300px]">
        绑定观察钱包，只能领取红包，无法发送。观察钱包无法进行签名操作。
      </p>
    </div>

    <div class="bg-surface-container-lowest rounded-lg p-6 shadow-ambient mb-6">
      <div class="space-y-4">
        <div>
          <label class="text-xs font-bold text-on-surface-variant tracking-wider uppercase ml-1 mb-2 block">钱包地址</label>
          <input
            type="text"
            class="w-full h-14 px-6 bg-surface-container-high border-none rounded-DEFAULT focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all duration-300 font-medium placeholder:text-outline"
            placeholder="粘贴钱包地址"
          />
        </div>
      </div>

      <div class="mt-6 flex items-start gap-3 p-4 bg-surface-container-low rounded-lg">
        <Icon name="info" :size="20" class="text-primary shrink-0" />
        <p class="text-[11px] text-on-surface-variant leading-normal">
          观察钱包只能查看余额和接收红包，无法发送资产。请确保您要绑定的是观察钱包地址。
        </p>
      </div>
    </div>

    <button class="w-full primary-gradient h-16 rounded-full flex items-center justify-center gap-3 shadow-ambient hover:scale-[0.98] active:scale-95 transition-all duration-200">
      <span class="text-white font-headline font-extrabold text-lg">确认绑定</span>
      <Icon name="arrow_forward" class="text-white text-xl" />
    </button>

    <button @click="goBack" class="mt-4 w-full py-3 bg-surface-container-low rounded-full text-on-surface-variant font-semibold active:scale-[0.98] transition-transform">返回</button>
  </AppLayout>
</template>