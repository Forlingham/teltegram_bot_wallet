<script setup lang="ts">
defineProps<{
  title?: string
  showSettings?: boolean
}>()
</script>

<template>
  <header class="sticky top-0 w-full z-50 glass-header shadow-sm shadow-purple-500/5 flex justify-between items-center px-6 py-2">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full border-2 border-primary/20 overflow-hidden bg-surface-container">
        <img alt="SCASH" class="w-full h-full object-cover" src="/img/logo-256x256.png" />
      </div>
      <span class="font-headline font-bold text-lg text-purple-700">{{ title || 'SCASH 钱包' }}</span>
    </div>
    <router-link v-if="showSettings" to="/wallet/settings" class="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-purple-50 transition-colors active:scale-95 duration-200">
      <span class="material-symbols-outlined">settings</span>
    </router-link>
  </header>
</template>