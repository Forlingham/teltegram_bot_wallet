<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const address = ref('')
const amount = ref('')
const message = ref('')
const availBalance = ref('1,000.00')
const isLoading = ref(false)
const errorMsg = ref('')

const goBack = () => {
  router.back()
}
</script>

<template>
  <AppLayout title="发送" :hide-bottom-nav="true">
    <div class="space-y-6">
      <section class="space-y-3">
        <div class="flex justify-between items-end px-2">
          <label class="font-headline font-bold text-sm text-on-surface-variant">收款地址</label>
        </div>
        <div class="flex gap-3">
          <div class="relative flex-1 group">
            <input
              v-model="address"
              class="w-full h-14 px-6 bg-surface-container-high border-none rounded-DEFAULT focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all duration-300 font-medium placeholder:text-outline"
              placeholder="粘贴收款方地址"
              type="text"
              autocomplete="off"
            />
          </div>
          <button class="w-14 h-14 flex items-center justify-center bg-surface-container-lowest shadow-ambient rounded-DEFAULT hover:scale-95 active:scale-90 transition-transform" title="扫描二维码">
            <Icon name="qr_code_scanner" class="text-primary" />
          </button>
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex justify-between items-end px-2">
          <label class="font-headline font-bold text-sm text-on-surface-variant">发送数量 (SCASH)</label>
          <span class="font-label text-xs font-semibold text-tertiary">可用余额: <span id="availBalance">{{ availBalance }}</span></span>
        </div>
        <div class="relative">
          <input
            v-model="amount"
            class="w-full h-20 px-8 bg-surface-container-lowest shadow-ambient border-none rounded-lg focus:ring-2 focus:ring-primary/20 transition-all duration-300 text-3xl font-headline font-bold text-primary placeholder:text-surface-container-highest"
            placeholder="0.00000000"
            type="text"
            autocomplete="off"
          />
          <div class="absolute right-8 top-1/2 -translate-y-1/2 flex gap-2">
            <button class="px-3 py-1 bg-primary-container/20 text-primary font-bold text-[10px] rounded-full uppercase tracking-tighter hover:bg-primary-container/30 transition-colors">MAX</button>
          </div>
        </div>
        <div class="text-sm text-on-surface-variant font-medium px-2 min-h-[20px]"></div>
      </section>

      <section class="space-y-3">
        <label class="font-headline font-bold text-sm text-on-surface-variant px-2">留言 / DAP 数据 (选填)</label>
        <textarea
          v-model="message"
          class="w-full p-2 bg-surface-container-low border-none rounded-DEFAULT focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all duration-300 font-medium resize-none placeholder:text-outline"
          placeholder="给收款方的留言，将上链永久保存"
          rows="3"
          maxlength="100"
          autocomplete="off"
        ></textarea>
      </section>

      <div class="bg-surface-container-lowest rounded-lg p-6 shadow-ambient space-y-4">
        <div class="flex items-center gap-2 mb-2">
          <Icon name="analytics" :size="16" class="text-primary" filled />
          <h3 class="font-headline font-bold text-sm text-on-surface">费用预估 (实时)</h3>
        </div>
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-on-surface-variant font-medium">转账金额</span>
            <span class="text-sm text-on-surface font-bold font-headline">-</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-on-surface-variant font-medium">链上手续费</span>
            <span class="text-sm text-tertiary font-bold font-headline">0.0001 SCASH</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-on-surface-variant font-medium">应用手续费</span>
            <span class="text-sm text-tertiary font-bold font-headline">-</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-on-surface-variant font-medium">DAP 上链</span>
            <span class="text-sm text-on-surface font-bold font-headline">-</span>
          </div>
        </div>
        <div class="pt-4 mt-2 border-t border-outline-variant/10 flex justify-between items-center">
          <span class="text-sm font-bold text-on-surface">预计总支出</span>
          <div class="text-right">
            <span class="text-lg font-headline font-extrabold text-primary">-</span>
            <p class="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">≈ - USD</p>
          </div>
        </div>
      </div>

      <footer class="pt-6">
        <button
          :disabled="isLoading"
          class="w-full primary-gradient h-16 rounded-full flex items-center justify-center gap-3 shadow-ambient hover:scale-[0.98] active:scale-95 transition-all duration-200 group"
        >
          <span class="text-white font-headline font-extrabold text-lg">确认发送</span>
          <Icon name="send" class="text-white text-xl group-hover:translate-x-1 transition-transform" />
        </button>
        <div v-if="errorMsg" class="error text-center mt-4">{{ errorMsg }}</div>
        <div class="mt-6 flex flex-col items-center gap-4">
          <div class="flex items-center gap-2 px-4 py-2 bg-surface-container-high/50 rounded-full">
            <div class="w-2 h-2 rounded-full bg-tertiary animate-pulse"></div>
            <span class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Network Secure (Mainnet)</span>
          </div>
        </div>
      </footer>
    </div>

    <button @click="goBack" class="mt-6 w-full py-3 bg-surface-container-low rounded-full text-on-surface-variant font-semibold active:scale-[0.98] transition-transform">返回</button>
  </AppLayout>
</template>