<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrypto } from '@/composables/useCrypto'
import { useWalletStore } from '@/stores'
import { api } from '@/api'

const router = useRouter()
const { generateMnemonic, deriveAddress, encryptMnemonic } = useCrypto()
const walletStore = useWalletStore()

const password = ref('')
const confirm = ref('')
const errorMsg = ref('')
const loading = ref(false)

const handleSubmit = async () => {
  errorMsg.value = ''
  if (password.value.length < 8) {
    errorMsg.value = '密码长度不能少于8位'
    return
  }
  if (password.value !== confirm.value) {
    errorMsg.value = '两次密码输入不一致'
    return
  }

  loading.value = true
  try {
    const mnemonic = generateMnemonic()
    const address = deriveAddress(mnemonic)
    const enc = await encryptMnemonic(mnemonic, password.value)

    await api.post('/api/wallet/create', {
      address,
      encryptedMnemonic: enc.ciphertext,
      salt: enc.salt,
      iv: enc.iv,
      authTag: enc.authTag,
    })

    // Cache the encrypted backup locally
    walletStore.saveBackup({
      encryptedMnemonic: enc.ciphertext,
      salt: enc.salt,
      iv: enc.iv,
      authTag: enc.authTag,
    })

    // Refresh wallet state so HomePage sees the new wallet
    await walletStore.fetchHome()
    router.push('/wallet')
  } catch (e: any) {
    errorMsg.value = e.message || '创建失败'
    loading.value = false
  }
}
</script>

<template>
  <main class="w-full max-w-[440px] flex flex-col items-center mx-auto">
    <div class="mb-8 text-center">
      <div class="w-16 h-16 rounded-full primary-gradient flex items-center justify-center mb-4 mx-auto shadow-lg shadow-primary/20">
        <span class="material-symbols-outlined text-on-primary text-3xl" style="font-variation-settings: 'FILL' 1;">account_balance_wallet</span>
      </div>
    </div>

    <div class="bg-surface-container-lowest w-full p-8 rounded-lg ambient-shadow relative overflow-hidden">
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
              <span class="material-symbols-outlined text-outline text-lg">lock</span>
            </div>
            <input v-model="password" class="w-full pl-11 pr-4 py-4 bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline-variant font-medium text-sm" placeholder="请输入密码（不少于8位）" type="password" autocomplete="off" />
          </div>
        </div>

        <div class="space-y-2">
          <div class="relative group">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span class="material-symbols-outlined text-outline text-lg">verified_user</span>
            </div>
            <input v-model="confirm" class="w-full pl-11 pr-4 py-4 bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline-variant font-medium text-sm" placeholder="再次输入密码确认" type="password" autocomplete="off" />
          </div>
        </div>

        <button type="submit" :disabled="loading" class="w-full py-4 primary-gradient text-on-primary rounded-full font-bold font-headline text-base shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
          <span v-if="loading" class="material-symbols-outlined text-xl animate-spin-fast">progress_activity</span>
          <span v-if="loading">生成中…</span>
          <template v-else>
            <span>创建钱包</span>
            <span class="material-symbols-outlined text-xl">arrow_forward</span>
          </template>
        </button>

        <div v-if="errorMsg" class="text-error text-sm font-medium mt-2">{{ errorMsg }}</div>
      </form>

      <div class="mt-8 flex items-start gap-3 p-4 bg-surface-container-low rounded-lg">
        <span class="material-symbols-outlined text-tertiary text-lg" style="font-variation-settings: 'FILL' 1;">shield_with_heart</span>
        <p class="text-[11px] text-on-tertiary-fixed-variant leading-normal font-semibold">
          安全提示：telegram miniApp 不会存储您的明文密码。请务必牢记密码，如若遗失将失去你的全部资产。
        </p>
      </div>
    </div>

    <div class="mt-8 text-center">
      <router-link to="/wallet/import" class="text-on-surface-variant font-bold text-sm hover:text-primary transition-colors flex items-center gap-2 mx-auto">
        <span class="material-symbols-outlined text-lg">settings_backup_restore</span>
        已有助记词？导入钱包
      </router-link>
    </div>
  </main>
</template>