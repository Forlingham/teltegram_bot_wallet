<script setup lang="ts">
import { computed } from 'vue'
import { formatBalanceSmallDecimal } from '@/utils/format'

const props = defineProps<{
  sats: bigint
  showFiat?: boolean
  priceUsd?: number
}>()

const display = computed(() => formatBalanceSmallDecimal(props.sats))
const fiatValue = computed(() => {
  if (!props.showFiat || !props.priceUsd || props.sats === 0n) return null
  const scash = Number(props.sats) / 1e8
  return '≈ $' + (scash * props.priceUsd).toFixed(2) + ' USD'
})
</script>

<template>
  <div class="flex flex-col items-start">
    <h1 class="font-headline font-extrabold tracking-tight text-on-surface flex items-baseline gap-2">
      <span class="text-4xl font-bold">{{ display.whole }}</span>
      <span class="text-lg font-bold">{{ display.decimal }}</span>
      <img src="/img/logo-128x128.png" class="w-4 h-4 object-contain" alt="SCASH" />
    </h1>
    <span v-if="fiatValue" class="text-lg text-on-surface-variant font-medium mt-1">{{ fiatValue }}</span>
  </div>
</template>