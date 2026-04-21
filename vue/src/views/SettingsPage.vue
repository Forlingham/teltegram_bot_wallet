<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const showPasswordModal = ref(false)

const goToRecover = () => {
  router.push('/wallet/recover')
}

const goBack = () => {
  router.back()
}

onMounted(() => {
  const tg = window.Telegram?.WebApp
  if (tg) {
    tg.BackButton.show()
    tg.onEvent('backButtonClicked', goBack)
  }
})

onUnmounted(() => {
  const tg = window.Telegram?.WebApp
  if (tg) {
    tg.BackButton.hide()
    tg.offEvent('backButtonClicked', goBack)
  }
})
</script>

<template>
  <AppLayout title="设置" :hide-bottom-nav="true">
    <div class="fixed inset-0 pointer-events-none -z-10 bg-background overflow-hidden">
      <div class="absolute top-[-10%] right-[-20%] w-[80%] h-[60%] rounded-full bg-primary/5 blur-[120px]"></div>
      <div class="absolute bottom-[-10%] left-[-20%] w-[60%] h-[50%] rounded-full bg-tertiary/5 blur-[100px]"></div>
    </div>

    <main class="flex flex-col gap-8">
      <section class="relative overflow-hidden p-6 rounded-lg bg-gradient-to-br from-primary to-primary-container text-white shadow-ambient">
        <div class="relative z-10">
          <div class="flex justify-between items-start">
            <div>
              <p class="text-xs font-label uppercase tracking-wider opacity-80 mb-1">Current Wallet</p>
              <h2 class="font-headline text-xl font-bold">Personal Savings</h2>
            </div>
            <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Icon name="account_balance_wallet" :size="24" class="text-white" filled />
            </div>
          </div>
          <div class="mt-4 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-tertiary-fixed"></span>
            <p class="text-sm font-medium opacity-90">已连接到主网</p>
          </div>
        </div>
        <div class="absolute -bottom-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
      </section>

      <section class="flex flex-col gap-2">
        <div @click="goToRecover" class="group flex items-center justify-between p-5 rounded-lg bg-surface-container-lowest active:scale-[0.98] transition-all shadow-ambient text-left cursor-pointer">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-sm bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
              <Icon name="key" />
            </div>
            <div>
              <p class="text-[15px] font-semibold text-on-surface">查看 / 备份助记词</p>
              <p class="text-xs text-on-surface-variant">确保您的资产安全</p>
            </div>
          </div>
          <Icon name="chevron_right" class="text-on-surface-variant group-hover:translate-x-1 transition-transform" />
        </div>

        <button @click="showPasswordModal = true" class="group flex items-center justify-between p-5 rounded-lg bg-surface-container-lowest active:scale-[0.98] transition-all shadow-ambient text-left">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-sm bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
              <Icon name="lock_reset" />
            </div>
            <div>
              <p class="text-[15px] font-semibold text-on-surface">修改支付密码</p>
              <p class="text-xs text-on-surface-variant">保护您的交易权限</p>
            </div>
          </div>
          <Icon name="chevron_right" class="text-on-surface-variant group-hover:translate-x-1 transition-transform" />
        </button>

        <button class="group mt-4 flex items-center justify-between p-5 rounded-lg bg-error/5 active:scale-[0.98] transition-all border border-error/10 text-left">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-sm bg-error/10 flex items-center justify-center text-error">
              <Icon name="link_off" />
            </div>
            <div>
              <p class="text-[15px] font-bold text-error">解除绑定当前钱包</p>
              <p class="text-xs text-error/70">此操作不可撤销，请谨慎操作</p>
            </div>
          </div>
          <Icon name="chevron_right" class="text-error group-hover:translate-x-1 transition-transform" />
        </button>
      </section>
    </main>

    <button @click="goBack" class="mt-8 w-full py-3 bg-surface-container-low rounded-full text-on-surface-variant font-semibold active:scale-[0.98] transition-transform">返回</button>

    <div v-if="showPasswordModal" class="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
      <div class="bg-surface-container-lowest rounded-lg p-6 w-[90%] max-w-[360px] shadow-ambient">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon name="lock_reset" :size="20" class="text-primary" filled />
          </div>
          <h3 class="font-headline text-lg font-bold text-on-surface">修改密码</h3>
        </div>
        <div class="space-y-4">
          <input type="password" class="w-full px-4 py-3 bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50" placeholder="原密码" autocomplete="off" />
          <input type="password" class="w-full px-4 py-3 bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50" placeholder="新密码（最少 8 位）" autocomplete="off" />
          <input type="password" class="w-full px-4 py-3 bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50" placeholder="确认新密码" autocomplete="off" />
        </div>
        <div class="text-error text-sm font-medium mt-3" style="display:none;"></div>
        <div class="flex gap-3 mt-6">
          <button @click="showPasswordModal = false" class="flex-1 py-3 bg-surface-container-low rounded-full text-on-surface-variant font-semibold active:scale-[0.98] transition-transform">取消</button>
          <button class="flex-1 py-3 primary-gradient rounded-full text-white font-bold active:scale-[0.98] transition-transform">确认修改</button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>