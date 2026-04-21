<script setup>
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()

const menuItems = [
  {
    title: '创建钱包',
    desc: '生成全新的加密资产账户',
    icon: 'add_card',
    path: '/wallet/create',
    primary: true
  },
  {
    title: '导入钱包',
    desc: '使用助记词或私钥恢复账户',
    icon: 'vpn_key',
    path: '/wallet/import',
    primary: false
  },
  {
    title: '绑定钱包',
    desc: '绑定观察钱包，只能领取红包，无法发送',
    icon: 'link',
    path: '/wallet/bind',
    primary: false
  }
]

const navigate = (path) => {
  router.push(path)
}
</script>

<template>
  <AppLayout title="SCASH 钱包" active-nav="home">
    <header class="w-full flex flex-col items-center text-center mb-8">
      <div class="mb-6 relative">
        <div class="absolute -inset-4 bg-primary-container/20 blur-3xl rounded-full"></div>
        <div class="w-20 h-20 relative z-10 bg-surface-container-low rounded-2xl flex items-center justify-center shadow-lg">
          <Icon name="account_balance_wallet" :size="40" filled />
        </div>
      </div>
      <h1 class="font-headline text-2xl font-extrabold tracking-tight text-on-background mb-3">
        欢迎使用 SCASH 钱包
      </h1>
      <p class="text-on-surface-variant font-medium leading-relaxed max-w-[280px] text-sm">
        创建、导入或绑定钱包后即可开始使用
      </p>
    </header>

    <div class="w-full space-y-4">
      <div
        v-for="item in menuItems"
        :key="item.path"
        @click="navigate(item.path)"
        class="w-full group flex items-center p-5 bg-surface-container-lowest rounded-lg shadow-ambient transition-all duration-200 active:scale-[0.98] text-left border border-transparent hover:border-primary/10 cursor-pointer"
      >
        <div
          :class="[
            'w-14 h-14 rounded-full flex items-center justify-center mr-5 shrink-0',
            item.primary
              ? 'primary-gradient text-white shadow-lg shadow-primary/20'
              : 'bg-surface-container-high text-primary'
          ]"
        >
          <Icon :name="item.icon" :size="24" />
        </div>
        <div class="flex-1">
          <h2 class="font-headline text-lg font-bold text-on-surface">{{ item.title }}</h2>
          <p class="text-on-surface-variant text-sm font-medium">{{ item.desc }}</p>
        </div>
        <Icon name="chevron_right" class="text-on-surface-variant group-hover:translate-x-1 transition-transform" />
      </div>
    </div>

    <footer class="w-full flex flex-col items-center mt-8 mb-4">
      <p class="text-[11px] text-on-surface-variant/60 text-center leading-relaxed">
        继续操作即表示您同意我们的<br/>
        <span class="text-primary-dim font-bold">服务协议</span> 与 <span class="text-primary-dim font-bold">隐私政策</span>
      </p>
    </footer>
  </AppLayout>
</template>