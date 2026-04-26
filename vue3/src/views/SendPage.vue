<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore } from '@/stores'
import { usePriceStore } from '@/stores/price'
import { useNetworkStore } from '@/stores/network'
import { useTransaction, satsToScash, satsToScashTrimmed, parseScashToSats, calcArrFeeSat } from '@/composables/useTransaction'
import { useTelegram } from '@/composables/useTelegram'
import PasswordModal from '@/components/PasswordModal.vue'

const router = useRouter()
const walletStore = useWalletStore()
const priceStore = usePriceStore()
const networkStore = useNetworkStore()
const tx = useTransaction()
const { submitting } = tx
const { showScanQr, showAlert } = useTelegram()

const address = ref('')
const amount = ref('')
const message = ref('')
const errorMsg = ref('')
const showPassword = ref(false)
const passwordError = ref('')

const NETWORK_FEE_SAT = 10000n

const availableBalance = computed(() => walletStore.confirmedSats + walletStore.unconfirmedSats)
const availableBalanceScash = computed(() => satsToScash(availableBalance.value))

const estimateData = ref<{
  amountSat: bigint | null
  arrFeeSat: bigint
  dapCostSat: bigint
  totalSat: bigint | null
  networkFeeSat: bigint
} | null>(null)

const fiatEstimate = computed(() => {
  const price = priceStore.currentPrice
  if (!price || !estimateData.value?.amountSat) return ''
  const scashVal = Number(estimateData.value.amountSat) / 1e8
  return '≈ $' + (scashVal * price).toFixed(2) + ' USD'
})

