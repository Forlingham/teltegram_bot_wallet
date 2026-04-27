<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useWalletStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useNetworkStore } from '@/stores/network'
import { usePriceStore } from '@/stores/price'
import { useTelegram } from '@/composables/useTelegram'
import { useCrypto, buildDapOutputs } from '@/composables/useCrypto'
import { useTransaction, satsToScash, satsToScashTrimmed, parseScashToSats } from '@/composables/useTransaction'
import { api } from '@/api'
import PasswordModal from '@/components/PasswordModal.vue'
import QrcodeVue from 'qrcode.vue'

const walletStore = useWalletStore()
const authStore = useAuthStore()
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
const posterGenerating = ref(false)
const posterDataUrl = ref('')
const posterBlobUrl = ref('')
const showPosterPreview = ref(false)
const showFullscreenPoster = ref(false)

function openFullscreenPoster() {
  if (posterBlobUrl.value) showFullscreenPoster.value = true
}

function closeFullscreenPoster() {
  showFullscreenPoster.value = false
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {}
}

/**
 * Generate a share poster using Canvas.
 * The poster includes brand, redpacket info, QR code, and a call-to-action.
 */
async function generatePoster(): Promise<string> {
  const canvas = document.createElement('canvas')
  const width = 750
  const height = 1200
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  // Background
  ctx.fillStyle = '#f5f7f9'
  ctx.fillRect(0, 0, width, height)

  // Top brand bar
  ctx.fillStyle = '#9128ad'
  ctx.fillRect(0, 0, width, 160)

  // Brand text
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 48px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('SCASH 红包', width / 2, 95)

  ctx.font = '24px Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText('Blockchain Red Packet', width / 2, 135)

  // Card background
  const cardX = 50
  const cardY = 200
  const cardW = 650
  const cardH = 700
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardW, cardH, 24)
  ctx.fill()

  // Decorative circle
  ctx.fillStyle = 'rgba(145,40,173,0.08)'
  ctx.beginPath()
  ctx.arc(width - 80, cardY + 80, 60, 0, Math.PI * 2)
  ctx.fill()

  // Red packet emoji
  ctx.font = '80px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('🧧', width / 2, cardY + 110)

  // Amount
  ctx.fillStyle = '#dc2626'
  ctx.font = 'bold 72px Arial, sans-serif'
  ctx.fillText(`${successTotal.value} SCASH`, width / 2, cardY + 220)

  // Count
  ctx.fillStyle = '#6b7280'
  ctx.font = '32px Arial, sans-serif'
  ctx.fillText(`共 ${count.value} 个红包`, width / 2, cardY + 290)

  // Divider
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cardX + 60, cardY + 330)
  ctx.lineTo(cardX + cardW - 60, cardY + 330)
  ctx.stroke()

  // Message
  ctx.fillStyle = '#374151'
  ctx.font = '36px Arial, sans-serif'
  ctx.fillText(message.value || '恭喜发财，大吉大利', width / 2, cardY + 400)

  // QR code area
  const qrSize = 320
  const qrX = (width - qrSize) / 2
  const qrY = cardY + 450

  // QR background
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 16)
  ctx.fill()
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 2
  ctx.stroke()

  // Draw QR code
  const qrCanvas = document.createElement('canvas')
  qrCanvas.width = qrSize
  qrCanvas.height = qrSize
  // We'll use a data URL from the qrcode component, but for canvas generation
  // we need to create it manually. Let's use a simpler approach:
  // Render the QR code to a temporary canvas using qrcode.vue's canvas render
  // But that's complex. Instead, we'll draw a placeholder and overlay the actual QR code later.
  // Actually, the best approach is to capture the DOM element.

  // For now, draw a placeholder box with text
  ctx.fillStyle = '#f3f4f6'
  ctx.fillRect(qrX, qrY, qrSize, qrSize)
  ctx.fillStyle = '#9ca3af'
  ctx.font = '28px Arial'
  ctx.fillText('扫码领取', width / 2, qrY + qrSize / 2 + 10)

  // Bottom text
  ctx.fillStyle = '#6b7280'
  ctx.font = '26px Arial, sans-serif'
  ctx.fillText('长按识别二维码 · 进入 Telegram 领取', width / 2, qrY + qrSize + 70)

  // Footer
  ctx.fillStyle = '#9ca3af'
  ctx.font = '22px Arial, sans-serif'
  ctx.fillText('Powered by SCASH Network', width / 2, height - 50)

  return canvas.toDataURL('image/png')
}

/**
 * Load an external image and draw it onto a canvas context.
 * Uses createImageBitmap(fetch(blob)) to completely bypass CORS.
 * Returns true on success, false on failure.
 */
