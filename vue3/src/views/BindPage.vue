<script setup lang="ts">
import { ref } from 'vue'
import { api } from '@/api'
import { useTelegram } from '@/composables/useTelegram'

const { close } = useTelegram()

const address = ref('')
const errorMsg = ref('')
const loading = ref(false)

const handleBind = async () => {
  errorMsg.value = ''
  const addr = address.value.trim()
  if (!addr || addr.length < 10) {
    errorMsg.value = '请输入有效的 Scash 地址'
    return
  }
  loading.value = true
  try {
    await api.post('/api/wallet/bind', { address: addr })
    close()
  } catch (e: any) {
    errorMsg.value = e.message || '绑定失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="card">
    <p class="info">绑定一个已有的 Scash 地址作为观察钱包。观察钱包只能接收，无法签名发送，适合只收不发的场景。</p>

    <div class="label">Scash 地址</div>
    <input v-model="address" type="text" placeholder="scash1..." autocomplete="off" class="input-wrap" @keyup.enter="handleBind" />

    <button class="btn btn-brand" style="margin-top:16px" :disabled="loading" @click="handleBind">
      <span v-if="loading" class="spinner"></span>
      {{ loading ? '绑定中…' : '绑定观察钱包' }}
    </button>
    <div v-if="errorMsg" class="error" style="margin-top:10px">{{ errorMsg }}</div>
  </div>
</template>

<style scoped>
:root {
  --bg: #f4f8f1;
  --panel: #ffffff;
  --text: #1e2a1e;
  --muted: #5e695e;
  --line: #d6e1d2;
  --brand: #2f7a42;
}
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 14px; margin-bottom: 12px; }
.label { color: var(--muted); font-size: 13px; margin-bottom: 6px; }
.info { font-size: 13px; color: var(--muted); margin-bottom: 16px; line-height: 1.5; }
.error { color: #c0392b; font-size: 13px; margin-top: 6px; }
.input-wrap { width: 100%; padding: 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 16px; background: #fafefa; margin-bottom: 12px; }
.input-wrap:focus { outline: none; border-color: var(--brand); }
.btn { border: none; border-radius: 10px; padding: 10px 12px; font-weight: 600; cursor: pointer; }
.btn-brand { background: var(--brand); color: #fff; }
.btn-brand:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 6px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>