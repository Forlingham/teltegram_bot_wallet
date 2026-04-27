<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

// ---- Anti-automation helpers ----
function generateToken(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < length; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return s
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Detect headless / automation browsers.
 * Returns a reason string if detected, otherwise empty string.
 */
function detectAutomation(): string {
  const w = window as any
  const nav = navigator as any

  if (nav.webdriver === true) return 'webdriver'
  if (w.callPhantom || w._phantom) return 'phantomjs'
  if (w.__nightmare) return 'nightmare'
  if (w.domAutomation || w.domAutomationController) return 'chrome-automation'
  if (nav.plugins?.length === 0 && nav.mimeTypes?.length === 0) return 'no-plugins'
  if (w.outerWidth === 0 && w.outerHeight === 0) return 'headless-window'
  if (w.devicePixelRatio === 0) return 'headless-pixel'

  // Canvas fingerprint consistency check (headless often fails)
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('🧧 redpacket claim', 2, 2)
      const data = canvas.toDataURL('image/png')
      // Known headless signatures can be matched here if needed
    }
  } catch {
    return 'canvas-blocked'
  }

  return ''
}
import { useRouter } from 'vue-router'
import { useTelegram } from '@/composables/useTelegram'
import { usePriceStore } from '@/stores/price'
import { useWalletStore } from '@/stores'
import { api } from '@/api'

interface PacketUser {
  username?: string
  telegramId?: number
  photoUrl?: string
}

interface Claim {
  user: PacketUser
  amount: string
}

interface Cover {
  imageUrl?: string
  textTone?: 'LIGHT' | 'DARK'
}

interface RedPacket {
  hash: string
  message?: string
  totalAmount?: string | number
  count?: number
  remainingCount?: number
  status?: string
  cover?: Cover
  sender?: PacketUser
  senderUsername?: string
  senderTelegramId?: string
  claims?: Claim[]
  hasClaimed?: boolean
  claimedAmount?: string
}

const router = useRouter()
const { getWebApp, getInitData, showAlert, close: closeApp } = useTelegram()
const priceStore = usePriceStore()
const walletStore = useWalletStore()

const packetHash = ref(resolvePacketHash())
const loading = ref(true)
const error = ref('')
const packet = ref<RedPacket | null>(null)
const canClaim = ref(false)
const alreadyClaimed = ref(false)
const claimedAmount = ref('')
const claiming = ref(false)
const envelopeOpen = ref(false)
const settled = ref(false)
const claims = ref<Claim[]>([])

function resolvePacketHash(): string {
  const params = new URLSearchParams(window.location.search)
  let ph = params.get('packet') || ''
  if (ph) return ph

  const tg = getWebApp()
  let startParam = ''
  if (tg?.initDataUnsafe?.start_param) {
    startParam = tg.initDataUnsafe.start_param
  }
  if (!startParam) {
    startParam = params.get('startapp') || params.get('start_param') || ''
  }
  if (startParam.startsWith('rp_')) {
    return startParam.slice(3)
  }
  return ''
}

function getAvatar(user?: PacketUser | null, fallback?: string): string {
  if (user?.photoUrl) return user.photoUrl
  const name = user?.username || fallback || 'default'
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
}

function getSenderName(): string {
  if (!packet.value) return '神秘好友'
  const p = packet.value
  return p.senderUsername || p.sender?.username || (p.senderTelegramId ? '#' + p.senderTelegramId : '神秘好友')
}

const remainingCount = computed(() => {
  if (!packet.value) return 0
  return packet.value.remainingCount ?? 0
})

function trimTrailingZeros(value: string): string {
  if (!value.includes('.')) return value
  return value.replace(/\.?0+$/, '') || '0'
}

const remainingAmount = computed(() => {
  if (!packet.value) return '0.00'
  const total = parseFloat(String(packet.value.totalAmount || 0))
  const claimed = claims.value.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0)
  const rem = Math.max(0, total - claimed)
  return rem.toFixed(2)
})

