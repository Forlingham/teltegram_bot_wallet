<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore, type WalletBackup } from '@/stores'
import { useCrypto } from '@/composables/useCrypto'
import { useTelegram } from '@/composables/useTelegram'
import { api } from '@/api'
import PasswordModal from '@/components/PasswordModal.vue'

const router = useRouter()
const walletStore = useWalletStore()
const { decryptMnemonic, encryptMnemonic, deriveAddress } = useCrypto()
const { showAlert } = useTelegram()

const isWatchOnly = ref(false)
const showPasswordModal = ref(false)
const passwordLoading = ref(false)
const passwordError = ref('')

const showChangeModal = ref(false)
const changeLoading = ref(false)
const changeError = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

onMounted(async () => {
  if (!walletStore.home) await walletStore.fetchHome()
  isWatchOnly.value = walletStore.isWatchOnly
})

watch(showPasswordModal, (v) => {
  if (v) passwordError.value = ''
})

const handleUnbind = async () => {
  // Refresh home state first to avoid stale data
  try {
    await walletStore.fetchHome()
  } catch {}
  if (!walletStore.hasWallet) {
    await showAlert('当前没有绑定钱包')
    router.push('/wallet')
    return
  }

  const conf1 = confirm('【高危操作】解除绑定会清空您在云端的钱包信息！\n\n请务必确认您已经备份了助记词，否则资金将永久丢失！\n\n确定要解除绑定吗？')
  if (!conf1) return
  const conf2 = confirm('再次确认：\n如果没有备份助记词，解除绑定后将无法找回！\n\n是否继续？')
  if (!conf2) return

  try {
    await walletStore.unbindWallet()
    await showAlert('已解除绑定')
    router.push('/wallet')
  } catch (e: any) {
    await showAlert('解除绑定失败：' + e.message)
  }
}

const handleChangePassword = async (password: string) => {
  changeError.value = ''
  changeLoading.value = true

  try {
    // Use cached backup first, fallback to API
    let backupData: WalletBackup | null = walletStore.backup
    if (!backupData) {
      const data = await api.post<{ backup: WalletBackup | null }>('/api/wallet/recover', {})
      if (!data.backup) throw new Error('未找到钱包备份')
      backupData = data.backup
      walletStore.saveBackup(backupData)
    }

    await decryptMnemonic(backupData!, password)

    changeLoading.value = false
    showPasswordModal.value = false

    // Now prompt for new password
    oldPassword.value = password
    showChangeModal.value = true
  } catch (e: any) {
    passwordError.value = e.message || '操作失败'
  } finally {
    changeLoading.value = false
  }
}

