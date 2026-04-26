<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  title?: string
  confirmText?: string
  loading?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [password: string]
}>()

const password = ref('')
const showPasswordToggle = ref(false)

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

watch(() => props.modelValue, (v) => {
  if (v) {
    password.value = ''
  }
})

const handleConfirm = () => {
  if (!password.value) return
  emit('confirm', password.value)
}

const handleClose = () => {
  password.value = ''
  visible.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" @click="handleClose" />
        <div class="relative bg-surface-container-lowest rounded-2xl p-6 w-full max-w-sm shadow-xl">
          <h3 class="font-headline text-lg font-bold text-on-surface mb-4">
            {{ title || '输入密码' }}
          </h3>

          <div class="relative mb-4">
            <input
              v-model="password"
              :type="showPasswordToggle ? 'text' : 'password'"
              placeholder="请输入密码"
              class="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-on-surface focus:border-primary focus:outline-none transition-colors pr-10"
              :class="{ 'border-error': errorMessage }"
              @keyup.enter="handleConfirm"
            />
            <button
              class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary"
              @click="showPasswordToggle = !showPasswordToggle"
            >
              <span class="material-symbols-outlined text-xl">{{ showPasswordToggle ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>

          <p v-if="errorMessage" class="text-error text-sm mb-4">{{ errorMessage }}</p>

          <div class="flex gap-3">
            <button
              class="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-semibold active:scale-[0.98] transition-transform"
              :disabled="loading"
              @click="handleClose"
            >
              取消
            </button>
            <button
              class="flex-1 py-2.5 rounded-xl primary-gradient text-white font-semibold active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
              :disabled="loading || !password"
              @click="handleConfirm"
            >
              <span v-if="loading" class="spinner-sm mr-1"></span>
              {{ confirmText || '确认' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.spinner-sm {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  vertical-align: middle;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>