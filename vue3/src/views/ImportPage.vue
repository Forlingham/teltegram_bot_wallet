<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCrypto } from '@/composables/useCrypto'
import { useWalletStore } from '@/stores'
import { api } from '@/api'

const router = useRouter()
const { validateMnemonic, deriveAddress, encryptMnemonic } = useCrypto()
const walletStore = useWalletStore()

const mnemonic = ref('')
const password = ref('')
const confirm = ref('')
const errorMsg = ref('')
const loading = ref(false)

const handleSubmit = async () => {
  errorMsg.value = ''
  const mn = mnemonic.value.trim().replace(/\s+/g, ' ')

  if (!validateMnemonic(mn)) {
    errorMsg.value = '助记词格式不正确，请检查'
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

  loading.value = true
  try {
    const address = deriveAddress(mn)
    const enc = await encryptMnemonic(mn, password.value)

    await api.post('/api/wallet/import', {
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
    errorMsg.value = e.message || '导入失败'
    loading.value = false
  }
}
</script>

<template>
  <div class="fixed top-[-10%] right-[-10%] w-[300px] h-[300px] bg-primary rounded-full blur-[80px] opacity-15 -z-10"></div>
  <div class="fixed bottom-[-5%] left-[-5%] w-[250px] h-[250px] bg-tertiary rounded-full blur-[80px] opacity-15 -z-10"></div>

  <main class="min-h-screen max-w-md mx-auto flex flex-col gap-10 relative">
    <header class="space-y-4">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-full primary-gradient flex items-center justify-center text-on-primary shadow-lg shadow-primary/20">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">download</span>
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
          <textarea v-model="mnemonic" class="w-full min-h-[160px] bg-surface-container-lowest rounded-lg p-5 font-body text-on-surface border-none focus:ring-2 focus:ring-primary/20 ambient-shadow transition-all resize-none placeholder:text-outline-variant" placeholder="word1 word2 word3 ..."></textarea>
          <div class="absolute inset-0 rounded-lg pointer-events-none border border-primary/5 group-focus-within:border-primary/20 transition-colors"></div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="flex items-center gap-2 px-1">
          <span class="material-symbols-outlined text-primary text-xl">lock</span>
          <label class="font-headline font-bold text-lg tracking-tight">设置钱包密码</label>
        </div>
        <div class="space-y-3">
          <div class="relative">
            <input v-model="password" class="w-full bg-surface-container-low h-14 px-5 rounded-lg border-none font-body focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/60" placeholder="请输入密码 (不少于8位)" type="password" autocomplete="off" />
          </div>
          <div class="relative">
            <input v-model="confirm" class="w-full bg-surface-container-low h-14 px-5 rounded-lg border-none font-body focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/60" placeholder="再次输入密码确认" type="password" autocomplete="off" />
          </div>
        </div>
      </div>

      <div class="bg-surface-container-low/50 rounded-lg p-5 flex gap-4 items-start">
        <span class="material-symbols-outlined text-tertiary" style="font-variation-settings: 'FILL' 1;">verified_user</span>
        <p class="text-xs font-label text-on-surface-variant leading-relaxed">
          <span class="font-bold text-on-surface">安全提示：</span>
          请确保周围环境安全。导入成功后，我们将为您创建高强度的本地加密存储环境。
        </p>
      </div>
    </section>

    <footer class="mt-auto pt-8 pb-4">
      <button :disabled="loading" @click="handleSubmit" class="w-full h-16 primary-gradient rounded-full flex items-center justify-center gap-2 text-on-primary font-headline font-bold text-lg ambient-shadow active:scale-[0.98] transition-transform duration-200 group disabled:opacity-60 disabled:cursor-not-allowed">
        <template v-if="loading">
          <span class="material-symbols-outlined text-xl animate-spin-fast">progress_activity</span>
          <span>导入中…</span>
        </template>
        <template v-else>
          导入钱包
          <span class="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
        </template>
      </button>
      <div v-if="errorMsg" class="text-error text-sm font-medium mt-4 text-center">{{ errorMsg }}</div>
    </footer>
  </main>
</template>