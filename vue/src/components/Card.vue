<script setup>
defineProps({
  padding: {
    type: String,
    default: 'p-5'
  },
  hoverable: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <div
    :class="[
      'bg-surface-container-lowest rounded-lg shadow-ambient transition-all duration-200',
      padding,
      hoverable ? 'hover:border-primary/10 border border-transparent' : ''
    ]"
  >
    <slot />
  </div>
</template>