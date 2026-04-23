<script setup lang="ts">
const props = defineProps<{
  loading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

const handleClick = () => {
  if (!props.loading && !props.disabled) {
    emit('click')
  }
}
</script>

<template>
  <button
    class="btn-brand rounded-xl px-4 py-2.5 font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
    :disabled="loading || disabled"
    @click="handleClick"
  >
    <span v-if="loading" class="spinner-sm mr-2"></span>
    <slot />
  </button>
</template>

<style scoped>
.btn-brand {
  background: linear-gradient(135deg, #9128ad 0%, #e67aff 100%);
}

.spinner-sm {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>