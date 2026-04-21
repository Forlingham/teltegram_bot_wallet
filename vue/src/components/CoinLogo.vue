<script setup>
defineProps({
  size: {
    type: [Number, String],
    default: 20
  }
})
</script>

<template>
  <img src="/img/logo-128x128.png" class="inline-block object-contain" :style="{ width: `${size}px`, height: `${size}px` }" alt="SCASH" />
</template>