const totalFiatEstimate = computed(() => {
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
  const amt = amount.value.trim()
  if (!amt || !parseScashToSats(amt) || parseScashToSats(amt)! <= 0n) {
    estimateData.value = null
    return
  }
  try {
    estimateData.value = await tx.estimate(amt, message.value.trim() || undefined)
  } catch {
    estimateData.value = null
  }
}

function setMax() {
  const balanceSats = availableBalance.value
  if (balanceSats <= 0n) return
  const amountSat = balanceSats - NETWORK_FEE_SAT - calcArrFeeSat(satsToScash(balanceSats))
  if (amountSat <= 0n) return
  amount.value = satsToScashTrimmed(amountSat)
  debouncedUpdateEstimate()
}

async function handleScanQr() {
  try {
    const raw = await showScanQr('扫描收款地址二维码')
    let addr = raw.trim()

    // Handle URI schemes: scash:xxx, bcrt:xxx
    if (addr.includes(':')) {
      const parts = addr.split(':')
      addr = parts[1] || ''
    }

    // Strip query params (e.g. scash:xxx?amount=100)
    if (addr.includes('?')) {
      addr = addr.split('?')[0]
    }

    if (!addr) {
      await showAlert('未识别到有效地址')
      return
    }

    // Validate bech32 prefix
    const prefix = networkStore.bech32 || 'scash'
    if (!addr.startsWith(prefix + '1')) {
      await showAlert('地址格式不正确，请扫描 ' + prefix + ' 开头的地址')
      return
    }

    address.value = addr
    debouncedUpdateEstimate()
  } catch {}
}

function validateAddressFormat(addr: string): boolean {
  const prefix = networkStore.bech32 || 'scash'
  return addr.startsWith(prefix + '1') && addr.length > prefix.length + 5
}

function validate(): { ok: boolean; message?: string } {
  const addr = address.value.trim()
  if (!addr) return { ok: false, message: '请输入收款地址' }
  if (!validateAddressFormat(addr)) {
    const prefix = networkStore.bech32 || 'scash'
    return { ok: false, message: '地址格式不正确，请输入 ' + prefix + ' 开头的地址' }
  }
  const amt = amount.value.trim()
  if (!amt) return { ok: false, message: '请输入发送金额' }
  const amountSat = parseScashToSats(amt)
  if (!amountSat || amountSat <= 0n) return { ok: false, message: '金额格式不正确' }
  if (parseFloat(amt) <= 0) return { ok: false, message: '金额必须大于 0' }
  const totalNeed = amountSat + calcArrFeeSat(amt) + NETWORK_FEE_SAT + (estimateData.value?.dapCostSat ?? 0n)
  if (availableBalance.value > 0n && totalNeed > availableBalance.value) {
    return { ok: false, message: '余额不足' }
  }
  return { ok: true }
}

async function handleSubmit() {
  errorMsg.value = ''
  passwordError.value = ''
  const check = validate()
  if (!check.ok) {
    errorMsg.value = check.message!
    return
  }
  showPassword.value = true
}

async function handlePasswordConfirm(password: string) {
  errorMsg.value = ''
  passwordError.value = ''
  try {
    const txid = await tx.send(password, address.value.trim(), amount.value.trim(), message.value.trim() || undefined)
    showPassword.value = false
    await showAlert('发送成功！\nTxHash: ' + txid)
    router.push('/wallet/history')
  } catch (e: any) {
    const msg = e?.message || e?.status?.message || '发送失败'
    errorMsg.value = msg
    passwordError.value = msg
  }
}

onMounted(async () => {
  submitting.value = false // safety reset
  await walletStore.fetchBalance()
  priceStore.fetchPrice()

  const params = new URLSearchParams(window.location.search)
  const addrParam = params.get('address')
  if (addrParam) {
    address.value = addrParam
    debouncedUpdateEstimate()
  }
})
</script>

<template>
  <div class="space-y-6 px-4 pb-6">
    <!-- Address -->
    <section class="space-y-3">
      <div class="flex justify-between items-end px-2">
        <label class="font-headline font-bold text-sm text-on-surface-variant">收款地址</label>
      </div>
      <div class="flex gap-3">
        <input
          v-model="address"
          class="flex-1 h-14 px-6 bg-surface-container-high border-none rounded-DEFAULT focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all font-medium placeholder:text-outline text-on-surface"
          placeholder="粘贴收款方地址"
          type="text"
          autocomplete="off"
          @input="debouncedUpdateEstimate"
        />
        <button
          class="w-14 h-14 flex items-center justify-center bg-surface-container-lowest ambient-shadow rounded-DEFAULT hover:scale-95 active:scale-90 transition-transform"
          title="扫描二维码"
          @click="handleScanQr"
        >
          <span class="material-symbols-outlined text-primary">qr_code_scanner</span>
        </button>
      </div>
    </section>

    <!-- Amount -->
    <section class="space-y-3">
      <div class="flex justify-between items-end px-2">
        <label class="font-headline font-bold text-sm text-on-surface-variant">发送数量 (SCASH)</label>
        <span class="text-xs font-semibold text-tertiary">可用余额: {{ availableBalanceScash }}</span>
      </div>
      <div class="relative">
        <input
          v-model="amount"
          class="w-full h-20 px-8 bg-surface-container-lowest ambient-shadow border-none rounded-lg focus:ring-2 focus:ring-primary/20 transition-all text-3xl font-headline font-bold text-primary placeholder:text-surface-container-highest text-on-surface"
          placeholder="0.00000000"
          type="text"
          autocomplete="off"
          @input="debouncedUpdateEstimate"
        />
        <div class="absolute right-8 top-1/2 -translate-y-1/2 flex gap-2">
          <button
            class="px-3 py-1 bg-primary-container/20 text-primary font-bold text-[10px] rounded-full uppercase tracking-tighter hover:bg-primary-container/30 transition-colors"
            @click="setMax"
          >MAX</button>
        </div>
      </div>
      <div class="text-sm text-on-surface-variant font-medium px-2 min-h-[20px]">
        {{ fiatEstimate }}
      </div>
    </section>

    <!-- Message / DAP -->
    <section class="space-y-3">
      <label class="font-headline font-bold text-sm text-on-surface-variant px-2">留言 / DAP 数据 (选填)</label>
      <textarea
        v-model="message"
        class="w-full p-2 bg-surface-container-low border-none rounded-DEFAULT focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all font-medium resize-none placeholder:text-outline text-on-surface"
        placeholder="给收款方的留言，将上链永久保存"
        rows="3"
        maxlength="100"
        @input="debouncedUpdateEstimate"
      ></textarea>
    </section>

    <!-- Fee estimate -->
    <section v-if="estimateData" class="bg-surface-container-low rounded-lg p-6 space-y-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-sm text-primary" style="font-variation-settings: 'FILL' 1;">analytics</span>
        <h3 class="font-headline font-bold text-sm text-on-surface">费用预估 (实时)</h3>
      </div>
      <div class="space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-sm text-on-surface-variant font-medium">转账金额</span>
          <span class="text-sm text-on-surface font-bold font-headline">{{ estimateData.amountSat ? satsToScash(estimateData.amountSat) + ' SCASH' : '-' }}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-on-surface-variant font-medium">链上手续费</span>
          <span class="text-sm text-tertiary font-bold font-headline">{{ satsToScashTrimmed(estimateData.networkFeeSat) }} SCASH</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-on-surface-variant font-medium">应用手续费</span>
          <span class="text-sm text-tertiary font-bold font-headline">{{ satsToScashTrimmed(estimateData.arrFeeSat) }} SCASH</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-on-surface-variant font-medium">DAP 上链</span>
          <span class="text-sm text-on-surface font-bold font-headline">{{ estimateData.dapCostSat ? satsToScashTrimmed(estimateData.dapCostSat) + ' SCASH' : '0 SCASH' }}</span>
        </div>
      </div>
      <div class="pt-4 mt-2 border-t border-outline-variant/10 flex justify-between items-center">
        <span class="text-sm font-bold text-on-surface">预计总支出</span>
        <div class="text-right">
          <span class="text-lg font-headline font-extrabold text-primary">{{ estimateData.totalSat ? satsToScashTrimmed(estimateData.totalSat) + ' SCASH' : '-' }}</span>
          <p class="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">{{ totalFiatEstimate || '≈ - USD' }}</p>
        </div>
      </div>
    </section>

    <!-- Error -->
    <div v-if="errorMsg" class="text-error text-center text-sm">{{ errorMsg }}</div>

    <!-- Submit -->
    <footer class="pt-2">
      <button
        class="w-full signature-gradient h-16 rounded-full flex items-center justify-center gap-3 ambient-shadow hover:scale-[0.98] active:scale-95 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="submitting"
        @click="handleSubmit"
      >
        <span v-if="submitting" class="spinner-sm mr-1"></span>
        <span v-else class="text-white font-headline font-extrabold text-lg">确认发送</span>
        <span v-if="!submitting" class="material-symbols-outlined text-white text-xl group-hover:translate-x-1 transition-transform">send</span>
      </button>
      <div class="mt-6 flex flex-col items-center gap-4">
        <div class="flex items-center gap-2 px-4 py-2 bg-surface-container-high/50 rounded-full">
          <div class="w-2 h-2 rounded-full bg-tertiary animate-pulse"></div>
          <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Network Secure</span>
        </div>
      </div>
    </footer>

    <PasswordModal
      v-model:modelValue="showPassword"
      title="输入钱包密码"
      confirm-text="确认发送"
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
</style>