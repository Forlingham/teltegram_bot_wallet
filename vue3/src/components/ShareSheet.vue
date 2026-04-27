<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTelegram } from '@/composables/useTelegram'
import QrcodeVue from 'qrcode.vue'

const props = defineProps<{
  modelValue: boolean
  shareUrl: string
  amount: string
  count: number
  message?: string
  packetHash?: string
  expireSeconds?: number
  createdAt?: string
  senderName?: string
  senderAvatar?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const authStore = useAuthStore()
const tg = useTelegram()

const posterGenerating = ref(false)
const posterDataUrl = ref('')
const posterBlobUrl = ref('')
const showFullscreenPoster = ref(false)

// Track which shareUrl we last generated a poster for.
// When props change (different redpacket), we must regenerate.
const lastGeneratedUrl = ref('')

const resolvedSenderName = computed(() => {
  return props.senderName
    || authStore.firstName
    || authStore.username
    || tg.getTgUser()?.first_name
    || tg.getTgUser()?.username
    || '神秘好友'
})

const resolvedSenderAvatar = computed(() => {
  return props.senderAvatar
    || authStore.photoUrl
    || tg.getTgUser()?.photo_url
    || ''
})

const resolvedMessage = computed(() => props.message || '恭喜发财，大吉大利')
const resolvedExpireSeconds = computed(() => props.expireSeconds || 86400)

// Watch visible AND props — regenerate whenever the shareUrl changes
// immediate: true is critical because HistoryPage sets shareSheetData and
// showShareSheet in the same tick, so when ShareSheet mounts, visible may
// already be true — without immediate the watch would never fire.
watch(
  () => [visible.value, props.shareUrl] as const,
  async ([v, url]) => {
    if (!v) return
    // If already generated for this exact URL, skip
    if (posterDataUrl.value && lastGeneratedUrl.value === url) return
    // Otherwise clear old data and regenerate
    if (posterBlobUrl.value) {
      URL.revokeObjectURL(posterBlobUrl.value)
      posterBlobUrl.value = ''
    }
    posterDataUrl.value = ''
    try {
      await generatePosterWithQr()
    } catch (e) {
      console.error('Auto poster generation failed:', e)
    }
  },
  { immediate: true }
)

function close() {
  visible.value = false
}

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

function drawPlaceholderAvatar(
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number,
  cy: number,
  r: number
) {
  const initial = (name[0] || '?').toUpperCase()
  ctx.fillStyle = '#f3e8ff'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#7e22ce'
  ctx.font = `bold ${r}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initial, cx, cy + r * 0.05)
  ctx.textBaseline = 'alphabetic'
}

async function generatePosterWithQr() {
  posterGenerating.value = true
  try {
    await nextTick()
    await new Promise((r) => setTimeout(r, 250))

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

    // Avatar
    const senderName = resolvedSenderName.value
    const senderAvatar = resolvedSenderAvatar.value
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
    // For already-created packets (history page), use the provided createdAt;
    // for fresh creation, fall back to the current time.
    const createdAtRaw = props.createdAt ? new Date(props.createdAt) : null
    const createdAt = createdAtRaw && !isNaN(createdAtRaw.getTime()) ? createdAtRaw : new Date()
    const expiredAt = new Date(createdAt.getTime() + resolvedExpireSeconds.value * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`

    ctx.fillStyle = '#9ca3af'
    ctx.font = '20px Arial, sans-serif'
    ctx.fillText(`创建时间: ${fmt(createdAt)}`, width / 2, cardY + 168)
    ctx.fillText(`有效期至: ${fmt(expiredAt)}`, width / 2, cardY + 196)

    // Emoji
    ctx.font = '60px Arial'
    ctx.fillText('🧧', width / 2, cardY + 270)

    // Amount
    ctx.fillStyle = '#dc2626'
    ctx.font = 'bold 70px Arial, sans-serif'
    ctx.fillText(`${props.amount}`, width / 2, cardY + 360)

    ctx.fillStyle = '#6b7280'
    ctx.font = '32px Arial, sans-serif'
    ctx.fillText(`SCASH · 共 ${props.count} 个红包`, width / 2, cardY + 410)

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
    const msg = resolvedMessage.value
    ctx.fillText(msg.length > 12 ? msg.slice(0, 12) + '…' : msg, width / 2, cardY + 500)

    // QR code area (200)
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
    let qrDrawn = false
    const qrSelectors = [
      '.share-sheet-qr canvas',
      '.share-sheet-qr',
      '[class*="qrcode"] canvas',
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

    const dataUrl = canvas.toDataURL('image/png')
    posterDataUrl.value = dataUrl

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png')
    )
    if (blob) {
      if (posterBlobUrl.value) URL.revokeObjectURL(posterBlobUrl.value)
      posterBlobUrl.value = URL.createObjectURL(blob)
    }
    lastGeneratedUrl.value = props.shareUrl
    return dataUrl
  } catch (e) {
    console.error('Poster generation failed:', e)
    throw e
  } finally {
    posterGenerating.value = false
  }
}

function shareToChat() {
  const shareText = '🧧 我发了一个SCASH红包，快来领取！'
  const shareIntent = `https://t.me/share/url?url=${encodeURIComponent(props.shareUrl)}&text=${encodeURIComponent(shareText)}`
  const webApp = (window as any).Telegram?.WebApp
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(shareIntent)
  } else {
    window.location.href = shareIntent
  }
}

function shareTo(platform: string) {
  const url = encodeURIComponent(props.shareUrl)
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
      copyToClipboard(props.shareUrl)
      close()
      return
    case 'native':
      if (navigator.share) {
        navigator.share({
          title: 'SCASH 红包',
          text: '我发了一个SCASH红包，快来领取！',
          url: props.shareUrl,
        }).catch(() => {})
      }
      close()
      return
    case 'copy':
      copyToClipboard(props.shareUrl)
      close()
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
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="visible" class="fixed inset-0 z-[200] flex flex-col">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close" />

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

        <!-- Hidden QR code for poster generation -->
        <div class="absolute top-0 left-0 opacity-0 pointer-events-none" style="width:1px;height:1px;overflow:hidden;">
          <QrcodeVue
            v-if="visible"
            :value="shareUrl"
            :size="200"
            level="M"
            render-as="canvas"
            class="share-sheet-qr"
          />
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
          <button class="w-full h-12 mt-3 bg-surface-container-high text-on-surface-variant font-headline font-semibold rounded-full active:scale-[0.98] transition-transform" @click="close">取消</button>
        </div>
      </div>
    </Transition>
  </Teleport>

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
</template>

<style scoped>
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
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
