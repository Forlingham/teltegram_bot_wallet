<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore } from '@/stores'
import { api } from '@/api'

const router = useRouter()
const walletStore = useWalletStore()

const address = ref('')
const errorMsg = ref('')
const loading = ref(false)

const handleBind = async () => {
  errorMsg.value = ''
  const addr = address.value.trim()
  if (!addr || addr.length < 10) {
    errorMsg.value = '请输入有效的 Scash 地址'
    return
  }
  loading.value = true
  try {
    await api.post('/api/wallet/bind', { address: addr })
    await walletStore.fetchHome()
    router.push('/wallet')
  } catch (e: any) {
    errorMsg.value = e?.message || '绑定失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="w-full max-w-[440px] flex flex-col items-center mx-auto">
    <div class="mb-8 text-center">
      <div class="w-16 h-16 rounded-full primary-gradient flex items-center justify-center mb-4 mx-auto shadow-lg shadow-primary/20">
        <span class="material-symbols-outlined text-on-primary text-3xl" style="font-variation-settings: 'FILL' 1;">link</span>
      </div>
    </div>

    <div class="bg-surface-container-lowest w-full p-8 rounded-lg ambient-shadow relative overflow-hidden">
      <div class="absolute -top-12 -right-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>

      <div class="relative z-10 mb-8">
        <h1 class="font-headline text-2xl font-bold text-on-surface mb-3 tracking-tight">绑定观察钱包</h1>
        <p class="text-on-surface-variant text-sm leading-relaxed font-medium">
          绑定一个已有的 Scash 地址作为观察钱包。观察钱包只能接收，无法签名发送，适合只收不发的场景。
        </p>
      </div>

      <form class="space-y-6 relative z-10" @submit.prevent="handleBind">
        <div class="space-y-2">
          <label class="text-xs font-bold text-on-surface-variant tracking-wider uppercase ml-1">Scash 地址</label>
          <div class="relative group">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span class="material-symbols-outlined text-outline text-lg">account_balance_wallet</span>
            </div>
            <input
              v-model="address"
              class="w-full pl-11 pr-4 py-4 bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline-variant font-medium text-sm"
              placeholder="scash1..."
              type="text"
              autocomplete="off"
              @keyup.enter="handleBind"
            />
          </div>
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-4 primary-gradient text-on-primary rounded-full font-bold font-headline text-base shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span v-if="loading" class="material-symbols-outlined text-xl animate-spin-fast">progress_activity</span>
          <span v-if="loading">绑定中…</span>
          <template v-else>
            <span>绑定观察钱包</span>
            <span class="material-symbols-outlined text-xl">arrow_forward</span>
          </template>
        </button>

        <div v-if="errorMsg" class="text-error text-sm font-medium mt-2">{{ errorMsg }}</div>
      </form>

      <div class="mt-8 flex items-start gap-3 p-4 bg-surface-container-low rounded-lg">
        <span class="material-symbols-outlined text-tertiary text-lg" style="font-variation-settings: 'FILL' 1;">info</span>
        <p class="text-[11px] text-on-tertiary-fixed-variant leading-normal font-semibold">
          观察钱包仅用于查看余额和接收转账，无法进行任何签名操作。如需发送资产，请创建或导入完整钱包。
        </p>
      </div>
    </div>
  </main>
</template>
