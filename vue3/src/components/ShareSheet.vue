<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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

const createdAtDisplay = computed(() => {
  const createdAtRaw = props.createdAt ? new Date(props.createdAt) : null
  const createdAt = createdAtRaw && !isNaN(createdAtRaw.getTime()) ? createdAtRaw : new Date()
  const expiredAt = new Date(createdAt.getTime() + resolvedExpireSeconds.value * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return {
    created: fmt(createdAt),
    expired: fmt(expiredAt),
  }
})

const showFullscreenPoster = ref(false)

function close() {
  visible.value = false
}

function openFullscreenPoster() {
  showFullscreenPoster.value = true
}

function closeFullscreenPoster() {
  showFullscreenPoster.value = false
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {}
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

// Lock body scroll while sheet is visible
watch(visible, (v) => {
  if (v) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="visible" class="fixed inset-0 z-[200] flex flex-col">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close" />

        <!-- DOM Poster above the drawer -->
        <div class="flex-1 flex flex-col items-center justify-end px-5 pb-4 relative z-10 pointer-events-none">
          <div class="w-full max-w-[260px] pointer-events-auto" @click.stop>
            <!-- Poster card -->
            <div
              class="relative w-full bg-[#F8F7FD] rounded-[18px] overflow-hidden shadow-2xl border-2 border-white/30 pb-3 active:scale-[0.98] transition-transform cursor-pointer"
              @click="openFullscreenPoster"
            >
              <!-- 1. Header purple gradient -->
              <div class="bg-gradient-to-b from-[#8B2BE2] to-[#7119c4] pt-4 pb-9 px-3 text-center relative">
                <div class="flex justify-center items-center gap-1.5 mb-0.5">
                  <img src="/img/logo-128x128.png" alt="SCASH" class="w-5 h-5 rounded-full border border-white/20 shadow-sm" />
                  <h1 class="text-white text-base font-bold tracking-wide">SCASH 红包</h1>
                </div>
                <p class="text-purple-200/90 text-[9px] font-light tracking-widest">Blockchain Red Packet</p>
              </div>

              <!-- 2. White main card (floats upward) -->
              <div class="bg-white mx-3 -mt-6 rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-3 relative z-10 flex flex-col items-center">
                <!-- Avatar -->
                <div class="absolute -top-4 left-1/2 -translate-x-1/2">
                  <img
                    v-if="resolvedSenderAvatar"
                    :src="resolvedSenderAvatar"
                    alt="avatar"
                    class="w-9 h-9 rounded-full border-[3px] border-white shadow-sm object-cover"
                  />
                  <div
                    v-else
                    class="w-9 h-9 rounded-full bg-[#f2e8ff] text-[#8B2BE2] border-[3px] border-white shadow-sm flex items-center justify-center text-sm font-bold"
                  >
                    {{ resolvedSenderName[0]?.toUpperCase() || '?' }}
                  </div>
                </div>

                <!-- Name & time -->
                <h2 class="text-gray-800 font-bold text-[14px] mt-3">@{{ resolvedSenderName }}</h2>
                <div class="text-[9px] text-gray-400 text-center mt-0.5 leading-tight">
                  <p>创建: {{ createdAtDisplay.created }}</p>
                  <p>过期: {{ createdAtDisplay.expired }}</p>
                </div>

                <!-- Amount -->
                <div class="mt-2 flex flex-col items-center">
                  <span class="text-[28px] leading-none font-black text-[#e83e3e] tracking-tight">{{ amount }}</span>
                  <p class="text-gray-500 text-[10px] mt-0.5">SCASH · 共 {{ count }} 个红包</p>
                </div>

                <!-- Ticket divider -->
                <div class="ticket-divider my-2" />

                <!-- Message -->
                <p class="text-[#b8860b] font-medium text-[13px] mb-1.5 tracking-widest">{{ resolvedMessage }}</p>

                <!-- QR code with corner decorations -->
                <div class="relative p-1 bg-[#faf8ff] rounded-lg shadow-[0_4px_16px_rgba(139,43,226,0.06)] border border-purple-100/60">
                  <div class="absolute top-0 left-0 w-2 h-2 border-t-[2px] border-l-[2px] border-[#8B2BE2] rounded-tl" />
                  <div class="absolute top-0 right-0 w-2 h-2 border-t-[2px] border-r-[2px] border-[#8B2BE2] rounded-tr" />
                  <div class="absolute bottom-0 left-0 w-2 h-2 border-b-[2px] border-l-[2px] border-[#8B2BE2] rounded-bl" />
                  <div class="absolute bottom-0 right-0 w-2 h-2 border-b-[2px] border-r-[2px] border-[#8B2BE2] rounded-br" />
                  <QrcodeVue :value="shareUrl" :size="88" level="M" render-as="canvas" />
                </div>
              </div>

              <!-- 3. Footer -->
              <div class="mt-2 text-center space-y-0.5">
                <p class="text-gray-500 text-[10px] font-medium">长按识别二维码 · 进入 Telegram 领取</p>
                <p class="text-[#c1b8d2] text-[8px] uppercase tracking-widest font-semibold">Powered by SCASH Network</p>
              </div>
            </div>
            <p class="text-center text-[10px] text-white/60 mt-1.5">点击海报查看大图</p>
          </div>
        </div>

        <!-- Share drawer -->
        <div class="relative bg-surface-container-lowest rounded-t-2xl p-4 pb-6 animate-slide-up">
          <div class="w-10 h-1 bg-outline-variant/30 rounded-full mx-auto mb-4" />

          <h3 class="text-center font-headline font-bold text-on-surface text-sm mb-4">分享到</h3>
          <div class="grid grid-cols-4 gap-4 mb-5">
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
            <button class="h-10 bg-surface-container-high rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-on-surface active:scale-[0.98] transition-transform" @click="shareTo('native')">
              <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">ios_share</span>
              系统分享
            </button>
            <button class="h-10 bg-primary/10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-primary active:scale-[0.98] transition-transform" @click="shareTo('copy')">
              <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">content_copy</span>
              复制链接
            </button>
          </div>
          <button class="w-full h-11 mt-3 bg-surface-container-high text-on-surface-variant font-headline font-semibold rounded-full active:scale-[0.98] transition-transform" @click="close">取消</button>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Fullscreen poster preview -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showFullscreenPoster"
        class="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
        @click="closeFullscreenPoster"
      >
        <!-- Large DOM poster in fullscreen -->
        <div class="relative w-full max-w-[340px] pointer-events-none" @click.stop>
          <div class="relative w-full bg-[#F8F7FD] rounded-[22px] overflow-hidden shadow-2xl border-2 border-white/30 pb-4">
            <div class="bg-gradient-to-b from-[#8B2BE2] to-[#7119c4] pt-6 pb-11 px-4 text-center relative">
              <div class="flex justify-center items-center gap-2 mb-1">
                <img src="/img/logo-128x128.png" alt="SCASH" class="w-7 h-7 rounded-full border border-white/20 shadow-sm" />
                <h1 class="text-white text-xl font-bold tracking-wide">SCASH 红包</h1>
              </div>
              <p class="text-purple-200/90 text-xs font-light tracking-widest">Blockchain Red Packet</p>
            </div>

            <div class="bg-white mx-4 -mt-8 rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-5 relative z-10 flex flex-col items-center">
              <div class="absolute -top-5 left-1/2 -translate-x-1/2">
                <img
                  v-if="resolvedSenderAvatar"
                  :src="resolvedSenderAvatar"
                  alt="avatar"
                  class="w-11 h-11 rounded-full border-[3px] border-white shadow-sm object-cover"
                />
                <div
                  v-else
                  class="w-11 h-11 rounded-full bg-[#f2e8ff] text-[#8B2BE2] border-[3px] border-white shadow-sm flex items-center justify-center text-lg font-bold"
                >
                  {{ resolvedSenderName[0]?.toUpperCase() || '?' }}
                </div>
              </div>

              <h2 class="text-gray-800 font-bold text-base mt-5">@{{ resolvedSenderName }}</h2>
              <div class="text-[11px] text-gray-400 text-center mt-1 leading-tight">
                <p>创建时间: {{ createdAtDisplay.created }}</p>
                <p>有效期至: {{ createdAtDisplay.expired }}</p>
              </div>

              <div class="mt-4 flex flex-col items-center">
                <span class="text-[40px] leading-none font-black text-[#e83e3e] tracking-tight">{{ amount }}</span>
                <p class="text-gray-500 text-xs mt-1">SCASH · 共 {{ count }} 个红包</p>
              </div>

              <div class="ticket-divider my-3" />

              <p class="text-[#b8860b] font-medium text-[15px] mb-3 tracking-widest">{{ resolvedMessage }}</p>

              <div class="relative p-2 bg-[#faf8ff] rounded-xl shadow-[0_4px_16px_rgba(139,43,226,0.06)] border border-purple-100/60">
                <div class="absolute top-0 left-0 w-3 h-3 border-t-[2.5px] border-l-[2.5px] border-[#8B2BE2] rounded-tl-xl" />
                <div class="absolute top-0 right-0 w-3 h-3 border-t-[2.5px] border-r-[2.5px] border-[#8B2BE2] rounded-tr-xl" />
                <div class="absolute bottom-0 left-0 w-3 h-3 border-b-[2.5px] border-l-[2.5px] border-[#8B2BE2] rounded-bl-xl" />
                <div class="absolute bottom-0 right-0 w-3 h-3 border-b-[2.5px] border-r-[2.5px] border-[#8B2BE2] rounded-br-xl" />
                <QrcodeVue :value="shareUrl" :size="120" level="M" render-as="canvas" />
              </div>
            </div>

            <div class="mt-4 text-center space-y-1">
              <p class="text-gray-500 text-xs font-medium">长按识别二维码 · 进入 Telegram 领取</p>
              <p class="text-[#c1b8d2] text-[9px] uppercase tracking-widest font-semibold">Powered by SCASH Network</p>
            </div>
          </div>
        </div>

        <p class="fixed bottom-6 left-0 right-0 text-center text-white/60 text-xs">点击任意区域关闭</p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Ticket divider with semicircle notches */
.ticket-divider {
  position: relative;
  width: 100%;
  height: 1px;
  background-color: #f3f4f6;
}
.ticket-divider::before,
.ticket-divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  background-color: #ffffff;
  border-radius: 50%;
  transform: translateY(-50%);
}
.ticket-divider::before {
  left: -18px;
}
.ticket-divider::after {
  right: -18px;
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

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
