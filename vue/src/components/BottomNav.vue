<script setup>
import { useRouter, useRoute } from 'vue-router'

const props = defineProps({
  activeNav: {
    type: String,
    default: 'home'
  }
})

const router = useRouter()
const route = useRoute()

const navItems = [
  { key: 'home', label: '首页', icon: 'home', path: '/wallet' },
  { key: 'redpacket', label: '红包', icon: 'card_giftcard', path: '/wallet/redpacket' },
  { key: 'history', label: '记录', icon: 'history', path: '/wallet/history' },
  { key: 'about', label: '关于', icon: 'info', path: '/wallet/about' }
]

const navigate = (path) => {
  router.push(path)
}
</script>

<template>
  <nav class="fixed bottom-0 w-full z-50 rounded-t-[2.5rem] bg-slate-50/90 backdrop-blur-2xl shadow-[0px_-12px_32px_rgba(145,40,173,0.08)] flex justify-around items-center px-4 pb-[env(safe-area-inset-bottom)] pt-4">
    <div
      v-for="item in navItems"
      :key="item.key"
      @click="navigate(item.path)"
      :class="[
        'flex flex-col items-center justify-center transition-all duration-300 ease-out py-2.5 px-5 rounded-full cursor-pointer',
        activeNav === item.key
          ? 'bg-gradient-to-br from-purple-600 to-purple-400 text-white shadow-lg shadow-purple-500/30'
          : 'text-slate-400 hover:text-purple-500'
      ]"
    >
      <span class="material-symbols-outlined">{{ item.icon }}</span>
      <span class="font-headline font-medium text-[10px] mt-0.5">{{ item.label }}</span>
    </div>
  </nav>
</template>