const claimedCount = computed(() => claims.value.length)
const hasWallet = computed(() => walletStore.hasWallet)

async function loadPacket() {
  if (!packetHash.value) {
    packetHash.value = resolvePacketHash()
  }
  if (!packetHash.value) {
    error.value = '红包参数缺失，请通过分享链接打开'
    loading.value = false
    return
  }
  try {
    const data = await api.get<any>(`/api/redpacket/${encodeURIComponent(packetHash.value)}`)
    packet.value = data.redPacket || data
    const p = packet.value!
    const hasClaimed = typeof data.hasClaimed === 'boolean' ? data.hasClaimed : !!p.hasClaimed
    alreadyClaimed.value = hasClaimed
    claimedAmount.value = data.claimedAmount || p.claimedAmount || ''
    claims.value = data.claims || p.claims || []

    if (p.status === 'ACTIVE' && !hasClaimed) {
      canClaim.value = true
      envelopeOpen.value = false
    } else if (hasClaimed) {
      envelopeOpen.value = true
      settled.value = true
      canClaim.value = false
    } else if (p.status === 'EXPIRED') {
      envelopeOpen.value = true
      settled.value = true
      canClaim.value = false
    } else if (p.status === 'COMPLETED' || Number(p.remainingCount || 0) <= 0) {
      envelopeOpen.value = true
      settled.value = true
      canClaim.value = false
    } else {
      envelopeOpen.value = true
      settled.value = true
      canClaim.value = false
    }
  } catch (e: any) {
    error.value = e?.message || '红包不存在或已过期'
  } finally {
    loading.value = false
  }
}

async function claimPacket() {
  if (!packetHash.value || claiming.value) return

  // Anti-automation: block if headless/automation environment detected
  if (autoDetected.value) {
    await showAlert('请在 Telegram 官方客户端中打开领取')
    return
  }

  claiming.value = true
  try {
    const initData = getInitData()
    if (!initData) {
      await showAlert('无法获取 Telegram 会话信息，请重新打开红包页面')
      return
    }

    const result = await api.post<{ amount: string; claims?: Claim[] }>(
      `/api/redpacket/${encodeURIComponent(packetHash.value)}/claim`,
      { initData }
    )
    claimedAmount.value = result.amount || '0'
    alreadyClaimed.value = true
    canClaim.value = false
    envelopeOpen.value = true
    setTimeout(() => { settled.value = true }, 600)
    if (result.claims) claims.value = result.claims
  } catch (e: any) {
    const msg = e?.message || ''
    if (msg.toLowerCase().includes('initdata expired') || msg.includes('会话已过期')) {
      await showAlert('页面已过期，请重新打开红包页面后再次领取')
      return
    }
    try {
      await api.get(`/api/redpacket/${encodeURIComponent(packetHash.value)}`)
      await loadPacket()
    } catch {
      await showAlert('领取失败')
    }
  } finally {
    claiming.value = false
  }
}

function handleClose() {
  closeApp()
}

function goHome() {
  router.push('/wallet')
}

const coverBg = ref('linear-gradient(135deg, #d42828 0%, #b81f1f 100%)')
const coverFlap = ref('linear-gradient(180deg, #db3030 0%, #c42626 100%)')
const textTone = ref<'LIGHT' | 'DARK'>('LIGHT')

// Anti-automation state
const coinClassToken = ref('')
const coinOffsetTop = ref(0)
const coinOffsetLeft = ref(0)
const baitEls = ref<Array<{ top: number; left: number; token: string }>>([])
const autoDetected = ref('')

