<script setup>
import { useRouter } from 'vue-router'

defineProps({
  title: {
    type: String,
    default: 'SCASH 钱包'
  },
  showSettings: {
    type: Boolean,
    default: false
  },
  avatarUrl: {
    type: String,
    default: '/img/logo-256x256.png'
  }
})

const router = useRouter()

const goToSettings = () => {
  router.push('/wallet/settings')
}
</script>

<template>
  <header class="sticky top-0 w-full z-50 bg-slate-50/80 backdrop-blur-xl shadow-sm shadow-purple-500/5 flex justify-between items-center px-6 py-2">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full border-2 border-primary/20 overflow-hidden bg-surface-container">
        <img :alt="title" class="w-full h-full object-cover" :src="avatarUrl"/>
      </div>
      <span class="font-headline font-bold text-lg text-purple-700">{{ title }}</span>
    </div>
    <div v-if="showSettings" @click="goToSettings" class="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-purple-50 transition-colors active:scale-95 duration-200 cursor-pointer">
      <span class="material-symbols-outlined">settings</span>
    </div>
  </header>
</template>