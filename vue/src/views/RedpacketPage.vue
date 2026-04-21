<script setup>
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'
import Card from '../components/Card.vue'

const router = useRouter()
</script>

<template>
  <AppLayout title="红包" active-nav="redpacket">
    <div class="flex flex-col items-center text-center mb-6">
      <div class="w-20 h-20 rounded-2xl primary-gradient flex items-center justify-center shadow-lg mb-4">
        <Icon name="card_giftcard" :size="40" class="text-white" filled />
      </div>
      <h1 class="font-headline text-2xl font-extrabold text-on-surface mb-2">SCASH 红包</h1>
      <p class="text-on-surface-variant text-sm">发送加密货币红包给好友</p>
    </div>

    <div class="grid grid-cols-2 gap-4 mb-6">
      <Card padding="p-5" hoverable class="text-center cursor-pointer">
        <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Icon name="send" :size="24" class="text-primary" />
        </div>
        <h3 class="font-headline font-bold text-on-surface mb-1">发红包</h3>
        <p class="text-xs text-on-surface-variant">创建红包发送给好友</p>
      </Card>
      <Card padding="p-5" hoverable class="text-center cursor-pointer">
        <div class="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center mx-auto mb-3">
          <Icon name="attach_money" :size="24" class="text-tertiary" />
        </div>
        <h3 class="font-headline font-bold text-on-surface mb-1">抢红包</h3>
        <p class="text-xs text-on-surface-variant">输入红包码领取</p>
      </Card>
    </div>

    <Card padding="p-6">
      <h3 class="font-headline font-bold text-on-surface mb-4">最近红包</h3>
      <div class="text-center py-8 text-on-surface-variant text-sm">
        暂无红包记录
      </div>
    </Card>
  </AppLayout>
</template>