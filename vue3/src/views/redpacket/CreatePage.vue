<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useWalletStore } from '@/stores'
import { useNetworkStore } from '@/stores/network'
import { usePriceStore } from '@/stores/price'
import { useTelegram } from '@/composables/useTelegram'
import { useCrypto, buildDapOutputs } from '@/composables/useCrypto'
import { useTransaction, satsToScash, satsToScashTrimmed, parseScashToSats } from '@/composables/useTransaction'
import { api } from '@/api'
import PasswordModal from '@/components/PasswordModal.vue'
import ShareSheet from '@/components/ShareSheet.vue'
import QrcodeVue from 'qrcode.vue'

const walletStore = useWalletStore()
const networkStore = useNetworkStore()
const priceStore = usePriceStore()
const tg = useTelegram()
const { deriveAddress, bytesToHex, buildTransaction } = useCrypto()
const tx = useTransaction()

const NETWORK_FEE_SAT = 10000n
const FEE_RESERVE_PER_PACKET_SAT = 100000n
const ARR_FEE_SAT = 322000n
const MAX_PACKET_COUNT = 200
const MAX_TOTAL_SCASH = 1000000

const redpacketType = ref<'RANDOM' | 'EQUAL'>('RANDOM')
const totalAmount = ref('')
const count = ref(1)
const message = ref('')
const expireSeconds = ref(86400)

const showConfirm = ref(false)
const showPassword = ref(false)
const showSuccess = ref(false)
const submitting = ref(false)
const errorMsg = ref('')
const passwordError = ref('')

const successPacketHash = ref('')
const successTotal = ref('')
const successShareUrl = ref('')
const successTxid = ref('')

const availableBalance = computed(() => walletStore.confirmedSats + walletStore.unconfirmedSats)

const expireOptions = computed(() => {
  const opts = [
    { value: 86400, label: '24小时' },
    { value: 604800, label: '7天' },
    { value: 31536000, label: '永久' },
  ]
  if (networkStore.appEnv !== 'production') {
    opts.unshift({ value: 180, label: '3分钟' })
  }
  return opts
})

const estimateData = ref<{
  amountSat: bigint | null
  reserveSat: bigint
  arrFeeSat: bigint
  dapCostSat: bigint
  totalSat: bigint | null
} | null>(null)

