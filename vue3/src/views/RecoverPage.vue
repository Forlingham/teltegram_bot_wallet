<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCrypto } from '@/composables/useCrypto'
import { useWalletStore } from '@/stores'
import { api } from '@/api'
import { useI18n } from '@/i18n'
import PasswordModal from '@/components/PasswordModal.vue'

const { decryptMnemonic } = useCrypto()
const walletStore = useWalletStore()
const { t } = useI18n()

interface BackupData {
  encryptedMnemonic?: string
  ciphertext?: string
  salt: string
  iv: string
  authTag?: string
}

const loading = ref(false)
const backupData = ref<BackupData | null>(walletStore.backup)
const showPasswordModal = ref(false)
const decrypting = ref(false)
const mnemonicWords = ref<string[]>([])
const rawMnemonic = ref('')
const errorMsg = ref('')
const copiedMnemonic = ref(false)
const copiedBackup = ref(false)
const passwordError = ref('')

// If backup is already cached, show it immediately
if (backupData.value) {
  // Already loaded from store
}

const loadBackup = async () => {
  errorMsg.value = ''
  loading.value = true
  try {
    // Use cached backup first
    if (walletStore.backup) {
      backupData.value = walletStore.backup
      return
    }
    // Fetch from server if not cached
    const data = await api.post<{ backup: BackupData | null }>('/api/wallet/recover', {})
    if (!data.backup) {
      errorMsg.value = t('recover.errorNoBackup')
      return
    }
    backupData.value = data.backup
    walletStore.saveBackup(data.backup as any)
  } catch (e: any) {
    errorMsg.value = e.message || t('recover.errorLoad')
  } finally {
    loading.value = false
  }
}

const handleDecrypt = async (password: string) => {
  if (!backupData.value) return
  decrypting.value = true
  errorMsg.value = ''
  try {
    const mnemonic = await decryptMnemonic(backupData.value, password)
    rawMnemonic.value = mnemonic
    mnemonicWords.value = mnemonic.trim().split(/\s+/)
    showPasswordModal.value = false
  } catch (e: any) {
    passwordError.value = e.message || t('recover.errorDecrypt')
  } finally {
    decrypting.value = false
  }
}

watch(showPasswordModal, (v) => {
  if (v) passwordError.value = ''
})

const copyMnemonic = async () => {
  if (!rawMnemonic.value) return
  await navigator.clipboard.writeText(rawMnemonic.value)
  copiedMnemonic.value = true
  setTimeout(() => { copiedMnemonic.value = false }, 1500)
}

const copyBackup = async () => {
  if (!backupData.value) return
  await navigator.clipboard.writeText(JSON.stringify(backupData.value, null, 2))
  copiedBackup.value = true
  setTimeout(() => { copiedBackup.value = false }, 1500)
}
</script>

<template>
  <main class="max-w-md mx-auto min-h-screen flex flex-col gap-6 relative">
    <section class="flex flex-col gap-3 p-5 rounded-lg bg-primary/5 border-l-4 border-primary">
      <div class="flex items-center gap-2 text-primary">
        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">security</span>
        <span class="font-bold text-sm">{{ t('recover.securityTipTitle') }}</span>
      </div>
      <p class="text-on-surface-variant text-sm leading-relaxed">
        {{ t('recover.securityTipBody') }}
      </p>
    </section>

    <section>
      <button
        :disabled="loading"
        @click="loadBackup"
        class="w-full h-14 primary-gradient text-on-primary rounded-full font-bold flex items-center justify-center gap-3 shadow-lg shadow-primary/20 active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span v-if="loading" class="material-symbols-outlined text-xl animate-spin-fast">progress_activity</span>
        <span v-else class="material-symbols-outlined">cloud_download</span>
        <span>{{ loading ? t('recover.loadingBackup') : t('recover.loadBackupBtn') }}</span>
      </button>
    </section>

    <section v-if="backupData" class="flex flex-col gap-3">
      <div class="flex justify-between items-center px-1">
        <h2 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{{ t('recover.ciphertextLabel') }}</h2>
        <button @click="copyBackup" class="text-on-surface-variant hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-sm">{{ copiedBackup ? 'check' : 'content_copy' }}</span>
        </button>
      </div>
      <div class="bg-surface-container-low rounded-lg p-4 overflow-hidden border border-outline-variant/10">
        <pre class="text-[10px] text-primary/80 leading-relaxed whitespace-pre-wrap break-all font-mono opacity-70">{{ JSON.stringify(backupData, null, 2) }}</pre>
      </div>
    </section>

    <section v-if="backupData" class="flex flex-col gap-3">
      <label class="text-xs font-bold uppercase tracking-wider text-on-surface-variant px-1">{{ t('recover.decryptLabel') }}</label>
      <button
        @click="showPasswordModal = true"
        class="w-full h-14 bg-surface-container-highest text-primary rounded-full font-extrabold flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <span>{{ t('recover.decryptBtn') }}</span>
        <span class="material-symbols-outlined">lock_open</span>
      </button>
    </section>

    <section v-if="mnemonicWords.length > 0" class="mt-2">
      <div class="bg-surface-container-lowest rounded-lg p-6 flex flex-col gap-6 ambient-shadow">
        <div class="grid grid-cols-3 gap-3">
          <div v-for="(word, i) in mnemonicWords" :key="i" class="h-10 bg-surface-container-low rounded-full flex items-center justify-center">
            <span class="text-xs font-bold text-primary">{{ i + 1 }}. {{ word }}</span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="mnemonicWords.length > 0" class="flex justify-center">
      <button @click="copyMnemonic" class="flex items-center gap-2 px-6 py-3 bg-surface-container-low rounded-full text-on-surface-variant text-sm font-bold hover:bg-surface-container-high transition-colors">
        <span class="material-symbols-outlined text-lg">{{ copiedMnemonic ? 'check' : 'content_copy' }}</span>
        <span>{{ copiedMnemonic ? t('recover.mnemonicCopied') : t('recover.copyMnemonic') }}</span>
      </button>
    </section>

    <div v-if="errorMsg" class="text-error text-sm font-medium text-center">{{ errorMsg }}</div>

    <PasswordModal
      v-model="showPasswordModal"
      :title="t('recover.passwordTitle')"
      :loading="decrypting"
      :error-message="passwordError"
      @confirm="handleDecrypt"
    />
  </main>
</template>
