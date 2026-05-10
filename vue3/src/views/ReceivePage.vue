<script setup lang="ts">
import { ref, onMounted } from 'vue'
import QrcodeVue from 'qrcode.vue'
import { useWalletStore } from '@/stores'
import { useTelegram } from '@/composables/useTelegram'
import { useI18n } from '@/i18n'

const walletStore = useWalletStore()
const { showAlert } = useTelegram()
const { t } = useI18n()

const address = ref('')
const copied = ref(false)
const loading = ref(true)

const handleCopy = async () => {
  if (!address.value) return
  try {
    await navigator.clipboard.writeText(address.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {}
}

onMounted(async () => {
  if (!walletStore.home) {
    await walletStore.fetchHome()
  }
  address.value = walletStore.address || ''
  loading.value = false
})

const handleShare = () => {
  if (!address.value) return
  const shareText = t('receive.shareText', { address: address.value })
  const tg = (window as any).Telegram?.WebApp
  if (tg?.openTelegramLink) {
    const shareIntent = 'https://t.me/share/url?url=' + encodeURIComponent(address.value) + '&text=' + encodeURIComponent(shareText)
    tg.openTelegramLink(shareIntent)
  } else if (navigator.share) {
    navigator.share({ title: t('receive.shareTitle'), text: shareText }).catch(() => {})
  } else {
    navigator.clipboard.writeText(address.value).then(() => {
      showAlert(t('receive.shareCopied'))
    })
  }
}
</script>

<template>
  <div class="w-full max-w-md mx-auto flex flex-col items-center gap-10">
    <header class="text-center space-y-2">
      <h1 class="font-headline font-extrabold text-2xl tracking-tight text-on-surface">{{ t('receive.title') }}</h1>
      <p class="text-on-surface-variant text-sm font-medium tracking-wide">{{ t('receive.subtitle') }}</p>
    </header>

    <div class="relative w-full aspect-square max-w-[320px]">
      <div class="absolute inset-0 bg-primary-container/20 blur-[80px] rounded-full scale-110"></div>
      <div class="relative z-10 bg-surface-container-lowest p-8 rounded-lg shadow-[0px_12px_48px_rgba(145,40,173,0.12)] flex items-center justify-center overflow-hidden border border-white/50">
        <div v-if="loading" class="w-full aspect-square flex items-center justify-center">
          <span class="material-symbols-outlined animate-spin-fast text-on-surface-variant">progress_activity</span>
        </div>
        <div v-else-if="!address" class="w-full aspect-square flex items-center justify-center">
          <p class="text-on-surface-variant text-sm">{{ t('receive.noWallet') }}</p>
        </div>
        <QrcodeVue v-else :value="address" :size="240" :color="'#9128ad'" level="L" />
      </div>
    </div>

    <div class="w-full space-y-4" v-if="address">
      <div class="bg-surface-container-low px-6 py-5 rounded-lg flex flex-col items-center gap-3">
        <span class="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest font-headline">{{ t('receive.addressLabel') }}</span>
        <div class="w-full text-center">
          <p class="mono text-sm leading-relaxed break-all text-on-surface selection:bg-primary-container selection:text-on-primary-container">{{ address }}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <button @click="handleCopy" class="flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-primary-container text-white font-bold py-4 rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all duration-200 w-full disabled:opacity-60" :disabled="!address || copied">
          <span class="material-symbols-outlined text-lg">{{ copied ? 'check' : 'content_copy' }}</span>
          <span>{{ copied ? t('receive.copied') : t('receive.copy') }}</span>
        </button>
        <button @click="handleShare" class="flex items-center justify-center gap-2 bg-surface-container-high text-primary font-bold py-4 rounded-full active:scale-95 transition-all duration-200">
          <span class="material-symbols-outlined text-lg">share</span>
          <span>{{ t('receive.shareAddress') }}</span>
        </button>
      </div>
    </div>

    <footer class="flex items-center gap-2 px-6 py-3 bg-error/5 rounded-full">
      <span class="material-symbols-outlined text-error text-base" style="font-variation-settings: 'FILL' 1;">info</span>
      <span class="text-error font-bold text-xs tracking-wide">{{ t('receive.onlyScashNote') }}</span>
    </footer>
  </div>
</template>
