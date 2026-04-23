import { ref } from 'vue'
import { useWalletStore, type WalletBackup } from '@/stores/wallet'
import { useNetworkStore } from '@/stores/network'
import { useCrypto } from '@/composables/useCrypto'
import { api } from '@/api'

const NETWORK_FEE_SAT = 10000n

const APP_FEE_TIERS = [
  { min: 0, max: 1, fee: 0.00012 },
  { min: 1, max: 10, fee: 0.01002 },
  { min: 10, max: 50, fee: 0.05002 },
  { min: 50, max: 100, fee: 0.10002 },
  { min: 100, max: 500, fee: 0.20002 },
  { min: 500, max: 1000, fee: 0.40002 },
  { min: 1000, max: 5000, fee: 0.80002 },
  { min: 5000, max: 10000, fee: 1.00002 },
  { min: 10000, max: Infinity, fee: 1.30002 },
]

export function satsToScash(sats: bigint): string {
  const sign = sats < 0n ? '-' : ''
  const abs = sats < 0n ? -sats : sats
  const whole = abs / 100000000n
  const frac = (abs % 100000000n).toString().padStart(8, '0')
  return sign + whole.toString() + '.' + frac
}

export function satsToScashTrimmed(sats: bigint): string {
  const full = satsToScash(sats)
  return full.replace(/\.?0+$/, '') || '0'
}

export function parseScashToSats(value: string): bigint | null {
  const s = (value || '').trim()
  if (!/^\d+(\.\d{1,8})?$/.test(s)) return null
  const parts = s.split('.')
  const whole = BigInt(parts[0] || '0')
  const frac = ((parts[1] || '') + '00000000').slice(0, 8)
  return whole * 100000000n + BigInt(frac)
}

export function calcArrFeeSat(amountScash: string): bigint {
  const amt = parseFloat(amountScash)
  if (isNaN(amt) || amt <= 0) return 0n
  for (const tier of APP_FEE_TIERS) {
    if (amt >= tier.min && amt < tier.max) {
      return BigInt(Math.round(tier.fee * 1e8))
    }
  }
  return 0n
}

export interface DapOutput {
  address: string
  value: number
}

export interface EstimateResult {
  amountSat: bigint | null
  arrFeeSat: bigint
  dapCostSat: bigint
  totalSat: bigint | null
  networkFeeSat: bigint
}