function initAntiAutomation() {
  coinClassToken.value = generateToken(10)
  coinOffsetTop.value = randInt(-12, 12)
  coinOffsetLeft.value = randInt(-12, 12)

  // Generate 2-4 bait elements with similar appearance but wrong position
  const baitCount = randInt(2, 4)
  const baits: Array<{ top: number; left: number; token: string }> = []
  for (let i = 0; i < baitCount; i++) {
    baits.push({
      top: randInt(-80, 80),
      left: randInt(-80, 80),
      token: generateToken(10),
    })
  }
  baitEls.value = baits

  // Detect headless / automation environment
  autoDetected.value = detectAutomation()
  if (autoDetected.value) {
    console.warn('[ClaimPage] Automation detected:', autoDetected.value)
  }
}

onMounted(() => {
  initAntiAutomation()
  if (packetHash.value) {
    loadPacket()
    priceStore.fetchPrice().catch(() => {})
  } else {
    error.value = '红包参数缺失，请通过分享链接打开'
    loading.value = false
  }
})
</script>

<template>
  <div class="claim-page" :class="{ 'dark-mode': textTone === 'DARK' }">
    <button class="close-btn" @click="handleClose" title="关闭">×</button>
    <button class="home-btn" @click="goHome" title="回到首页">首页</button>

    <!-- Loading -->
    <div v-if="loading" class="fullscreen-center">
      <div class="env-preview-loading">
        <div class="env-preview-back"></div>
        <div class="env-preview-flap"></div>
        <div class="env-coin-loading">
          <div class="coin-inner">
            <img src="/img/logo-256x256.png" alt="SCASH" />
            <div class="coin-reflection"></div>
          </div>
        </div>
        <div class="loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="fullscreen-center">
      <div style="color: #fca5a5; font-size: 14px; text-align: center; padding: 0 24px;">{{ error }}</div>
      <router-link to="/wallet/redpacket" class="btn-brand" style="margin-top: 20px; display: inline-block; text-decoration: none;">返回红包</router-link>
    </div>

    <!-- Content -->
    <template v-else-if="packet">
      <!-- Section 1: Envelope — always fills viewport and centered -->
      <section class="envelope-section">
        <div class="perspective-container">
          <div class="env-wrapper" :class="{ open: envelopeOpen, settled }">
            <div class="env-back" :style="coverBg.includes('url') ? { backgroundImage: coverBg } : { background: coverBg }"></div>
            <div class="env-letter">
              <div class="letter-header">
                <img :src="getAvatar(packet.sender, getSenderName())" alt="Avatar" class="sender-avatar" />
                <p class="sender-label">来自 @{{ getSenderName() }} 的红包</p>
                <h2 class="message-text">{{ packet.message || '恭喜发财，大吉大利' }}</h2>
              </div>
              <div class="letter-body">
                <!-- Claimed amount -->
                <template v-if="alreadyClaimed && claimedAmount">
                  <div class="amount-main">
                    <span class="amount-int">{{ trimTrailingZeros(claimedAmount).includes('.') ? trimTrailingZeros(claimedAmount).split('.')[0] : trimTrailingZeros(claimedAmount) }}</span>
                    <span v-if="trimTrailingZeros(claimedAmount).includes('.')" class="amount-decimal">.{{ trimTrailingZeros(claimedAmount).split('.')[1] }}</span>
                    <img class="amount-logo" src="/img/logo-128x128.png" alt="SCASH" />
                  </div>
                  <div v-if="priceStore.currentPrice" class="amount-usd">
                    ≈ ${{ (Number(claimedAmount) * priceStore.currentPrice).toFixed(2) }} USD
                  </div>
                </template>
                <!-- Idle state -->
                <template v-else-if="canClaim">
                  <span class="amount-int">-</span>
                </template>
                <!-- Expired/completed -->
                <template v-else>
                  <span class="status-text">
                    {{ packet.status === 'EXPIRED' ? '红包已过期' : packet.status === 'COMPLETED' || (packet.remainingCount ?? 0) <= 0 ? '红包已被抢完' : '红包已结束' }}
                  </span>
                </template>
                <div v-if="alreadyClaimed" class="claimed-badge">你已领取</div>
              </div>
              <div class="letter-footer">
                总金额 {{ packet.totalAmount || '0' }} SCASH · 共 {{ packet.count || 0 }} 个
              </div>
            </div>
            <div class="env-front">
              <div class="powered-by">POWERED BY SCASH</div>
            </div>
            <div class="env-flap" :style="coverFlap.includes('url') ? { backgroundImage: coverFlap } : { background: coverFlap }">
              <div class="sender-info" :class="{ 'opacity-0': envelopeOpen }">
                <img :src="getAvatar(packet.sender, getSenderName())" alt="Avatar" class="flap-avatar" />
                <span class="flap-name" :class="textTone === 'DARK' ? 'text-dark' : 'text-light'">@{{ getSenderName() }}</span>
                <span class="flap-sub" :class="textTone === 'DARK' ? 'text-dark-muted' : 'text-light-muted'">给你发了一个红包</span>
              </div>
            </div>
            <!-- Bait elements: same appearance, wrong position, invisible but occupy DOM -->
            <div
              v-for="(bait, idx) in baitEls"
              :key="idx"
              class="env-coin-bait"
              :class="'bait-' + bait.token"
              :style="{ transform: `translate(calc(-50% + ${bait.left}px), calc(-50% + ${bait.top}px))` }"
            >
              <div class="coin-inner">
                <img src="/img/logo-256x256.png" alt="Open" />
              </div>
            </div>

            <!-- Real claim button with dynamic class + random offset -->
            <div
              class="env-coin"
              :class="[claiming ? 'loading' : '', 'coin-' + coinClassToken]"
              :style="{ transform: `translate(calc(-50% + ${coinOffsetLeft}px), calc(-50% + ${coinOffsetTop}px))` }"
              :data-token="coinClassToken"
              @click="claimPacket"
            >
              <div class="coin-inner">
                <img src="/img/logo-256x256.png" alt="Open" />
                <div class="coin-reflection"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Scroll hint -->
        <div v-if="claims.length > 0" class="scroll-hint">
          <span class="material-symbols-outlined">expand_more</span>
          <span>下滑查看领取详情</span>
        </div>

        <!-- Wallet guide for users without a wallet -->
        <div v-if="!hasWallet && envelopeOpen" class="wallet-guide">
          <div class="wallet-guide-inner">
            <div class="wallet-guide-icon">
              <span class="material-symbols-outlined">account_balance_wallet</span>
            </div>
            <div class="wallet-guide-content">
              <p class="wallet-guide-title">当前账号未创建、绑定钱包！</p>
              <p class="wallet-guide-desc">只有创建、绑定钱包后，领取到的scash才会到你的地址中。</p>
            </div>
            <button class="wallet-guide-btn" @click="goHome">去创建</button>
          </div>
        </div>
      </section>

      <!-- Section 2: Status + Claim list — below the fold -->
      <section v-if="claims.length > 0 || settled" class="details-section">
        <!-- Status cards -->
        <div class="status-bar">
          <div class="status-item">
            <span class="status-num">{{ claimedCount }}</span>
            <span class="status-label">已领取</span>
          </div>
          <div class="status-divider"></div>
          <div class="status-item">
            <span class="status-num">{{ remainingCount }}</span>
            <span class="status-label">剩余个数</span>
          </div>
          <div class="status-divider"></div>
          <div class="status-item">
            <span class="status-num">{{ remainingAmount }}</span>
            <span class="status-label">剩余金额</span>
          </div>
        </div>

        <!-- Claim list -->
        <div class="claim-list">
          <div class="claim-list-header">
            <span>领取记录</span>
            <span>{{ claims.length }} 人</span>
          </div>
          <div v-for="(c, i) in claims" :key="i" class="claim-row">
            <div class="claim-user">
              <img class="claim-avatar" :src="getAvatar(c.user, c.user?.username)" alt="avatar" />
              <div class="claim-name">{{ c.user?.username ? '@' + c.user.username : c.user?.telegramId ? '#' + c.user.telegramId : '匿名用户' }}</div>
            </div>
            <div class="claim-amount">{{ c.amount || '0' }} SCASH</div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.claim-page {
  background: radial-gradient(circle at center, #4a0a0a 0%, #0f0f13 100%);
  min-height: 100vh;
  position: relative;
}
.dark-mode {
  --text-main: #111827;
  --text-sub: rgba(17,24,39,0.72);
}

/* Fixed controls */
.close-btn {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 60;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.28);
  background: rgba(0,0,0,.28);
  color: #fff;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.home-btn {
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 60;
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.28);
  background: rgba(0,0,0,.28);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  line-height: 34px;
  text-align: center;
  cursor: pointer;
}

