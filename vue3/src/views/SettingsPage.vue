<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore, type WalletBackup } from '@/stores'
import { useCrypto } from '@/composables/useCrypto'
import { useTelegram } from '@/composables/useTelegram'
import { api } from '@/api'
import PasswordModal from '@/components/PasswordModal.vue'
import { useI18n, LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from '@/i18n'

const router = useRouter()
const walletStore = useWalletStore()
const { decryptMnemonic, encryptMnemonic, deriveAddress } = useCrypto()
const { showAlert } = useTelegram()
const { t, locale, setLocale } = useI18n()

const isWatchOnly = ref(false)
const showPasswordModal = ref(false)
const passwordLoading = ref(false)
const passwordError = ref('')

const showChangeModal = ref(false)
const changeLoading = ref(false)
const changeError = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

// --- Language switcher state ---
const showLanguageModal = ref(false)
const currentLanguageLabel = computed(() => LOCALE_LABELS[locale.value])
const languageOptions = computed(() =>
  SUPPORTED_LOCALES.map((code) => ({ code, label: LOCALE_LABELS[code] }))
)

function handleLanguageSelect(code: Locale) {
  setLocale(code)
  showLanguageModal.value = false
}

onMounted(async () => {
  if (!walletStore.home) await walletStore.fetchHome()
  isWatchOnly.value = walletStore.isWatchOnly
})

watch(showPasswordModal, (v) => {
  if (v) passwordError.value = ''
})

const handleUnbind = async () => {
  // Refresh home state first to avoid stale data
  try {
    await walletStore.fetchHome()
  } catch {}
  if (!walletStore.hasWallet) {
    await showAlert(t('settings.errorNoWallet'))
    router.push('/wallet')
    return
  }

  const conf1 = confirm(t('settings.unbindConfirm1'))
  if (!conf1) return
  const conf2 = confirm(t('settings.unbindConfirm2'))
  if (!conf2) return

  try {
    await walletStore.unbindWallet()
    await showAlert(t('settings.unbindSuccess'))
    router.push('/wallet')
  } catch (e: any) {
    await showAlert(t('settings.errorUnbindFailed', { message: e.message }))
  }
}

const handleChangePassword = async (password: string) => {
  changeError.value = ''
  changeLoading.value = true

  try {
    // Use cached backup first, fallback to API
    let backupData: WalletBackup | null = walletStore.backup
    if (!backupData) {
      const data = await api.post<{ backup: WalletBackup | null }>('/api/wallet/recover', {})
      if (!data.backup) throw new Error(t('settings.errorNoBackupData'))
      backupData = data.backup
      walletStore.saveBackup(backupData)
    }

    await decryptMnemonic(backupData!, password)

    changeLoading.value = false
    showPasswordModal.value = false

    // Now prompt for new password
    oldPassword.value = password
    showChangeModal.value = true
  } catch (e: any) {
    passwordError.value = e.message || t('common.operationFailed')
  } finally {
    changeLoading.value = false
  }
}

const submitNewPassword = async () => {
  changeError.value = ''
  if (!newPassword.value || newPassword.value.length < 8) {
    changeError.value = t('settings.errorNewTooShort')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    changeError.value = t('settings.errorNewMismatch')
    return
  }
  if (oldPassword.value === newPassword.value) {
    changeError.value = t('settings.errorSameAsOld')
    return
  }

  changeLoading.value = true
  try {
    // Use cached backup first, fallback to API
    let backupData: WalletBackup | null = walletStore.backup
    if (!backupData) {
      const data = await api.post<{ backup: WalletBackup | null }>('/api/wallet/recover', {})
      if (!data.backup) throw new Error(t('settings.errorNoBackupData'))
      backupData = data.backup
      walletStore.saveBackup(backupData)
    }

    const mnemonic = await decryptMnemonic(backupData, oldPassword.value)
    const address = walletStore.address || deriveAddress(mnemonic)
    const enc = await encryptMnemonic(mnemonic, newPassword.value)

    await api.post('/api/wallet/update-password', {
      address,
      encryptedMnemonic: enc.ciphertext,
      salt: enc.salt,
      iv: enc.iv,
      authTag: enc.authTag,
    })

    // Update local cache with new encrypted backup
    walletStore.saveBackup({
      encryptedMnemonic: enc.ciphertext,
      salt: enc.salt,
      iv: enc.iv,
      authTag: enc.authTag,
    })

    await showAlert(t('settings.changeSuccess'))
    showChangeModal.value = false
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e: any) {
    changeError.value = e.message || t('common.operationFailed')
  } finally {
    changeLoading.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 pointer-events-none -z-10 bg-background overflow-hidden">
    <div class="absolute top-[-10%] right-[-20%] w-[80%] h-[60%] rounded-full bg-primary/5 blur-[120px]"></div>
    <div class="absolute bottom-[-10%] left-[-20%] w-[60%] h-[50%] rounded-full bg-tertiary/5 blur-[100px]"></div>
  </div>

  <main class="flex flex-col gap-8">
    <section class="relative overflow-hidden p-6 rounded-lg bg-gradient-to-br from-primary to-primary-container text-white ambient-shadow">
      <div class="relative z-10">
        <div class="flex justify-between items-start">
          <div>
            <p class="text-xs uppercase tracking-wider opacity-80 mb-1">{{ t('settings.currentWalletLabel') }}</p>
            <h2 class="font-headline text-xl font-bold">{{ t('settings.currentWalletName') }}</h2>
          </div>
          <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
            <span class="material-symbols-outlined text-white" style="font-variation-settings: 'FILL' 1;">account_balance_wallet</span>
          </div>
        </div>
        <div class="mt-4 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-tertiary-fixed"></span>
          <p class="text-sm font-medium opacity-90">{{ t('settings.connectedMainnet') }}</p>
        </div>
      </div>
      <div class="absolute -bottom-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
    </section>

    <section class="flex flex-col gap-2">
      <router-link v-if="!isWatchOnly" to="/wallet/recover" class="group flex items-center justify-between p-5 rounded-lg bg-surface-container-lowest active:scale-[0.98] transition-all ambient-shadow text-left">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-sm bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
            <span class="material-symbols-outlined">key</span>
          </div>
          <div>
            <p class="text-[15px] font-semibold text-on-surface">{{ t('settings.viewMnemonic') }}</p>
            <p class="text-xs text-on-surface-variant">{{ t('settings.viewMnemonicDesc') }}</p>
          </div>
        </div>
        <span class="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
      </router-link>

      <button v-if="!isWatchOnly" @click="showPasswordModal = true" class="group flex items-center justify-between p-5 rounded-lg bg-surface-container-lowest active:scale-[0.98] transition-all ambient-shadow text-left w-full">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-sm bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
            <span class="material-symbols-outlined">lock_reset</span>
          </div>
          <div>
            <p class="text-[15px] font-semibold text-on-surface">{{ t('settings.changePassword') }}</p>
            <p class="text-xs text-on-surface-variant">{{ t('settings.changePasswordDesc') }}</p>
          </div>
        </div>
        <span class="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
      </button>

      <!-- Language switcher -->
      <button @click="showLanguageModal = true" class="group flex items-center justify-between p-5 rounded-lg bg-surface-container-lowest active:scale-[0.98] transition-all ambient-shadow text-left w-full">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-sm bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
            <span class="material-symbols-outlined">language</span>
          </div>
          <div>
            <p class="text-[15px] font-semibold text-on-surface">{{ t('settings.language') }}</p>
            <p class="text-xs text-on-surface-variant">{{ t('settings.languageDesc') }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-on-surface-variant font-medium">{{ currentLanguageLabel }}</span>
          <span class="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
        </div>
      </button>

      <button v-if="walletStore.hasWallet" @click="handleUnbind" class="group mt-4 flex items-center justify-between p-5 rounded-lg bg-error/5 active:scale-[0.98] transition-all border border-error/10 text-left w-full">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-sm bg-error/10 flex items-center justify-center text-error">
            <span class="material-symbols-outlined">link_off</span>
          </div>
          <div>
            <p class="text-[15px] font-bold text-error">{{ t('settings.unbindWallet') }}</p>
            <p class="text-xs text-error/70">{{ t('settings.unbindDesc') }}</p>
          </div>
        </div>
        <span class="material-symbols-outlined text-error group-hover:translate-x-1 transition-transform">chevron_right</span>
      </button>
    </section>

    <PasswordModal
      v-model="showPasswordModal"
      :title="t('settings.verifyOld')"
      :loading="passwordLoading"
      :error-message="passwordError"
      @confirm="handleChangePassword"
    />

    <!-- Change password modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showChangeModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showChangeModal = false" />
          <div class="relative bg-surface-container-lowest rounded-lg p-6 w-full max-w-sm shadow-xl">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">lock_reset</span>
              </div>
              <h3 class="font-headline text-lg font-bold text-on-surface">{{ t('settings.changePasswordModalTitle') }}</h3>
            </div>
            <div class="space-y-3">
              <input v-model="newPassword" type="password" class="w-full px-4 py-3 bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50" :placeholder="t('settings.newPasswordPlaceholder')" autocomplete="off" />
              <input v-model="confirmPassword" type="password" class="w-full px-4 py-3 bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50" :placeholder="t('settings.confirmPasswordPlaceholder')" autocomplete="off" />
            </div>
            <p v-if="changeError" class="text-error text-sm font-medium mt-3">{{ changeError }}</p>
            <div class="flex gap-3 mt-6">
              <button @click="showChangeModal = false" class="flex-1 py-3 bg-surface-container-low rounded-full text-on-surface-variant font-semibold active:scale-[0.98] transition-transform">{{ t('common.cancel') }}</button>
              <button @click="submitNewPassword" :disabled="changeLoading" class="flex-1 py-3 primary-gradient rounded-full text-on-primary font-bold active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed">
                <span v-if="changeLoading" class="spinner-sm mr-1"></span>
                {{ t('settings.confirmChange') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Language selection modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showLanguageModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showLanguageModal = false" />
          <div class="relative bg-surface-container-lowest rounded-lg p-6 w-full max-w-sm shadow-xl">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">language</span>
              </div>
              <h3 class="font-headline text-lg font-bold text-on-surface">{{ t('settings.languageModalTitle') }}</h3>
            </div>

            <div class="flex flex-col gap-2">
              <button
                v-for="opt in languageOptions"
                :key="opt.code"
                class="flex items-center justify-between px-4 py-3 rounded-lg transition-colors active:scale-[0.98]"
                :class="opt.code === locale ? 'bg-primary/10 text-primary font-bold' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'"
                @click="handleLanguageSelect(opt.code)"
              >
                <span>{{ opt.label }}</span>
                <span v-if="opt.code === locale" class="material-symbols-outlined text-primary">check_circle</span>
              </button>
            </div>

            <div class="mt-6">
              <button @click="showLanguageModal = false" class="w-full py-3 bg-surface-container-low rounded-full text-on-surface-variant font-semibold active:scale-[0.98] transition-transform">{{ t('common.cancel') }}</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<style scoped>
.spinner-sm {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
