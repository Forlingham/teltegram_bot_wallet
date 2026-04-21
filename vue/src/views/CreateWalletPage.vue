<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
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
  if (password.value.length < 8) {
    errorMsg.value = '密码长度不能少于8位'
    return
  }
  if (password.value !== confirm.value) {
    errorMsg.value = '两次密码输入不一致'
    return
  }
}

const goToImport = () => {
  router.push('/wallet/import')
}
</script>

<template>
  <AppLayout title="创建钱包" :hide-bottom-nav="true">
    <div class="w-full max-w-[440px] flex flex-col items-center mx-auto">
      <div class="mb-8 text-center">
        <div class="w-16 h-16 rounded-full primary-gradient flex items-center justify-center mb-4 mx-auto shadow-lg shadow-primary/20">
          <Icon name="account_balance_wallet" :size="32" filled class="text-white" />
        </div>
      </div>

      <div class="bg-surface-container-lowest w-full p-8 rounded-lg shadow-ambient relative overflow-hidden">
        <div class="absolute -top-12 -right-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>

        <div class="relative z-10 mb-8">
          <h1 class="font-headline text-2xl font-bold text-on-surface mb-3 tracking-tight">创建钱包</h1>
          <p class="text-on-surface-variant text-sm leading-relaxed font-medium">
            只需设置一个密码，系统会自动生成助记词并创建钱包。助记词加密后仅保存在你的账号下，换设备可恢复。
          </p>
        </div>

        <form class="space-y-6 relative z-10" @submit.prevent="handleSubmit">
          <div class="space-y-2">
            <label class="text-xs font-bold text-on-surface-variant tracking-wider uppercase ml-1">设置钱包密码</label>
            <div class="relative group">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Icon name="lock" :size="20" class="text-outline" />
              </div>
              <input
                v-model="password"
                type="password"
                class="w-full pl-11 pr-4 py-4 bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline-variant font-medium text-sm"
                placeholder="请输入密码（不少于8位）"
                autocomplete="off"
              />
            </div>
          </div>

          <div class="space-y-2">
            <div class="relative group">
              <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Icon name="verified_user" :size="20" class="text-outline" />
              </div>
              <input
                v-model="confirm"
                type="password"
                class="w-full pl-11 pr-4 py-4 bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline-variant font-medium text-sm"
                placeholder="再次输入密码确认"
                autocomplete="off"
              />
            </div>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-4 primary-gradient text-white rounded-full font-bold font-headline text-base shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 mt-2"
          >
            <span v-if="isLoading" class="spinner"></span>
            <span>创建钱包</span>
            <Icon name="arrow_forward" :size="20" />
          </button>

          <div v-if="errorMsg" class="text-error text-sm font-medium mt-2">{{ errorMsg }}</div>
        </form>

        <div class="mt-8 flex items-start gap-3 p-4 bg-surface-container-low rounded-lg">
          <Icon name="shield_with_heart" :size="20" class="text-tertiary shrink-0" filled />
          <p class="text-[11px] text-on-tertiary-fixed-variant leading-normal font-semibold">
            安全提示：telegram miniApp 不会存储您的明文密码。请务必牢记密码，如若遗失将失去你的全部资产。
          </p>
        </div>
      </div>

      <div class="mt-8 text-center">
        <div @click="goToImport" class="text-on-surface-variant font-bold text-sm hover:text-primary transition-colors flex items-center gap-2 mx-auto cursor-pointer">
          <Icon name="settings_backup_restore" :size="20" />
          已有助记词？导入钱包
        </div>
      </div>
    </div>
  </AppLayout>
</template>