/* Full-screen center for loading/error */
.fullscreen-center {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.btn-brand {
  padding: 10px 24px;
  background: linear-gradient(135deg, #9128ad 0%, #e67aff 100%);
  color: #fff;
  border-radius: 999px;
  font-weight: 700;
  font-size: 14px;
}

/* Loading envelope preview */
.env-preview-loading {
  position: relative;
  width: 84vw;
  max-width: 316px;
  height: 58vh;
  max-height: 420px;
  border-radius: 12px;
  overflow: hidden;
}
.env-preview-back {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #d42828 0%, #b81f1f 100%);
  border-radius: 12px;
}
.env-preview-flap {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 42%;
  background: linear-gradient(180deg, #db3030 0%, #c42626 100%);
  border-radius: 12px 12px 50% 50% / 12px 12px 35% 35%;
  border-bottom: 2px solid rgba(255,255,255,.2);
}
.env-coin-loading {
  position: absolute;
  top: 42%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 84px;
  height: 84px;
  background: #fff;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,.05);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0,0,0,.15), 0 0 34px rgba(212,40,40,.4);
  animation: coin-pulse 2s infinite alternate ease-in-out;
}
.env-coin-loading .coin-inner {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0,0,0,.1);
  background: #fff;
}
.env-coin-loading .coin-inner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: logo-spin 1.2s linear infinite;
}

.loading-dots {
  position: absolute;
  bottom: 18%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
}
.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.6);
  animation: dot-bounce 1.4s infinite ease-in-out;
}
.loading-dots span:nth-child(1) { animation-delay: 0s; }
.loading-dots span:nth-child(2) { animation-delay: 0.16s; }
.loading-dots span:nth-child(3) { animation-delay: 0.32s; }

