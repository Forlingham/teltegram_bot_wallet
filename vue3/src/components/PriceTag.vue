<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  price: number
  change24h?: number
  compact?: boolean
}>()

const formattedPrice = computed(() => '$' + props.price.toFixed(3))
const changeText = computed(() => {
  if (props.change24h === undefined || props.change24h === null) return ''
  const sign = props.change24h >= 0 ? '+' : ''
  return sign + props.change24h.toFixed(2) + '%'
})
const changeColor = computed(() => {
  if (props.change24h === undefined || props.change24h === null) return ''
  return props.change24h >= 0 ? 'text-green-700' : 'text-red-600'
})
</script>

<template>
  <span v-if="compact" class="inline-flex items-center gap-1">
    <span class="font-bold text-on-surface">{{ formattedPrice }}</span>
    <span v-if="changeText" :class="changeColor" class="text-xs font-bold">{{ changeText }}</span>
  </span>
  <div v-else class="flex items-center gap-2 mt-1">
    <span class="text-lg text-on-surface-variant font-medium">{{ formattedPrice }}</span>
    <span
      v-if="changeText"
      class="px-2 py-0.5 rounded-full text-xs font-bold"
      :class="changeColor"
    >
      {{ changeText }}
    </span>
  </div>
</template>