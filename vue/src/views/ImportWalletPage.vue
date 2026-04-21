<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const mnemonic = ref('')
const password = ref('')
const confirm = ref('')
const errorMsg = ref('')
const isLoading = ref(false)

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

const handleSubmit = () => {
  errorMsg.value = ''
  if (!mnemonic.value.trim()) {
    errorMsg.value = '请输入助记词'
    return
  }
  if (password.value.length < 8) {
    errorMsg.value = '密码长度不能少于8位'
    return
  }
  if (password.value !== confirm.value) {
    errorMsg.value = '两次密码输入不一致'
    return
  }
}

const goToCreate = () => {
  router.push('/wallet/create')
}
</script>

<template>
  <AppLayout title="导入钱包" :hide-bottom-nav="true">
    <div class="fixed top-[-10%] right-[-10%] w-[300px] h-[300px] bg-primary rounded-full blur-[80px] opacity-15 -z-10"></div>
    <div class="fixed bottom-[-5%] left-[-5%] w-[250px] h-[250px] bg-tertiary rounded-full blur-[80px] opacity-15 -z-10"></div>

    <main class="min-h-screen max-w-md mx-auto flex flex-col gap-10 relative">
      <header class="space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full primary-gradient flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Icon name="download" :size="24" filled />
          </div>
          <div class="h-1 w-12 bg-surface-container-highest rounded-full"></div>
        </div>
        <h1 class="font-headline text-[2.75rem] font-extrabold leading-[1.1] tracking-tight text-on-background">
          导入钱包
        </h1>
        <p class="font-body text-on-surface-variant leading-relaxed text-sm">
          输入你的12个助记词，设置密码加密后导入。明文助记词仅在前端使用，上传服务器的密码是经过你的密码加密的。
        </p>
      </header>

      <section class="flex flex-col gap-8">
        <div class="space-y-4">
          <div class="flex items-center justify-between px-1">
            <label class="font-headline font-bold text-lg tracking-tight">助记词</label>
            <span class="font-label text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">12 Words</span>
          </div>
          <div class="relative group">
            <textarea
              v-model="mnemonic"
              class="w-full min-h-[160px] bg-surface-container-lowest rounded-lg p-5 font-body text-on-surface border-none focus:ring-2 focus:ring-primary/20 shadow-ambient transition-all resize-none placeholder:text-outline-variant"
              placeholder="word1 word2 word3 ..."
            ></textarea>
            <div class="absolute inset-0 rounded-lg pointer-events-none border border-primary/5 group-focus-within:border-primary/20 transition-colors"></div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="flex items-center gap-2 px-1">
            <Icon name="lock" :size="20" class="text-primary" />
            <label class="font-headline font-bold text-lg tracking-tight">设置钱包密码</label>
          </div>
          <div class="space-y-3">
            <div class="relative">
              <input
                v-model="password"
                type="password"
                class="w-full bg-surface-container-low h-14 px-5 rounded-lg border-none font-body focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/60"
                placeholder="请输入密码 (不少于8位)"
                autocomplete="off"
              />
            </div>
            <div class="relative">
              <input
                v-model="confirm"
                type="password"
                class="w-full bg-surface-container-low h-14 px-5 rounded-lg border-none font-body focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/60"
                placeholder="再次输入密码确认"
                autocomplete="off"
              />
            </div>
          </div>
        </div>

        <div class="bg-surface-container-low/50 rounded-lg p-5 flex gap-4 items-start">
          <Icon name="verified_user" :size="20" class="text-tertiary shrink-0" filled />
          <p class="text-xs font-label text-on-surface-variant leading-relaxed">
            <span class="font-bold text-on-surface">安全提示：</span>
            请确保周围环境安全。导入成功后，我们将为您创建高强度的本地加密存储环境。
          </p>
        </div>
      </section>

      <footer class="mt-auto pt-8 pb-4">
        <button
          @click="handleSubmit"
          :disabled="isLoading"
          class="w-full h-16 primary-gradient rounded-full flex items-center justify-center gap-2 text-white font-headline font-bold text-lg shadow-ambient active:scale-[0.98] transition-transform duration-200 group"
        >
          <span v-if="isLoading" class="spinner"></span>
          <span>导入钱包</span>
          <Icon name="arrow_forward" class="group-hover:translate-x-1 transition-transform" />
        </button>
        <div v-if="errorMsg" class="text-error text-sm font-medium mt-4 text-center">{{ errorMsg }}</div>
        <div @click="goToCreate" class="text-center mt-4">
          <span class="text-on-surface-variant text-sm cursor-pointer hover:text-primary">没有助记词？创建钱包</span>
        </div>
      </footer>
    </main>

    <div class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none overflow-hidden opacity-40 -z-10">
      <div class="absolute top-[20%] right-[-20%] w-[400px] h-[400px] bg-primary/20 rounded-full blur-[120px]"></div>
    </div>
  </AppLayout>
</template>