@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* Envelope section — exactly one viewport tall, centered */
.envelope-section {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.perspective-container {
  perspective: 1500px;
  width: 100%;
  display: flex;
  justify-content: center;
}

.env-wrapper {
  position: relative;
  width: 84vw;
  max-width: 316px;
  height: 58vh;
  max-height: 420px;
  transform-style: preserve-3d;
  transform: rotateX(5deg) translateY(0);
  transition: transform .6s cubic-bezier(.34,1.56,.64,1);
}
.env-wrapper.settled {
  height: 52vh;
  max-height: 360px;
}

.env-back {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  z-index: 1;
  box-shadow: inset 0 0 40px rgba(0,0,0,.3);
}

.env-letter {
  position: absolute;
  bottom: 15px;
  left: 15px;
  right: 15px;
  top: 15px;
  background: #fffdf5;
  border-radius: 8px;
  z-index: 2;
  transition: transform .8s cubic-bezier(.34,1.56,.64,1) .5s, box-shadow .8s .5s;
  box-shadow: 0 4px 12px rgba(0,0,0,.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 14px;
  text-align: center;
  background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(212,40,40,.04) 10px, rgba(212,40,40,.04) 20px);
}

.letter-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.sender-avatar {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 2px solid #fee2e2;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
}
.sender-label {
  font-size: 11px;
  color: #6b7280;
  margin: 4px 0 2px;
}
.message-text {
  font-size: 18px;
  font-weight: 800;
  color: #dc2626;
  margin-top: 2px;
  letter-spacing: .04em;
  line-height: 1.3;
}

.letter-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}
.amount-main {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  margin-bottom: 2px;
}
.amount-int {
  font-size: 40px;
  font-weight: 900;
  color: #dc2626;
  line-height: 1;
}
.amount-decimal {
  font-size: 20px;
  font-weight: 800;
  color: #dc2626;
  line-height: 1.05;
}
.amount-logo {
  width: 18px;
  height: 18px;
  object-fit: contain;
  margin-bottom: 4px;
}
.amount-usd {
  font-size: 11px;
  color: rgba(0,0,0,.55);
  margin-bottom: 4px;
  font-weight: 600;
}
.status-text {
  font-size: 20px;
  font-weight: 800;
  color: #dc2626;
  text-align: center;
}
.claimed-badge {
  font-size: 12px;
  font-weight: 700;
  color: #9b1c1c;
  margin-top: 4px;
}

