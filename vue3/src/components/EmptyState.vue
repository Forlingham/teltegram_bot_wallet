<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  icon: string
  title: string
  description: string
  to?: string
}>()

const isLink = computed(() => !!props.to)
</script>

<template>
  <component
    :is="isLink ? 'router-link' : 'div'"
    :to="to"
    class="w-full group flex items-center p-5 bg-surface-container-lowest rounded-lg ambient-shadow transition-all duration-200 active:scale-[0.98] text-left border border-transparent hover:border-primary/10"
  >
    <slot name="icon">
      <div class="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-primary mr-5 shrink-0">
        <span class="material-symbols-outlined text-2xl">{{ icon }}</span>
      </div>
    </slot>
    <div class="flex-1">
      <h2 class="font-headline text-lg font-bold text-on-surface">{{ title }}</h2>
      <p class="text-on-surface-variant text-sm font-medium">{{ description }}</p>
    </div>
    <slot name="action">
      <span class="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
    </slot>
  </component>
</template>