async function drawExternalImage(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<boolean> {
  try {
    const res = await fetch(src, { mode: 'cors', cache: 'no-store' })
    if (!res.ok) throw new Error('fetch failed')
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    ctx.drawImage(bitmap, x, y, w, h)
    bitmap.close()
    return true
  } catch {
    return false
  }
}

/** Draw a circular placeholder avatar with the first letter of the name. */
function drawPlaceholderAvatar(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number,
  cy: number,
  r: number
) {
  const initial = (name[0] || '?').toUpperCase()
  // Background circle
  ctx.fillStyle = '#f3e8ff'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  // Initial letter
  ctx.fillStyle = '#7e22ce'
  ctx.font = `bold ${r}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initial, cx, cy + r * 0.05)
  ctx.textBaseline = 'alphabetic'
}

function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new Blob([u8arr], { type: mime })
}

async function generatePosterWithQr() {
  posterGenerating.value = true
  try {
    // Wait for QR code to render in DOM
    await nextTick()
    await new Promise(r => setTimeout(r, 200))

    const canvas = document.createElement('canvas')
    const width = 750
    const height = 1200
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#fdf2f8')
    gradient.addColorStop(1, '#ffffff')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Top decorative bar
    ctx.fillStyle = '#9128ad'
    ctx.fillRect(0, 0, width, 180)

    // Brand text
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 56px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('SCASH 红包', width / 2, 105)

    ctx.font = '26px Arial, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText('Blockchain Red Packet', width / 2, 150)

    // Main card
    const cardX = 45
    const cardY = 210
    const cardW = 660
    const cardH = 780

    // Card shadow
    ctx.shadowColor = 'rgba(0,0,0,0.08)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 12
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(cardX, cardY, cardW, cardH, 28)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    // Sender info area
    const senderName = authStore.firstName || authStore.username || tg.getTgUser()?.first_name || tg.getTgUser()?.username || '神秘好友'
    const senderAvatar = authStore.photoUrl || tg.getTgUser()?.photo_url || ''

    // Avatar
    const avatarX = width / 2
    const avatarY = cardY + 55
    const avatarR = 40
    ctx.save()
    ctx.beginPath()
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    let avatarOk = false
    if (senderAvatar) {
      avatarOk = await drawExternalImage(ctx, senderAvatar, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2)
    }
    if (!avatarOk) {
      drawPlaceholderAvatar(ctx, senderName, avatarX, avatarY, avatarR)
    }
    ctx.restore()

    // Avatar border
    ctx.strokeStyle = '#f3f4f6'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(avatarX, avatarY, avatarR + 2, 0, Math.PI * 2)
    ctx.stroke()

    // Sender name
    ctx.fillStyle = '#374151'
    ctx.font = 'bold 30px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`@${senderName}`, width / 2, cardY + 130)

    // Created & expired time
    const now = new Date()
    const expiredAt = new Date(now.getTime() + expireSeconds.value * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

    ctx.fillStyle = '#9ca3af'
    ctx.font = '20px Arial, sans-serif'
    ctx.fillText(`创建时间: ${fmt(now)}`, width / 2, cardY + 168)
    ctx.fillText(`有效期至: ${fmt(expiredAt)}`, width / 2, cardY + 196)

    // Emoji
    ctx.font = '60px Arial'
    ctx.fillText('🧧', width / 2, cardY + 270)

    // Amount
    ctx.fillStyle = '#dc2626'
    ctx.font = 'bold 70px Arial, sans-serif'
    ctx.fillText(`${successTotal.value}`, width / 2, cardY + 360)

    ctx.fillStyle = '#6b7280'
    ctx.font = '32px Arial, sans-serif'
    ctx.fillText(`SCASH · 共 ${count.value} 个红包`, width / 2, cardY + 410)

    // Divider
    ctx.strokeStyle = '#f3f4f6'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cardX + 80, cardY + 445)
    ctx.lineTo(cardX + cardW - 80, cardY + 445)
    ctx.stroke()

    // Message
    ctx.fillStyle = '#374151'
    ctx.font = '34px Arial, sans-serif'
    const msg = message.value || '恭喜发财，大吉大利'
    ctx.fillText(msg.length > 12 ? msg.slice(0, 12) + '…' : msg, width / 2, cardY + 500)

    // QR code area (smaller: 200)
    const qrSize = 200
    const qrX = (width - qrSize) / 2
    const qrY = cardY + 540

    // QR background
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 16)
    ctx.fill()
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 2
    ctx.stroke()

    // Try to capture the rendered QR code from DOM
    // Note: qrcode.vue with render-as="canvas" renders <canvas class="poster-qr-code">
    // so we must match .poster-qr-code itself, not a child canvas.
    let qrDrawn = false
    const qrSelectors = [
      '.poster-qr-code',
      '[class*="qrcode"]',
      'canvas',
    ]
    for (const sel of qrSelectors) {
      const el = document.querySelector(sel)
      if (el && el.tagName === 'CANVAS') {
        ctx.drawImage(el as HTMLCanvasElement, qrX, qrY, qrSize, qrSize)
        qrDrawn = true
        break
      }
    }
    if (!qrDrawn) {
      ctx.fillStyle = '#f9fafb'
      ctx.fillRect(qrX, qrY, qrSize, qrSize)
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 2
      ctx.strokeRect(qrX, qrY, qrSize, qrSize)
      ctx.fillStyle = '#6b7280'
      ctx.font = 'bold 22px Arial'
      ctx.fillText('扫码领取红包', width / 2, qrY + qrSize / 2 - 6)
      ctx.font = '16px Arial'
      ctx.fillText('长按识别', width / 2, qrY + qrSize / 2 + 22)
    }

    // Bottom CTA
    ctx.fillStyle = '#6b7280'
    ctx.font = '24px Arial, sans-serif'
    ctx.fillText('长按识别二维码 · 进入 Telegram 领取', width / 2, qrY + qrSize + 55)

    // Footer brand
    ctx.fillStyle = '#d1d5db'
    ctx.font = '20px Arial, sans-serif'
    ctx.fillText('Powered by SCASH Network', width / 2, height - 45)

    // Export both data URL (for download) and blob URL (for <img> so Telegram
    // WebView may allow long-press "Save image" on the blob:// resource).
    const dataUrl = canvas.toDataURL('image/png')
    posterDataUrl.value = dataUrl

    // Await blob creation so posterBlobUrl is set BEFORE posterGenerating
    // becomes false — otherwise Vue hides the poster on first render.
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    )
    if (blob) {
      if (posterBlobUrl.value) URL.revokeObjectURL(posterBlobUrl.value)
      posterBlobUrl.value = URL.createObjectURL(blob)
    }

    showPosterPreview.value = true
    return dataUrl
  } catch (e) {
    console.error('Poster generation failed:', e)
    throw e
  } finally {
    posterGenerating.value = false
  }
}

async function downloadPoster() {
  if (!posterDataUrl.value) return

  const webApp = (window as any).Telegram?.WebApp
  const isTelegram = !!webApp?.platform

  // In Telegram Mini App, direct file download is restricted.
  // Guide the user to screenshot or long-press the image above.
  if (isTelegram) {
    await tg.showAlert('请长按上方的海报图片保存，或截屏保存到相册')
    return
  }

  // In normal browsers, try standard download
  const fileName = `SCASH-红包-${successPacketHash.value.slice(0, 8)}.png`
  try {
    const link = document.createElement('a')
    link.download = fileName
    link.href = posterDataUrl.value
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch {
    await tg.showAlert('下载未成功，请截屏保存海报')
  }
}

function closePosterPreview() {
  showPosterPreview.value = false
}

async function openShareSheet() {
  showShareSheet.value = true
  // Auto-generate poster when opening share sheet
  if (!posterDataUrl.value) {
    try {
      await generatePosterWithQr()
    } catch (e) {
      console.error('Auto poster generation failed:', e)
    }
  }
}

function closeShareSheet() {
  showShareSheet.value = false
}

function shareTo(platform: string) {
  const url = encodeURIComponent(successShareUrl.value)
  const text = encodeURIComponent('🧧 我发了一个SCASH红包，快来领取！')
  let target = ''

  switch (platform) {
    case 'telegram':
      target = `https://t.me/share/url?url=${url}&text=${text}`
      break
    case 'whatsapp':
      target = `https://wa.me/?text=${text}%20${url}`
      break
    case 'twitter':
      target = `https://twitter.com/intent/tweet?url=${url}&text=${text}`
      break
    case 'wechat':
      copyToClipboard(successShareUrl.value)
      closeShareSheet()
      return
    case 'native':
      if (navigator.share) {
        navigator.share({
          title: 'SCASH 红包',
          text: '我发了一个SCASH红包，快来领取！',
          url: successShareUrl.value,
        }).catch(() => {})
      }
      closeShareSheet()
      return
    case 'copy':
      copyToClipboard(successShareUrl.value)
      closeShareSheet()
      return
    default:
      return
  }

  if (target) {
    const webApp = (window as any).Telegram?.WebApp
    if (webApp?.openTelegramLink && platform === 'telegram') {
      webApp.openTelegramLink(target)
    } else {
      window.open(target, '_blank')
    }
  }
  closeShareSheet()
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

    <!-- Fullscreen poster preview -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showFullscreenPoster"
          class="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md"
          @click="closeFullscreenPoster"
        >
          <img
            :src="posterBlobUrl"
            alt="分享海报"
            class="max-w-[92vw] max-h-[85vh] w-auto h-auto rounded-xl shadow-2xl"
            @click.stop
          />
          <p class="fixed bottom-6 left-0 right-0 text-center text-white/60 text-xs">点击任意区域关闭</p>
        </div>
      </Transition>
    </Teleport>

    <!-- Share sheet -->
    <Teleport to="body">
      <Transition name="sheet">
        <div v-if="showShareSheet" class="fixed inset-0 z-[200] flex flex-col">
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeShareSheet" />

          <!-- Floating poster above the drawer -->
          <div class="flex-1 flex flex-col items-center justify-end px-5 pb-5 relative z-10 pointer-events-none">
            <div
              v-if="posterBlobUrl || posterGenerating"
              class="w-full max-w-[260px] pointer-events-auto"
              @click.stop
            >
              <div
                class="rounded-xl overflow-hidden shadow-2xl border-2 border-white/30 bg-white active:scale-[0.98] transition-transform cursor-pointer"
                @click="openFullscreenPoster"
              >
                <div v-if="posterGenerating" class="flex flex-col items-center justify-center py-12 gap-2">
                  <span class="material-symbols-outlined text-primary text-2xl animate-spin">progress_activity</span>
                  <span class="text-xs text-on-surface-variant">正在生成海报…</span>
                </div>
                <img
                  v-else-if="posterBlobUrl"
                  :src="posterBlobUrl"
                  alt="分享海报"
                  class="w-full h-auto block"
                  draggable="false"
                />
              </div>
              <p class="text-center text-[10px] text-white/60 mt-2">点击海报查看大图</p>
            </div>
          </div>

          <div class="relative bg-surface-container-lowest rounded-t-2xl p-4 pb-8 animate-slide-up">
            <div class="w-10 h-1 bg-outline-variant/30 rounded-full mx-auto mb-4" />

            <h3 class="text-center font-headline font-bold text-on-surface text-sm mb-4">分享到</h3>
            <div class="grid grid-cols-4 gap-4 mb-6">
              <button class="flex flex-col items-center gap-1.5 active:scale-95 transition-transform" @click="shareTo('telegram')">
                <div class="w-12 h-12 rounded-2xl bg-[#229ED9]/10 flex items-center justify-center">
                  <svg class="w-6 h-6 text-[#229ED9]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </div>
                <span class="text-[10px] text-on-surface-variant">Telegram</span>
              </button>
              <button class="flex flex-col items-center gap-1.5 active:scale-95 transition-transform" @click="shareTo('whatsapp')">
                <div class="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center">
                  <svg class="w-6 h-6 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <span class="text-[10px] text-on-surface-variant">WhatsApp</span>
              </button>
              <button class="flex flex-col items-center gap-1.5 active:scale-95 transition-transform" @click="shareTo('twitter')">
                <div class="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center">
                  <svg class="w-5 h-5 text-on-surface" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <span class="text-[10px] text-on-surface-variant">X / Twitter</span>
              </button>
              <button class="flex flex-col items-center gap-1.5 active:scale-95 transition-transform" @click="shareTo('wechat')">
                <div class="w-12 h-12 rounded-2xl bg-[#07C160]/10 flex items-center justify-center">
                  <svg class="w-6 h-6 text-[#07C160]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.49.49 0 0 1 .177-.554c1.527-1.12 2.5-2.778 2.5-4.623 0-3.37-3.22-6.118-7.059-6.118zm-2.766 2.895c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
                  </svg>
                </div>
                <span class="text-[10px] text-on-surface-variant">微信</span>
              </button>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button class="h-11 bg-surface-container-high rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-on-surface active:scale-[0.98] transition-transform" @click="shareTo('native')">
                <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">ios_share</span>
                系统分享
              </button>
              <button class="h-11 bg-primary/10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-primary active:scale-[0.98] transition-transform" @click="shareTo('copy')">
                <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">content_copy</span>
                复制链接
              </button>
            </div>
            <button class="w-full h-12 mt-3 bg-surface-container-high text-on-surface-variant font-headline font-semibold rounded-full active:scale-[0.98] transition-transform" @click="closeShareSheet">取消</button>
          </div>
        </div>
      </Transition>
    </Teleport>
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