.letter-footer {
  padding-top: 8px;
  border-top: 1px dashed #fca5a5;
  width: 100%;
  text-align: center;
  font-size: 11px;
  color: #6b7280;
}

.env-front {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 75%;
  background: linear-gradient(135deg, #d42828 0%, #b81f1f 100%);
  border-radius: 0 0 12px 12px;
  z-index: 3;
  box-shadow: 0 -5px 20px rgba(0,0,0,.25);
  border-top: 1px solid rgba(255,255,255,.15);
}
.powered-by {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  text-align: center;
  opacity: .5;
  font-size: 10px;
  letter-spacing: .2em;
  font-weight: 500;
  color: rgba(255,255,255,0.8);
}

.env-flap {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 42%;
  background: linear-gradient(180deg, #db3030 0%, #c42626 100%);
  border-radius: 12px 12px 50% 50% / 12px 12px 35% 35%;
  transform-origin: top center;
  z-index: 4;
  box-shadow: 0 8px 20px rgba(0,0,0,.2);
  transition: transform .6s cubic-bezier(.4,0,.2,1), z-index 0s .3s;
  border-bottom: 2px solid rgba(255,255,255,.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 20px;
}

.sender-info {
  transition: opacity .3s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.env-wrapper.open .sender-info {
  opacity: 0;
  pointer-events: none;
}
.flap-avatar {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 2px solid #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,.25);
  margin-bottom: 4px;
}
.flap-name {
  font-size: 13px;
  font-weight: 700;
}
.flap-sub {
  font-size: 11px;
  margin-top: 2px;
}
.text-light { color: #fff; }
.text-light-muted { color: rgba(255,255,255,0.7); }
.text-dark { color: #111827; }
.text-dark-muted { color: rgba(17,24,39,0.6); }

.env-coin {
  position: absolute;
  top: 42%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 84px;
  height: 84px;
  background: #fff;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,.05);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform .4s cubic-bezier(.175,.885,.32,1.275);
  box-shadow: 0 8px 24px rgba(0,0,0,.15), inset 0 4px 6px rgba(255,255,255,1), inset 0 -2px 6px rgba(0,0,0,.05), 0 0 20px rgba(212,40,40,.5);
  animation: coin-pulse 2s infinite alternate ease-in-out;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.env-coin.loading {
  pointer-events: none !important;
  animation: none !important;
}
.env-coin.loading .coin-inner img {
  animation: logo-spin .9s linear infinite;
}

/* Bait elements: same position base, invisible, no pointer events.
   They sit in the DOM to confuse coordinate-based automation scripts. */
.env-coin-bait {
  position: absolute;
  top: 42%;
  left: 50%;
  width: 84px;
  height: 84px;
  background: #fff;
  border-radius: 50%;
  z-index: 9;
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
}
@keyframes logo-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes coin-pulse {
  0% { box-shadow: 0 8px 24px rgba(0,0,0,.15), inset 0 4px 6px rgba(255,255,255,1), inset 0 -2px 6px rgba(0,0,0,.05), 0 0 10px rgba(212,40,40,.2); }
  100% { box-shadow: 0 8px 24px rgba(0,0,0,.15), inset 0 4px 6px rgba(255,255,255,1), inset 0 -2px 6px rgba(0,0,0,.05), 0 0 34px rgba(212,40,40,.8); }
}
.coin-inner {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0,0,0,.1);
  background: #fff;
  pointer-events: none;
}
.coin-inner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
.coin-reflection {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(255,255,255,.7) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,.1) 100%);
  pointer-events: none;
}

.env-wrapper.open {
  transform: rotateX(0deg) translateY(2vh);
}
.env-wrapper.open .env-flap {
  transform: rotateX(180deg);
  z-index: 1;
}
.env-wrapper.open .env-letter {
  transform: translateY(-24%);
  box-shadow: 0 15px 30px rgba(0,0,0,.3);
  z-index: 5;
}
.env-wrapper.open .env-coin {
  animation: none !important;
  transform: translate(-50%, -50%) scale(0) !important;
  opacity: 0;
  pointer-events: none;
}

/* Scroll hint */
.scroll-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: rgba(255,255,255,0.5);
  font-size: 11px;
  animation: bounce-hint 2s infinite;
}
.scroll-hint .material-symbols-outlined {
  font-size: 18px;
}
@keyframes bounce-hint {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(6px); }
}

/* Details section — below the fold */
.details-section {
  padding: 24px 16px 40px;
  min-height: 40vh;
}

/* Status bar */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  padding: 14px 10px;
  margin-bottom: 16px;
  max-width: 316px;
  margin-left: auto;
  margin-right: auto;
}
.status-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.status-num {
  font-size: 18px;
  font-weight: 800;
  color: #fde68a;
  line-height: 1;
}
.status-label {
  font-size: 10px;
  color: rgba(255,255,255,0.55);
  font-weight: 600;
  letter-spacing: 0.04em;
}
.status-divider {
  width: 1px;
  height: 28px;
  background: rgba(255,255,255,0.12);
}

/* Claim list */
.claim-list {
  max-width: 316px;
  margin: 0 auto;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 10px 12px;
}
.claim-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 4px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  font-size: 12px;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
  margin-bottom: 4px;
}
.claim-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 4px;
  border-bottom: 1px dashed rgba(255,255,255,.1);
}
.claim-row:last-child {
  border-bottom: none;
}
.claim-user {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.claim-avatar {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,.22);
  background: #fff;
}
.claim-name {
  color: #f3f4f6;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
.claim-amount {
  color: #fde68a;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

/* Wallet guide */
.wallet-guide {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 48px);
  max-width: 316px;
  z-index: 50;
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  animation: guide-float 3s ease-in-out infinite alternate;
}
@keyframes guide-float {
  0% { transform: translateX(-50%) translateY(0); }
  100% { transform: translateX(-50%) translateY(-4px); }
}
.wallet-guide-inner {
  display: flex;
  align-items: center;
  gap: 12px;
}
.wallet-guide-icon {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(145, 40, 173, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wallet-guide-icon .material-symbols-outlined {
  font-size: 20px;
  color: #e67aff;
}
.wallet-guide-content {
  flex: 1;
  min-width: 0;
}
.wallet-guide-title {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 2px;
}
.wallet-guide-desc {
  font-size: 11px;
  color: rgba(255,255,255,0.65);
  margin: 0;
  line-height: 1.4;
}
.wallet-guide-btn {
  padding: 8px 18px;
  background: linear-gradient(135deg, #9128ad 0%, #e67aff 100%);
  color: #fff;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  flex-shrink: 0;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(145, 40, 173, 0.4);
  transition: transform 0.15s;
}
.wallet-guide-btn:active {
  transform: scale(0.95);
}
</style>
