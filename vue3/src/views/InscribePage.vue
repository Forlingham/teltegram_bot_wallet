<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore } from '@/stores'
import { usePriceStore } from '@/stores/price'
import { useTransaction, satsToScash, satsToScashTrimmed } from '@/composables/useTransaction'
import { useTelegram } from '@/composables/useTelegram'
import { useI18n } from '@/i18n'
import PasswordModal from '@/components/PasswordModal.vue'

const router = useRouter()
const walletStore = useWalletStore()
const priceStore = usePriceStore()
const tx = useTransaction()
const { submitting } = tx
const { showAlert } = useTelegram()
const { t } = useI18n()

const content = ref('')
const showPreview = ref(false)
const showPassword = ref(false)
const errorMsg = ref('')
const passwordError = ref('')

const estimateData = ref<{
  networkFeeSat: bigint
  dapCostSat: bigint
  arrFeeSat: bigint
  totalSat: bigint | null
} | null>(null)

const fiatEstimate = computed(() => {
  const price = priceStore.currentPrice
  if (!price || !estimateData.value?.totalSat) return ''
  const scashVal = Number(estimateData.value.totalSat) / 1e8
  return '≈ $' + (scashVal * price).toFixed(2) + ' USD'
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function debouncedUpdateEstimate() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(updateEstimate, 350)
}

async function updateEstimate() {
  const text = content.value.trim()
  if (!text) {
    estimateData.value = null
    return
  }
  try {
    const est = await tx.estimate('0', text)
    estimateData.value = {
      networkFeeSat: est.networkFeeSat,
      dapCostSat: est.dapCostSat,
      arrFeeSat: est.arrFeeSat,
      totalSat: est.dapCostSat + est.networkFeeSat + est.arrFeeSat,
    }
  } catch {
    estimateData.value = null
  }
}

function handleSubmit() {
  errorMsg.value = ''
  passwordError.value = ''
  if (!content.value.trim()) {
    errorMsg.value = t('inscribe.errorEmpty')
    return
  }
  showPassword.value = true
}

async function handlePasswordConfirm(password: string) {
  errorMsg.value = ''
  passwordError.value = ''
  try {
    const txid = await tx.inscribe(password, content.value.trim())
    showPassword.value = false
    await showAlert(t('inscribe.successAlert', { txid }))
    router.push('/wallet/history')
  } catch (e: any) {
    const msg = e?.message || t('common.operationFailed')
    errorMsg.value = msg
    passwordError.value = msg
  }
}
</script>

<template>
  <div class="space-y-6 px-4 pb-6">
    <!-- Balance -->
    <section class="bg-surface-container-low rounded-lg p-4 flex items-center gap-3">
      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary">
        <span class="material-symbols-outlined text-lg">account_balance_wallet</span>
      </div>
      <div class="flex-1">
        <p class="text-[10px] text-on-surface-variant uppercase tracking-wider">{{ t('inscribe.availableBalance') }}</p>
        <p class="text-sm font-bold text-on-surface flex items-center gap-1">
          {{ walletStore.confirmedSats !== undefined ? satsToScash(walletStore.confirmedSats + walletStore.unconfirmedSats) : '-' }}
          <img src="/img/logo-128x128.png" class="w-4 h-4 object-contain" alt="SCASH" />
        </p>
      </div>
    </section>

    <!-- Content input -->
    <section class="space-y-3">
      <label class="font-headline font-bold text-sm text-on-surface-variant px-2">{{ t('inscribe.contentLabel') }}</label>
      <textarea
        v-model="content"
        class="w-full p-3 bg-surface-container-low border-none rounded-DEFAULT focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm resize-none placeholder:text-outline text-on-surface"
        :placeholder="t('inscribe.contentPlaceholder')"
        rows="6"
        @input="debouncedUpdateEstimate"
      ></textarea>
      <div class="flex justify-between items-center">
        <p class="text-[11px] text-on-surface-variant">{{ t('inscribe.charCount', { count: content.length }) }}</p>
        <button
          class="px-3 py-1.5 bg-surface-container-low text-on-surface-variant text-xs font-bold rounded-full hover:bg-surface-container-lowest transition-colors"
          @click="showPreview = true"
          :disabled="!content.trim()"
        >{{ t('inscribe.preview') }}</button>
      </div>
    </section>

    <!-- Fee estimate -->
    <section v-if="estimateData" class="bg-surface-container-low rounded-lg p-6 space-y-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-sm text-primary" style="font-variation-settings: 'FILL' 1;">analytics</span>
        <h3 class="font-headline font-bold text-sm text-on-surface">{{ t('inscribe.feeTitle') }}</h3>
      </div>
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-sm text-on-surface-variant font-medium">{{ t('inscribe.feeDap') }}</span>
          <span class="text-sm text-on-surface font-bold">{{ satsToScashTrimmed(estimateData.dapCostSat) }} SCASH</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-on-surface-variant font-medium">{{ t('inscribe.feeNetwork') }}</span>
          <span class="text-sm text-tertiary font-bold">{{ satsToScashTrimmed(estimateData.networkFeeSat) }} SCASH</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-on-surface-variant font-medium">{{ t('inscribe.feeArr') }}</span>
          <span class="text-sm text-on-surface-variant font-bold">{{ satsToScashTrimmed(estimateData.arrFeeSat) }} SCASH</span>
        </div>
      </div>
      <div class="pt-4 mt-2 border-t border-outline-variant/10 flex justify-between items-center">
        <span class="text-sm font-bold text-on-surface">{{ t('inscribe.feeTotal') }}</span>
        <div class="text-right">
          <span class="text-lg font-headline font-extrabold text-primary">{{ estimateData.totalSat ? satsToScashTrimmed(estimateData.totalSat) + ' SCASH' : '-' }}</span>
          <p class="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">{{ fiatEstimate || '≈ - USD' }}</p>
        </div>
      </div>
    </section>

    <div v-if="errorMsg" class="text-error text-center text-sm">{{ errorMsg }}</div>

    <!-- Submit -->
    <footer>
      <button
        class="w-full signature-gradient h-16 rounded-full flex items-center justify-center gap-3 ambient-shadow hover:scale-[0.98] active:scale-95 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!content.trim() || submitting"
        @click="handleSubmit"
      >
        <span v-if="submitting" class="spinner-sm mr-1"></span>
        <span v-else class="text-white font-headline font-extrabold text-lg">{{ t('inscribe.submit') }}</span>
        <span v-if="!submitting" class="material-symbols-outlined text-white text-xl">edit_note</span>
      </button>
    </footer>

    <!-- Preview modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showPreview" class="fixed inset-0 z-[100] flex items-center justify-center p-4" @click.self="showPreview = false">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showPreview = false" />
          <div class="relative bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-auto shadow-xl">
            <div class="flex justify-between items-center mb-4">
              <h3 class="font-headline text-lg font-bold text-on-surface">{{ t('inscribe.previewTitle') }}</h3>
              <button @click="showPreview = false" class="text-on-surface-variant hover:text-on-surface">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            <div class="prose prose-sm max-w-none text-on-surface whitespace-pre-wrap break-words">{{ content }}</div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <PasswordModal
      v-model:modelValue="showPassword"
      :title="t('inscribe.passwordTitle')"
      :confirm-text="t('inscribe.passwordConfirm')"
      :loading="submitting"
      :error-message="passwordError"
      @confirm="handlePasswordConfirm"
    />
  </div>
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
