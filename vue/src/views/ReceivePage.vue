<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const address = ref('bcrt1qxy8kgqy8ysygqspg5gcfjryv5w6f8hn0w7d5h2y5t5e8j0k')
const showTip = ref(false)

const copyAddress = () => {
  navigator.clipboard.writeText(address.value)
  showTip.value = true
  setTimeout(() => { showTip.value = false }, 2000)
}

const goBack = () => {
  router.back()
}
</script>

<template>
  <AppLayout title="接收" :hide-bottom-nav="true">
    <div class="w-full max-w-md mx-auto flex flex-col items-center gap-10">
      <header class="text-center space-y-2">
        <h1 class="font-headline font-extrabold text-2xl tracking-tight text-on-surface">我的 SCASH 收款地址</h1>
        <p class="text-on-surface-variant text-sm font-medium tracking-wide">扫描二维码或向下方地址发送资产</p>
      </header>

      <div class="relative w-full aspect-square max-w-[320px]">
        <div class="absolute inset-0 bg-primary-container/20 blur-[80px] rounded-full scale-110"></div>
        <div class="relative z-10 bg-surface-container-lowest p-8 rounded-lg shadow-ambient flex items-center justify-center overflow-hidden border border-white/50">
          <div class="w-full aspect-square bg-white flex items-center justify-center rounded">
            <div class="grid grid-cols-5 gap-1 p-4">
              <div v-for="i in 25" :key="i" class="w-8 h-8 bg-on-surface rounded-sm"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="w-full space-y-4">
        <div class="bg-surface-container-low px-6 py-5 rounded-lg flex flex-col items-center gap-3">
          <span class="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest font-headline">收款地址</span>
          <div class="w-full text-center">
            <p class="font-mono text-sm leading-relaxed break-all text-on-surface selection:bg-primary-container selection:text-on-primary-container">{{ address }}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <button @click="copyAddress" class="flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-primary-container text-white font-bold py-4 rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all duration-200">
            <Icon name="content_copy" :size="18" />
            <span>复制地址</span>
          </button>
          <button class="flex items-center justify-center gap-2 bg-surface-container-high text-primary font-bold py-4 rounded-full active:scale-95 transition-all duration-200">
            <Icon name="share" :size="18" />
            <span>分享地址</span>
          </button>
        </div>

        <div v-if="showTip" class="text-center text-primary font-medium text-sm mt-4 h-5 transition-opacity duration-300">已复制到剪贴板</div>
      </div>

      <footer class="flex items-center gap-2 px-6 py-3 bg-error/5 rounded-full">
        <Icon name="info" :size="16" class="text-error" filled />
        <span class="text-error font-bold text-xs tracking-wide">仅支持 SCASH 网络资产</span>
      </footer>

      <button @click="goBack" class="mt-4 text-primary font-medium text-sm hover:underline">
        返回
      </button>
    </div>
  </AppLayout>
</template>