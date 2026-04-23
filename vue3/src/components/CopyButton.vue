<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  text: string
  successText?: string
}>()

const copied = ref(false)

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(props.text)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    // fallback
  }
}
</script>

<template>
  <button
    class="text-slate-400 hover:text-primary transition-colors"
    :class="{ 'text-primary': copied }"
    @click="handleCopy"
  >
    <span class="material-symbols-outlined text-lg">{{ copied ? 'check' : 'content_copy' }}</span>
  </button>
</template>