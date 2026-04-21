<script setup>
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'
import Card from '../components/Card.vue'

const router = useRouter()

const goBack = () => {
  router.back()
}
</script>

<template>
  <AppLayout title="关于" active-nav="about">
    <div class="flex flex-col items-center text-center mb-8">
      <div class="w-20 h-20 rounded-2xl primary-gradient flex items-center justify-center shadow-lg mb-4">
        <Icon name="account_balance_wallet" :size="40" class="text-white" filled />
      </div>
      <h1 class="font-headline text-2xl font-extrabold text-on-surface mb-2">SCASH 钱包</h1>
      <p class="text-on-surface-variant text-sm">版本 1.0.0</p>
    </div>

    <Card padding="p-6" class="mb-4">
      <div class="flex items-start gap-4">
        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon name="info" :size="20" class="text-primary" />
        </div>
        <div class="text-left">
          <h3 class="font-headline font-bold text-on-surface mb-2">关于 SCASH</h3>
          <p class="text-sm text-on-surface-variant leading-relaxed">
            SCASH 是一个基于比特币网络的智能合约钱包，旨在为用户提供安全、便捷的加密资产管理体验。
          </p>
        </div>
      </div>
    </Card>

    <Card padding="p-6" class="mb-4">
      <h3 class="font-headline font-bold text-on-surface mb-4">主要功能</h3>
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <Icon name="check_circle" :size="18" class="text-tertiary" />
          <span class="text-sm text-on-surface">创建和导入比特币钱包</span>
        </div>
        <div class="flex items-center gap-3">
          <Icon name="check_circle" :size="18" class="text-tertiary" />
          <span class="text-sm text-on-surface">发送和接收 SCASH 资产</span>
        </div>
        <div class="flex items-center gap-3">
          <Icon name="check_circle" :size="18" class="text-tertiary" />
          <span class="text-sm text-on-surface">红包功能</span>
        </div>
        <div class="flex items-center gap-3">
          <Icon name="check_circle" :size="18" class="text-tertiary" />
          <span class="text-sm text-on-surface">刻字上链（铭文）</span>
        </div>
        <div class="flex items-center gap-3">
          <Icon name="check_circle" :size="18" class="text-tertiary" />
          <span class="text-sm text-on-surface">交易记录查看</span>
        </div>
      </div>
    </Card>

    <Card padding="p-6">
      <h3 class="font-headline font-bold text-on-surface mb-4">链接</h3>
      <div class="space-y-3">
        <div class="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
          <div class="flex items-center gap-3">
            <Icon name="description" :size="18" class="text-primary" />
            <span class="text-sm text-on-surface">服务协议</span>
          </div>
        </div>
        <div class="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
          <div class="flex items-center gap-3">
            <Icon name="privacy_tip" :size="18" class="text-primary" />
            <span class="text-sm text-on-surface">隐私政策</span>
          </div>
        </div>
        <div class="flex items-center justify-between p-3 bg-surface-container-low rounded-lg">
          <div class="flex items-center gap-3">
            <Icon name="language" :size="18" class="text-primary" />
            <span class="text-sm text-on-surface">官方网站</span>
          </div>
        </div>
      </div>
    </Card>

    <button @click="goBack" class="mt-8 w-full py-3 bg-surface-container-low rounded-full text-on-surface-variant font-semibold active:scale-[0.98] transition-transform">返回</button>
  </AppLayout>
</template>