export function useTransaction() {
  const walletStore = useWalletStore()
  const networkStore = useNetworkStore()
  const { decryptMnemonic, buildTransaction } = useCrypto()

  const submitting = ref(false)
  const estimating = ref(false)

  function getExplorerBaseUrl(): string {
    return networkStore.appEnv === 'production'
      ? 'https://explorer.scash.network'
      : 'http://38.76.197.97:3001'
  }

  function getTxExplorerUrl(txid: string): string {
    return getExplorerBaseUrl().replace(/\/$/, '') + '/tx/' + encodeURIComponent(txid)
  }

  async function getBackup(password: string): Promise<string> {
    let backupData: WalletBackup | null = walletStore.backup
    if (!backupData) {
      const data = await api.post<{ backup: WalletBackup | null }>('/api/wallet/recover', {})
      if (!data.backup) throw new Error('未找到钱包备份')
      backupData = data.backup
      walletStore.saveBackup(backupData)
    }
    return decryptMnemonic(backupData, password)
  }

  async function fetchDapOutputs(message: string): Promise<{ outputs: DapOutput[]; totalSats: number }> {
    return api.post('/api/redpacket/dap/outputs', { message })
  }

  async function estimate(
    amountScash: string,
    message?: string,
  ): Promise<EstimateResult> {
    estimating.value = true
    try {
      const amountSat = parseScashToSats(amountScash)
      const arrFeeSat = calcArrFeeSat(amountScash)

      if (!amountSat || amountSat <= 0n) {
        return { amountSat: null, arrFeeSat: 0n, dapCostSat: 0n, totalSat: null, networkFeeSat: NETWORK_FEE_SAT }
      }

      let dapCostSat = 0n
      if (message) {
        try {
          const dapRes = await fetchDapOutputs(message)
          dapCostSat = BigInt(dapRes.totalSats || 0)
        } catch {
          dapCostSat = 0n
        }
      }

      const totalSat = amountSat + arrFeeSat + NETWORK_FEE_SAT + dapCostSat
      return { amountSat, arrFeeSat, dapCostSat, totalSat, networkFeeSat: NETWORK_FEE_SAT }
    } finally {
      estimating.value = false
    }
  }

  async function send(
    password: string,
    toAddress: string,
    amountScash: string,
    message?: string,
  ): Promise<string> {
    submitting.value = true
    try {
      const mnemonic = await getBackup(password)

      const balanceData = await walletStore.fetchBalance()
      if (!balanceData) throw new Error('获取余额失败')

      const allUtxos = balanceData.utxos
      const candidateUtxos = [
        ...allUtxos.filter((u) => !u.isUnconfirmed),
        ...allUtxos.filter((u) => u.isUnconfirmed),
      ]

      if (candidateUtxos.length === 0) throw new Error('没有可用的 UTXO')

      const amountSat = parseScashToSats(amountScash)
      if (!amountSat || amountSat <= 0n) throw new Error('金额格式不正确')

      const arrFeeSat = calcArrFeeSat(amountScash)
      const arrFeeAddress = networkStore.arrFeeAddress

      const outputs: { address: string; value: bigint }[] = [
        { address: toAddress, value: amountSat },
      ]
      if (arrFeeAddress && arrFeeSat > 0n) {
        outputs.push({ address: arrFeeAddress, value: arrFeeSat })
      }

      if (message) {
        const dapRes = await fetchDapOutputs(message)
        for (const o of dapRes.outputs) {
          outputs.push({ address: o.address, value: BigInt(o.value) })
        }
      }

      const utxoInputs = candidateUtxos.map((u) => ({
        txid: u.txid,
        vout: u.vout,
        amount: String(u.amount),
      }))

      const txHex = await buildTransaction(mnemonic, utxoInputs, outputs, NETWORK_FEE_SAT)
      const result = await api.post<{ txid: string }>('/api/wallet/broadcast', { hex: txHex })
      return result.txid
    } finally {
      submitting.value = false
    }
  }

  async function inscribe(
    password: string,
    content: string,
  ): Promise<string> {
    submitting.value = true
    try {
      const mnemonic = await getBackup(password)
      const balanceData = await walletStore.fetchBalance()
      if (!balanceData) throw new Error('获取余额失败')

      const allUtxos2 = balanceData.utxos
      const candidateUtxos = [
        ...allUtxos2.filter((u) => !u.isUnconfirmed),
        ...allUtxos2.filter((u) => u.isUnconfirmed),
      ]

      if (candidateUtxos.length === 0) throw new Error('没有可用的 UTXO')

      const dapRes = await fetchDapOutputs(content)

      const outputs: { address: string; value: bigint }[] = []
      for (const o of dapRes.outputs) {
        outputs.push({ address: o.address, value: BigInt(o.value) })
      }

      const arrFeeSat = calcArrFeeSat('0')
      const arrFeeAddress = networkStore.arrFeeAddress
      if (arrFeeAddress && arrFeeSat > 0n) {
        outputs.push({ address: arrFeeAddress, value: arrFeeSat })
      }

      const utxoInputs = candidateUtxos.map((u) => ({
        txid: u.txid,
        vout: u.vout,
        amount: String(u.amount),
      }))

      const txHex = await buildTransaction(mnemonic, utxoInputs, outputs, NETWORK_FEE_SAT)
      const result = await api.post<{ txid: string }>('/api/wallet/broadcast', { hex: txHex })
      return result.txid
    } finally {
      submitting.value = false
    }
  }

  function formatTime(iso: string): string {
    if (!iso) return '-'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  function formatTxid(txid: string): string {
    if (!txid) return '-'
    if (txid.length <= 20) return txid
    return txid.slice(0, 6) + '...' + txid.slice(-6)
  }

  function formatAmount(num: number | string): string {
    const n = Number(num)
    if (isNaN(n)) return '0.00'
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return {
    NETWORK_FEE_SAT,
    submitting,
    estimating,
    satsToScash,
    satsToScashTrimmed,
    parseScashToSats,
    calcArrFeeSat,
    estimate,
    send,
    inscribe,
    getBackup,
    getTxExplorerUrl,
    formatTime,
    formatTxid,
    formatAmount,
  }
}