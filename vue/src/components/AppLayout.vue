<script setup>
import AppHeader from './AppHeader.vue'
import BottomNav from './BottomNav.vue'

defineProps({
  title: {
    type: String,
    default: 'SCASH 钱包'
  },
  activeNav: {
    type: String,
    default: 'home'
  },
  hideBottomNav: {
    type: Boolean,
    default: false
  },
  showSettings: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <div class="min-h-screen flex flex-col pb-24 overflow-x-hidden bg-surface">
    <AppHeader :title="title" :show-settings="showSettings" />
    <main class="flex-1 px-4 space-y-6 max-w-lg mx-auto w-full py-4">
      <slot />
    </main>
    <BottomNav v-if="!hideBottomNav" :active-nav="activeNav" />
  </div>
</template>