const fiatEstimate = computed(() => {
  const price = priceStore.currentPrice
  if (!price || !estimateData.value?.amountSat) return ''
  const scashVal = Number(estimateData.value.amountSat) / 1e8
  return '≈ $' + (scashVal * price).toFixed(2) + ' USD'
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedEstimate() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(updateEstimate, 350)
}

async function updateEstimate() {
  const total = totalAmount.value.trim()
  const totalSat = parseScashToSats(total)
  const countInt = count.value
  const reserveSat = BigInt(countInt) * FEE_RESERVE_PER_PACKET_SAT

  if (!totalSat || totalSat <= 0n) {
    estimateData.value = null
    return
  }

  const arrFeeSat = ARR_FEE_SAT
  const blessMessage = message.value.trim() || '恭喜发财，大吉大利'

  const dapMessage = JSON.stringify({
    type: 'RED_PACKET',
    data: {
      action: 'CREATE',
      packetHash: 'preview_preview_preview_preview',
      senderAddress: 'preview',
      senderTelegramUsername: tg.getTgUser()?.username || null,
      amount: total,
      count: countInt,
      blessMessage,
      strategy: redpacketType.value,
    },
  })

  try {
    const dapRes = buildDapOutputs(dapMessage)
    const dapCostSat = BigInt(dapRes.totalSats || 0)
    const totalNeedSat = totalSat + reserveSat + arrFeeSat + NETWORK_FEE_SAT + dapCostSat
    estimateData.value = { amountSat: totalSat, reserveSat, arrFeeSat, dapCostSat, totalSat: totalNeedSat }
  } catch {
    estimateData.value = { amountSat: totalSat, reserveSat, arrFeeSat: ARR_FEE_SAT, dapCostSat: 0n, totalSat: null }
  }
}

function validate(): { ok: boolean; message?: string; totalSat?: bigint; countInt?: number } {
  const total = totalAmount.value.trim()
  const totalSat = parseScashToSats(total)
  const countInt = count.value

  if (!total) return { ok: false, message: '请输入红包总金额' }
  if (!totalSat || totalSat <= 0n) return { ok: false, message: '金额格式不正确' }
  if (parseFloat(total) > MAX_TOTAL_SCASH) return { ok: false, message: '金额过大，请分批发送' }
  if (!countInt || countInt <= 0) return { ok: false, message: '请输入有效红包个数' }
  if (countInt > MAX_PACKET_COUNT) return { ok: false, message: `红包个数最多 ${MAX_PACKET_COUNT} 个` }
  if (Array.from(message.value.trim()).length > 14) return { ok: false, message: '祝福语最多 14 个字' }

  // Check per-packet minimum (each packet should get at least 0.00000001 SCASH = 1 sat)
  const perPacketSat = totalSat / BigInt(countInt)
  if (perPacketSat < 100000n) return { ok: false, message: '每个红包最低 0.001 SCASH，请增加总金额或减少个数' }

  // Check balance: total + reserve + arrFee + networkFee + dapCost
  const reserveSat = BigInt(countInt) * FEE_RESERVE_PER_PACKET_SAT
  const estimatedTotal = totalSat + reserveSat + ARR_FEE_SAT + NETWORK_FEE_SAT
  if (availableBalance.value > 0n && estimatedTotal > availableBalance.value) {
    return { ok: false, message: '可用SCASH不足' }
  }

  return { ok: true, totalSat, countInt }
}

async function handleSubmit() {
  errorMsg.value = ''
  const check = validate()
  if (!check.ok) {
    errorMsg.value = check.message!
    return
  }
  showConfirm.value = true
}

async function handleConfirmOk() {
  showConfirm.value = false
  passwordError.value = ''
  showPassword.value = true
}

async function handlePasswordConfirm(password: string) {
  errorMsg.value = ''
  passwordError.value = ''
  submitting.value = true

  try {
    const mnemonic = await tx.getBackup(password)
    const balanceData = await walletStore.fetchBalance()
    if (!balanceData) throw new Error('获取余额失败')

    const candidateUtxos = balanceData.utxos
      .filter((u) => !u.isUnconfirmed)
      .concat(balanceData.utxos.filter((u) => u.isUnconfirmed))
    if (candidateUtxos.length === 0) throw new Error('没有可用的 UTXO')

    const myAddress = deriveAddress(mnemonic)
    const senderUsername = tg.getTgUser()?.username || ''
    const blessMessage = message.value.trim() || '恭喜发财，大吉大利'

    const total = totalAmount.value.trim()
    const countInt = count.value
    const totalSat = parseScashToSats(total)!
    const feeReserveSat = BigInt(countInt) * FEE_RESERVE_PER_PACKET_SAT
    const poolTransferSat = totalSat + feeReserveSat
    const poolAddr = networkStore.poolAddress
    if (!poolAddr) throw new Error('未配置统筹地址')

    const seed = myAddress + ':' + Date.now() + ':' + Math.random().toString(36).slice(2)
    const packetHash = bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed)))).slice(0, 32)

    const dapMessage = JSON.stringify({
      type: 'RED_PACKET',
      data: {
        action: 'CREATE',
        packetHash,
        senderAddress: myAddress,
        senderTelegramUsername: senderUsername || null,
        amount: total,
        count: countInt,
        blessMessage,
        strategy: redpacketType.value,
      },
    })

    const dapRes = buildDapOutputs(dapMessage)
    const dapOutputs = dapRes.outputs || []
    const arrFeeAddress = networkStore.arrFeeAddress

    const allOutputs: { address: string; value: bigint }[] = []
    if (arrFeeAddress) allOutputs.push({ address: arrFeeAddress, value: ARR_FEE_SAT })
    allOutputs.push({ address: poolAddr, value: poolTransferSat })
    for (const o of dapOutputs) {
      allOutputs.push({ address: o.address, value: BigInt(o.value) })
    }

    const utxoInputs = candidateUtxos.map((u) => ({ txid: u.txid, vout: u.vout, amount: String(u.amount) }))
    const hex = await buildTransaction(mnemonic, utxoInputs, allOutputs, NETWORK_FEE_SAT)
    const broadcastResult = await api.post<{ txid: string }>('/api/wallet/broadcast', { hex })

    const botUsername = networkStore.appEnv === 'production' ? 'SCASH_Wallet_bot' : 'scash_red_envelope_bot'
    const shareUrl = `https://t.me/${botUsername}/open1?startapp=${encodeURIComponent('rp_' + packetHash)}`

    await api.post('/api/redpacket/create', {
      type: redpacketType.value,
      totalAmount: total,
      count: countInt,
      message: blessMessage,
      txid: broadcastResult.txid,
      packetHash,
      senderAddress: myAddress,
      feeReserve: satsToScash(feeReserveSat),
      expireSeconds: expireSeconds.value,
    })

    successTotal.value = total
    successPacketHash.value = packetHash
    successShareUrl.value = shareUrl
    successTxid.value = broadcastResult.txid
    showPassword.value = false
    showSuccess.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e: any) {
    const msg = e?.message || '操作失败'
    errorMsg.value = msg
    passwordError.value = msg
  } finally {
    submitting.value = false
  }
}

