<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()

const goBack = () => {
  router.back()
}
</script>

<template>
  <AppLayout title="刻字上链" :hide-bottom-nav="true">
    <div class="flex flex-col items-center text-center mb-8">
      <div class="w-16 h-16 rounded-full primary-gradient flex items-center justify-center shadow-lg mb-4">
        <Icon name="edit_note" :size="32" class="text-white" filled />
      </div>
      <h1 class="font-headline text-2xl font-extrabold text-on-surface mb-3">刻字上链</h1>
      <p class="text-on-surface-variant text-sm leading-relaxed max-w-[300px]">
        将文字或数据永久刻在比特币链上，成为不可篡改的记录。
      </p>
    </div>

    <div class="bg-surface-container-lowest rounded-lg p-6 shadow-ambient mb-6">
      <div class="space-y-4">
        <div>
          <label class="text-xs font-bold text-on-surface-variant tracking-wider uppercase ml-1 mb-2 block">铭文内容</label>
          <textarea
            class="w-full min-h-[120px] p-4 bg-surface-container-low border-none rounded-DEFAULT focus:ring-2 focus:ring-primary/20 transition-all font-medium resize-none placeholder:text-outline"
            placeholder="输入要刻在链上的文字..."
          ></textarea>
        </div>

        <div class="flex justify-between items-center p-4 bg-surface-container-low rounded-lg">
          <span class="text-sm text-on-surface-variant font-medium">预估费用</span>
          <span class="text-sm font-bold text-primary">0.0001 SCASH</span>
        </div>
      </div>
    </div>

    <button class="w-full primary-gradient h-16 rounded-full flex items-center justify-center gap-3 shadow-ambient hover:scale-[0.98] active:scale-95 transition-all duration-200">
      <span class="text-white font-headline font-extrabold text-lg">确认刻字</span>
      <Icon name="arrow_forward" class="text-white text-xl" />
    </button>

    <button @click="goBack" class="mt-4 w-full py-3 bg-surface-container-low rounded-full text-on-surface-variant font-semibold active:scale-[0.98] transition-transform">返回</button>
  </AppLayout>
</template>