const submitNewPassword = async () => {
  changeError.value = ''
  if (!newPassword.value || newPassword.value.length < 8) {
    changeError.value = '新密码最少 8 位'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    changeError.value = '两次输入的新密码不一致'
    return
  }
  if (oldPassword.value === newPassword.value) {
    changeError.value = '新密码不能与原密码相同'
    return
  }

  changeLoading.value = true
  try {
    // Use cached backup first, fallback to API
    let backupData: WalletBackup | null = walletStore.backup
    if (!backupData) {
      const data = await api.post<{ backup: WalletBackup | null }>('/api/wallet/recover', {})
      if (!data.backup) throw new Error('未找到钱包备份')
      backupData = data.backup
      walletStore.saveBackup(backupData)
    }

    const mnemonic = await decryptMnemonic(backupData, oldPassword.value)
    const address = walletStore.address || deriveAddress(mnemonic)
    const enc = await encryptMnemonic(mnemonic, newPassword.value)

    await api.post('/api/wallet/update-password', {
      address,
      encryptedMnemonic: enc.ciphertext,
      salt: enc.salt,
      iv: enc.iv,
      authTag: enc.authTag,
    })

    // Update local cache with new encrypted backup
    walletStore.saveBackup({
      encryptedMnemonic: enc.ciphertext,
      salt: enc.salt,
      iv: enc.iv,
      authTag: enc.authTag,
    })

    await showAlert('密码修改成功')
    showChangeModal.value = false
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e: any) {
    changeError.value = e.message || '操作失败'
  } finally {
    changeLoading.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 pointer-events-none -z-10 bg-background overflow-hidden">
    <div class="absolute top-[-10%] right-[-20%] w-[80%] h-[60%] rounded-full bg-primary/5 blur-[120px]"></div>
    <div class="absolute bottom-[-10%] left-[-20%] w-[60%] h-[50%] rounded-full bg-tertiary/5 blur-[100px]"></div>
  </div>

  <main class="flex flex-col gap-8">
    <section class="relative overflow-hidden p-6 rounded-lg bg-gradient-to-br from-primary to-primary-container text-white ambient-shadow">
      <div class="relative z-10">
        <div class="flex justify-between items-start">
          <div>
            <p class="text-xs uppercase tracking-wider opacity-80 mb-1">Current Wallet</p>
            <h2 class="font-headline text-xl font-bold">Personal Savings</h2>
          </div>
          <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
            <span class="material-symbols-outlined text-white" style="font-variation-settings: 'FILL' 1;">account_balance_wallet</span>
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
      <router-link v-if="!isWatchOnly" to="/wallet/recover" class="group flex items-center justify-between p-5 rounded-lg bg-surface-container-lowest active:scale-[0.98] transition-all ambient-shadow text-left">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-sm bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
            <span class="material-symbols-outlined">key</span>
          </div>
          <div>
            <p class="text-[15px] font-semibold text-on-surface">查看 / 备份助记词</p>
            <p class="text-xs text-on-surface-variant">确保您的资产安全</p>
          </div>
        </div>
        <span class="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
      </router-link>

      <button v-if="!isWatchOnly" @click="showPasswordModal = true" class="group flex items-center justify-between p-5 rounded-lg bg-surface-container-lowest active:scale-[0.98] transition-all ambient-shadow text-left w-full">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-sm bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
            <span class="material-symbols-outlined">lock_reset</span>
          </div>
          <div>
            <p class="text-[15px] font-semibold text-on-surface">修改支付密码</p>
            <p class="text-xs text-on-surface-variant">保护您的交易权限</p>
          </div>
        </div>
        <span class="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
      </button>

      <button v-if="walletStore.hasWallet" @click="handleUnbind" class="group mt-4 flex items-center justify-between p-5 rounded-lg bg-error/5 active:scale-[0.98] transition-all border border-error/10 text-left w-full">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-sm bg-error/10 flex items-center justify-center text-error">
            <span class="material-symbols-outlined">link_off</span>
          </div>
          <div>
            <p class="text-[15px] font-bold text-error">解除绑定当前钱包</p>
            <p class="text-xs text-error/70">此操作不可撤销，请谨慎操作</p>
          </div>
        </div>
        <span class="material-symbols-outlined text-error group-hover:translate-x-1 transition-transform">chevron_right</span>
      </button>
    </section>

    <PasswordModal
      v-model="showPasswordModal"
      title="验证原密码"
      :loading="passwordLoading"
      :error-message="passwordError"
      @confirm="handleChangePassword"
    />

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showChangeModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" @click="showChangeModal = false" />
          <div class="relative bg-surface-container-lowest rounded-lg p-6 w-full max-w-sm shadow-xl">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">lock_reset</span>
              </div>
              <h3 class="font-headline text-lg font-bold text-on-surface">修改密码</h3>
            </div>
            <div class="space-y-3">
              <input v-model="newPassword" type="password" class="w-full px-4 py-3 bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50" placeholder="新密码（最少 8 位）" autocomplete="off" />
              <input v-model="confirmPassword" type="password" class="w-full px-4 py-3 bg-surface-container-high rounded-lg border-none focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50" placeholder="确认新密码" autocomplete="off" />
            </div>
            <p v-if="changeError" class="text-error text-sm font-medium mt-3">{{ changeError }}</p>
            <div class="flex gap-3 mt-6">
              <button @click="showChangeModal = false" class="flex-1 py-3 bg-surface-container-low rounded-full text-on-surface-variant font-semibold active:scale-[0.98] transition-transform">取消</button>
              <button @click="submitNewPassword" :disabled="changeLoading" class="flex-1 py-3 primary-gradient rounded-full text-on-primary font-bold active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed">
                <span v-if="changeLoading" class="spinner-sm mr-1"></span>
                确认修改
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </main>
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