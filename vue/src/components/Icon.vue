<script setup>
defineProps({
  name: {
    type: String,
    required: true
  },
  filled: {
    type: Boolean,
    default: false
  },
  size: {
    type: [Number, String],
    default: 24
  }
})
</script>

<template>
  <span
    class="material-symbols-outlined"
    :style="{
      fontVariationSettings: filled ? `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' ${size}` : `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      fontSize: `${size}px`
    }"
  >
    {{ name }}
  </span>
</template>