function shareToChat() {
  const shareText = '🧧 我发了一个SCASH红包，快来领取！'
  const shareIntent = `https://t.me/share/url?url=${encodeURIComponent(successShareUrl.value)}&text=${encodeURIComponent(shareText)}`
  const webApp = (window as any).Telegram?.WebApp
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(shareIntent)
  } else {
    window.location.href = shareIntent
  }
}

const showShareSheet = ref(false)

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {}
}

function getTxExplorerUrl(txid: string): string {
  const base = networkStore.appEnv === 'production'
    ? 'https://explorer.scash.network'
    : 'http://38.76.197.97:3001'
  return base.replace(/\/$/, '') + '/tx/' + encodeURIComponent(txid)
}

onMounted(async () => {
  submitting.value = false // safety reset
  await walletStore.fetchBalance()
  priceStore.fetchPrice()
})
</script>

<template>
  <div>
    <!-- Main form (hidden on success) -->
    <div v-if="!showSuccess" class="space-y-4 px-4 pb-6">
      <!-- Balance -->
      <section class="relative overflow-hidden p-4 rounded-lg bg-surface-container-low">
        <div class="absolute -right-8 -top-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="relative z-10 flex justify-between items-center">
          <div>
            <span class="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-0.5 block">可用余额</span>
            <div class="flex items-baseline gap-1">
              <span class="font-headline text-xl font-bold text-on-surface">{{ satsToScash(availableBalance) }}</span>
              <span class="text-xs font-medium text-primary">SCASH</span>
            </div>
          </div>
          <div class="p-2.5 bg-surface-container-lowest rounded-full shadow-[0px_4px_16px_rgba(145,40,173,0.06)]">
            <span class="material-symbols-outlined text-primary text-xl" style="font-variation-settings: 'FILL' 1;">account_balance_wallet</span>
          </div>
        </div>
      </section>

      <!-- Type selector -->
      <section class="grid grid-cols-2 gap-3">
        <button
          :class="redpacketType === 'RANDOM' ? 'bg-surface-container-lowest shadow-[0px_8px_24px_rgba(0,0,0,0.04)] border-primary/20 opacity-100' : 'bg-surface-container-low border-transparent opacity-60'"
          class="flex flex-col items-center justify-center p-3.5 rounded-lg border-2 transition-all"
          @click="redpacketType = 'RANDOM'; debouncedEstimate()"
        >
          <span class="material-symbols-outlined mb-1.5 text-2xl" :class="redpacketType === 'RANDOM' ? 'text-primary' : 'text-on-surface-variant'">casino</span>
          <span class="text-xs font-bold" :class="redpacketType === 'RANDOM' ? 'text-on-surface' : 'text-on-surface-variant'">拼手气红包</span>
        </button>
        <button
          :class="redpacketType === 'EQUAL' ? 'bg-surface-container-lowest shadow-[0px_8px_24px_rgba(0,0,0,0.04)] border-primary/20 opacity-100' : 'bg-surface-container-low border-transparent opacity-60'"
          class="flex flex-col items-center justify-center p-3.5 rounded-lg border-2 transition-all"
          @click="redpacketType = 'EQUAL'; debouncedEstimate()"
        >
          <span class="material-symbols-outlined mb-1.5 text-2xl" :class="redpacketType === 'EQUAL' ? 'text-primary' : 'text-on-surface-variant'">equalizer</span>
          <span class="text-xs font-bold" :class="redpacketType === 'EQUAL' ? 'text-on-surface' : 'text-on-surface-variant'">普通红包</span>
        </button>
      </section>

      <!-- Amount & Count -->
      <section class="space-y-3">
        <div class="p-4 rounded-lg bg-surface-container-lowest shadow-[0px_4px_16px_rgba(44,47,49,0.02)]">
          <div class="flex justify-between items-center mb-2">
            <label class="text-xs font-bold text-on-surface-variant">总金额</label>
            <span class="text-[10px] font-semibold text-primary uppercase">SCASH</span>
          </div>
          <div class="flex items-center gap-3 relative">
            <input v-model="totalAmount" class="w-full bg-transparent border-none focus:ring-0 p-0 font-headline text-3xl font-bold text-on-surface placeholder:text-surface-variant" placeholder="0.00" type="text" autocomplete="off" @input="debouncedEstimate" />
            <div class="absolute right-0 bottom-1 text-xs text-on-surface-variant">{{ fiatEstimate }}</div>
          </div>
        </div>
        <div class="p-4 rounded-lg bg-surface-container-lowest shadow-[0px_4px_16px_rgba(44,47,49,0.02)]">
          <div class="flex justify-between items-center mb-2">
            <label class="text-xs font-bold text-on-surface-variant">红包个数</label>
            <span class="text-[10px] font-semibold text-on-surface-variant">个</span>
          </div>
          <input v-model.number="count" class="w-full bg-transparent border-none focus:ring-0 p-0 font-headline text-3xl font-bold text-on-surface placeholder:text-surface-variant" placeholder="0" type="number" min="1" autocomplete="off" @input="debouncedEstimate" />
        </div>
      </section>

      <!-- Settings -->
      <section class="space-y-3">
        <div class="text-[9px] font-extrabold uppercase tracking-widest text-on-surface-variant/70 px-1">红包设置</div>
        <div class="rounded-lg bg-surface-container-low overflow-hidden">
          <div class="flex items-center justify-between p-4 bg-surface-container-lowest mb-[1px]">
            <span class="text-xs font-semibold text-on-surface">留言</span>
            <div class="flex items-center gap-2 flex-1 ml-4">
              <input v-model="message" class="w-full text-right bg-transparent border-none focus:ring-0 p-0 text-xs text-on-surface placeholder:text-on-surface-variant/40" placeholder="恭喜发财，万事如意" type="text" maxlength="14" @input="debouncedEstimate" />
            </div>
          </div>
          <div class="p-4 bg-surface-container-lowest mb-[1px]">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-semibold text-on-surface">有效期</span>
              <span class="text-[10px] text-primary font-bold">{{ expireOptions.find(o => o.value === expireSeconds)?.label || '24小时' }}</span>
            </div>
            <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                v-for="opt in expireOptions"
                :key="opt.value"
                :class="expireSeconds === opt.value ? 'signature-gradient text-white' : 'bg-surface-container-low text-on-surface-variant'"
                class="whitespace-nowrap px-3.5 py-1.5 rounded-full text-[10px] font-bold"
                @click="expireSeconds = opt.value"
              >{{ opt.label }}</button>
            </div>
          </div>
          <div class="p-4 bg-surface-container-lowest">
            <span class="text-xs font-semibold text-on-surface block mb-3">红包封面</span>
            <div class="text-on-surface-variant text-xs">暂无可用封面</div>
          </div>
        </div>
      </section>

      <!-- Estimate -->
      <section v-if="estimateData" class="p-4 rounded-lg bg-surface-container-low/50 border border-outline-variant/20">
        <div class="mb-3">
          <h3 class="text-xs font-bold text-on-surface-variant">费用预估</h3>
        </div>
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-[10px] text-on-surface-variant">红包金额</span>
            <span class="text-[10px] font-medium text-on-surface">{{ estimateData.amountSat ? satsToScash(estimateData.amountSat) : '-' }} SCASH</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-[10px] text-on-surface-variant">统筹预留</span>
            <span class="text-[10px] font-medium text-on-surface">{{ satsToScash(estimateData.reserveSat) }} SCASH</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-[10px] text-on-surface-variant">链上手续费</span>
            <span class="text-[10px] font-medium text-on-surface">{{ satsToScashTrimmed(NETWORK_FEE_SAT) }} SCASH</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-[10px] text-on-surface-variant">应用手续费</span>
            <span class="text-[10px] font-medium text-on-surface">{{ satsToScashTrimmed(ARR_FEE_SAT) }} SCASH</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-[10px] text-on-surface-variant">DAP 上链</span>
            <span class="text-[10px] font-medium text-on-surface">{{ estimateData.dapCostSat ? satsToScashTrimmed(estimateData.dapCostSat) + ' SCASH' : '计算中…' }}</span>
          </div>
          <div class="pt-2 mt-1 border-t border-outline-variant/10 flex justify-between items-baseline">
            <span class="text-xs font-bold text-on-surface">预计总支出</span>
            <span class="text-base font-black text-primary">{{ estimateData.totalSat ? satsToScashTrimmed(estimateData.totalSat) + ' SCASH' : '-' }}</span>
          </div>
        </div>
      </section>

      <div v-if="errorMsg" class="text-error text-center text-sm">{{ errorMsg }}</div>

      <!-- Submit -->
      <button
        class="w-full h-14 rounded-full signature-gradient flex items-center justify-center gap-3 shadow-[0px_12px_24px_rgba(145,40,173,0.25)] active:scale-95 transition-transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="submitting"
        @click="handleSubmit"
      >
        <span v-if="submitting" class="spinner-sm mr-1"></span>
        <template v-else>
          <span class="material-symbols-outlined text-white text-on-primary text-xl" style="font-variation-settings: 'FILL' 1;">send</span>
          <span class="font-headline font-bold text-white text-base tracking-wide">确认生成红包</span>
        </template>
      </button>
    </div>

    <!-- Success screen -->
    <div v-if="showSuccess" class="min-h-screen flex flex-col items-center px-4 py-6 relative overflow-hidden">
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[500px] bg-[radial-gradient(circle,rgba(145,40,173,0.15)_0%,rgba(245,247,249,0)_70%)] -z-10"></div>

      <div class="flex items-center justify-between mb-6 relative w-full max-w-md px-2">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-surface-container-lowest rounded-full shadow-[0px_12px_32px_rgba(44,47,49,0.06)] flex items-center justify-center relative">
            <span class="material-symbols-outlined text-primary text-2xl" style="font-variation-settings: 'FILL' 1;">celebration</span>
          </div>
          <div class="text-left">
            <h1 class="font-headline font-extrabold text-xl tracking-tight text-on-surface">红包已发送!</h1>
            <p class="text-xs text-on-surface-variant">{{ successTotal }} SCASH · {{ count }} 个</p>
          </div>
        </div>
        <div class="bg-white p-1.5 rounded-lg shadow-sm border border-outline-variant/10 shrink-0">
          <QrcodeVue
            :value="successShareUrl"
            :size="72"
            level="M"
            render-as="canvas"
            class="poster-qr-code"
          />
        </div>
      </div>

      <div class="w-full max-w-md space-y-4">
        <!-- Share button (top) -->
        <button class="w-full h-12 signature-gradient text-white font-headline font-bold rounded-full flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform" @click="shareToChat">
          <span class="material-symbols-outlined text-lg">send</span>
          分享到聊天
        </button>

        <!-- Transaction ID -->
        <div class="bg-surface-container-lowest p-4 rounded-lg shadow-[0px_12px_32px_rgba(44,47,49,0.04)]">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] text-on-surface-variant uppercase tracking-widest">交易 ID</span>
            <a
              v-if="successTxid"
              :href="getTxExplorerUrl(successTxid)"
              target="_blank"
              class="text-[10px] text-primary font-medium flex items-center gap-0.5 hover:underline"
            >
              查看区块
              <span class="material-symbols-outlined text-[10px]">open_in_new</span>
            </a>
          </div>
          <div class="flex items-center gap-2 bg-surface p-2 rounded-lg">
            <span class="text-[11px] text-on-surface-variant font-mono truncate flex-1">{{ successTxid || successPacketHash }}</span>
            <button class="text-primary hover:scale-110 active:scale-95 transition-transform flex-shrink-0" @click="copyToClipboard(successTxid || successPacketHash)">
              <span class="material-symbols-outlined text-sm">content_copy</span>
            </button>
          </div>
        </div>

        <!-- Share link -->
        <div class="bg-surface-container-lowest p-4 rounded-lg shadow-[0px_12px_32px_rgba(44,47,49,0.04)]">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 flex-shrink-0 bg-primary-container/20 rounded-full flex items-center justify-center">
              <span class="material-symbols-outlined text-primary text-base" style="font-variation-settings: 'FILL' 1;">link</span>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-headline font-bold text-on-surface text-sm">专属领取链接</h3>
              <p class="text-[10px] text-on-surface-variant">点击复制或长按分享</p>
            </div>
            <button
              class="h-8 px-3 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center gap-1 active:scale-95 transition-transform"
              @click="openShareSheet"
            >
              <span class="material-symbols-outlined text-sm" style="font-variation-settings: 'FILL' 1;">share</span>
              分享
            </button>
          </div>
          <div
            class="bg-surface p-3 rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors select-all"
            @click="copyToClipboard(successShareUrl)"
          >
            <p class="text-xs text-primary font-medium break-all leading-relaxed">{{ successShareUrl }}</p>
          </div>
        </div>

        <router-link to="/wallet/redpacket" class="w-full h-12 bg-transparent border-2 border-outline-variant/20 text-on-surface-variant font-headline font-bold rounded-full flex items-center justify-center hover:bg-surface-container-low active:scale-[0.98] transition-all">
          返回红包中心
        </router-link>
      </div>
    </div>

    <!-- Confirm modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showConfirm" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showConfirm = false" />
          <div class="relative bg-surface-container-lowest rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div class="p-4 text-center shrink-0">
              <div class="inline-flex items-center justify-center w-10 h-10 bg-primary/5 rounded-full mb-2">
                <span class="material-symbols-outlined text-primary text-xl" style="font-variation-settings: 'FILL' 1;">redeem</span>
              </div>
              <h1 class="text-lg font-headline font-bold text-on-surface">确认红包信息</h1>
            </div>
            <div class="px-6 py-2 space-y-3 overflow-y-auto">
              <div class="bg-surface-container-low rounded-lg p-4 flex flex-col items-center justify-center">
                <div class="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">转账金额</div>
                <div class="flex items-baseline gap-1">
                  <span class="text-2xl font-headline font-extrabold text-on-surface">{{ totalAmount }}</span>
                  <span class="text-sm font-headline font-bold text-primary">SCASH</span>
                </div>
              </div>
              <div class="space-y-2 bg-surface p-3 rounded-lg text-xs">
                <div class="flex justify-between items-center">
                  <span class="text-on-surface-variant">红包类型</span>
                  <span class="text-on-surface font-semibold">{{ redpacketType === 'RANDOM' ? '拼手气红包' : '普通红包' }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-on-surface-variant">红包数量</span>
                  <span class="text-on-surface font-semibold">{{ count }} 个</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-on-surface-variant">祝福语</span>
                  <span class="text-on-surface font-semibold">{{ message || '恭喜发财，大吉大利' }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-on-surface-variant">有效期</span>
                  <span class="text-on-surface font-semibold">{{ expireOptions.find(o => o.value === expireSeconds)?.label || '24小时' }}</span>
                </div>
              </div>
              <div class="flex justify-between items-center px-2 pb-2">
                <span class="text-[10px] text-on-surface-variant">合计支出 (含手续费)</span>
                <span class="text-sm font-headline font-bold text-on-surface">{{ estimateData?.totalSat ? satsToScashTrimmed(estimateData.totalSat) + ' SCASH' : '-' }}</span>
              </div>
            </div>
            <div class="p-4 shrink-0 flex flex-col gap-2">
              <button class="w-full h-12 bg-gradient-to-r from-primary to-primary-container text-white rounded-full font-headline font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform flex items-center justify-center gap-2" @click="handleConfirmOk">
                <span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1;">verified_user</span>
                确认发送
              </button>
              <button class="w-full h-12 bg-surface-container-high text-on-surface-variant rounded-full font-headline font-semibold active:scale-[0.98] transition-transform" @click="showConfirm = false">取消</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <PasswordModal
      v-model:modelValue="showPassword"
      title="输入钱包密码"
      confirm-text="确认交易"
      :loading="submitting"
      :error-message="passwordError"
      @confirm="handlePasswordConfirm"
    />

    <ShareSheet
      v-model="showShareSheet"
      :share-url="successShareUrl"
      :amount="successTotal"
      :count="count"
      :message="message"
      :packet-hash="successPacketHash"
      :expire-seconds="expireSeconds"
    />
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.signature-gradient { background: linear-gradient(135deg, #9128ad 0%, #e67aff 100%); }
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
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-enter-active .animate-slide-up,
.sheet-leave-active .animate-slide-up {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .animate-slide-up,
.sheet-leave-to .animate-slide-up {
  transform: translateY(100%);
}
</style>