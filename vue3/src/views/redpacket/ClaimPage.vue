<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTelegram } from '@/composables/useTelegram'
import { usePriceStore } from '@/stores/price'
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
const { getWebApp, showAlert, close: closeApp } = useTelegram()
const priceStore = usePriceStore()

const packetHash = ref('')
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

async function loadPacket() {
  packetHash.value = resolvePacketHash()
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
  claiming.value = true
  try {
    const result = await api.post<{ amount: string; claims?: Claim[] }>(`/api/redpacket/${encodeURIComponent(packetHash.value)}/claim`, {})
    claimedAmount.value = result.amount || '0'
    alreadyClaimed.value = true
    canClaim.value = false
    envelopeOpen.value = true
    setTimeout(() => { settled.value = true }, 600)
    if (result.claims) claims.value = result.claims
  } catch {
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

onMounted(async () => {
  priceStore.fetchPrice()
  await loadPacket()

  const tg = getWebApp()
  if (tg) {
    tg.BackButton.show()
    tg.BackButton.onClick(handleClose)
  }
  history.pushState({ __claimBackClose: true }, '', window.location.href)
  window.addEventListener('popstate', handleClose)
})

onUnmounted(() => {
  const tg = getWebApp()
  if (tg) {
    tg.BackButton.offClick(handleClose)
  }
  window.removeEventListener('popstate', handleClose)
})
</script>

<template>
  <div class="claim-page" :class="{ 'dark-mode': textTone === 'DARK' }">
    <button class="close-btn" @click="handleClose" title="关闭">×</button>
    <button class="home-btn" @click="goHome" title="回到首页">首页</button>

    <!-- Loading -->
    <div v-if="loading" class="card" style="text-align: center; padding: 40px;">
      <div style="color: var(--muted);">加载中…</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="card" style="text-align: center;">
      <div style="color: #c0392b; font-size: 14px;">{{ error }}</div>
      <router-link to="/wallet/redpacket" class="btn btn-brand" style="margin-top: 16px; display: inline-block; text-decoration: none;">返回红包</router-link>
    </div>

    <!-- Envelope -->
    <template v-else-if="packet">
      <div class="scene">
        <div class="perspective-container">
          <div class="env-wrapper" :class="{ open: envelopeOpen, settled }">
            <div class="env-back" :style="coverBg.includes('url') ? { backgroundImage: coverBg } : { background: coverBg }"></div>
            <div class="env-letter">
              <div class="flex flex-col items-center w-full mt-2">
                <img :src="getAvatar(packet.sender, getSenderName())" alt="Avatar" class="w-12 h-12 rounded-full border-2 border-red-100 mb-1 bg-white shadow-sm z-10" style="width:48px;height:48px;border-radius:999px;border:2px solid #fee2e2;" />
                <p class="text-gray-500 text-xs mb-1" style="font-size:12px;color:#6b7280;margin:4px 0;">来自 @{{ getSenderName() }} 的红包</p>
                <h2 style="font-size:22px; font-weight:800; color:#dc2626; margin-top:6px; letter-spacing:.06em;">{{ packet.message || '恭喜发财，大吉大利' }}</h2>
              </div>
              <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%;">
                <!-- Claimed amount -->
                <template v-if="alreadyClaimed && claimedAmount">
                  <div class="amount-main" style="margin-bottom:4px;">
                    <span class="amount-int">{{ Number(claimedAmount).toFixed(2).split('.')[0] }}</span>
                    <span class="amount-decimal">.{{ Number(claimedAmount).toFixed(2).split('.')[1] || '00' }}</span>
                    <img class="amount-logo" src="/img/logo-128x128.png" alt="SCASH" />
                  </div>
                  <div v-if="priceStore.currentPrice" style="font-size:12px; color:rgba(0,0,0,.65); margin-bottom:8px; font-weight:600;">
                    ≈ ${{ (Number(claimedAmount) * priceStore.currentPrice).toFixed(2) }} USD
                  </div>
                </template>
                <!-- Idle state -->
                <template v-else-if="canClaim">
                  <span class="amount-int">-</span>
                </template>
                <!-- Expired/completed -->
                <template v-else>
                  <span class="amount-int" style="font-size:24px;">
                    {{ packet.status === 'EXPIRED' ? '红包已过期' : packet.status === 'COMPLETED' || (packet.remainingCount ?? 0) <= 0 ? '红包已被抢完' : '红包已结束' }}
                  </span>
                </template>
                <div v-if="alreadyClaimed" style="display:block; margin-top:6px; font-size:14px; font-weight:700; color:#9b1c1c;">你已领取</div>
              </div>
              <div style="padding-top:10px; border-top:1px dashed #fca5a5; width:100%; text-align:center; font-size:13px; color:#6b7280;">
                总金额 {{ packet.totalAmount || '0' }} SCASH · 共 {{ packet.count || 0 }} 个
              </div>
            </div>
            <div class="env-front">
              <div style="position:absolute; bottom:24px; left:50%; transform:translateX(-50%); width:100%; text-align:center; opacity:.58;">
                <div style="font-size:11px; letter-spacing:.2em; font-weight:500; color:rgba(255,255,255,0.82);">POWERED BY SCASH</div>
              </div>
            </div>
            <div class="env-flap" :style="coverFlap.includes('url') ? { backgroundImage: coverFlap } : { background: coverFlap }" style="display:flex; flex-direction:column; align-items:center; padding-top:24px;">
              <div class="sender-info" :class="{ 'opacity-0': envelopeOpen }">
                <img :src="getAvatar(packet.sender, getSenderName())" alt="Avatar" style="width:48px;height:48px;border-radius:999px;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);margin-bottom:6px;" />
                <span style="font-size:14px; font-weight:700;" :class="textTone === 'DARK' ? 'text-gray-900' : 'text-white'">@{{ getSenderName() }}</span>
                <span style="font-size:12px; margin-top:2px;" :class="textTone === 'DARK' ? 'text-gray-600' : 'text-white/70'">给你发了一个红包</span>
              </div>
            </div>
            <div class="env-coin" :class="{ loading: claiming }" @click="claimPacket">
              <div class="coin-inner">
                <img src="/img/logo-256x256.png" alt="Open" />
                <div class="coin-reflection"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Claim list -->
      <div v-if="claims.length > 0" class="claim-list">
        <div v-for="(c, i) in claims.slice(0, 8)" :key="i" class="claim-row">
          <div class="claim-user">
            <img class="claim-avatar" :src="getAvatar(c.user, c.user?.username)" alt="avatar" />
            <div class="claim-name">{{ c.user?.username ? '@' + c.user.username : c.user?.telegramId ? '#' + c.user.telegramId : '匿名用户' }}</div>
          </div>
          <div class="claim-amount">{{ c.amount || '0' }} SCASH</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.claim-page {
  background: radial-gradient(circle at center, #4a0a0a 0%, #0f0f13 100%);
  min-height: 100vh;
  padding: 0;
  position: relative;
}
.dark-mode {
  --text-main: #111827;
 --text-sub: rgba(17,24,39,0.72);
}
.close-btn { position:fixed; top:14px; right:14px; z-index:60; width:36px; height:36px; border-radius:999px; border:1px solid rgba(255,255,255,.28); background:rgba(0,0,0,.28); color:#fff; font-size:22px; line-height:1; cursor:pointer; }
.home-btn { position:fixed; top:14px; left:14px; z-index:60; min-width:36px; height:36px; padding:0 10px; border-radius:999px; border:1px solid rgba(255,255,255,.28); background:rgba(0,0,0,.28); color:#fff; font-size:13px; font-weight:700; line-height:34px; text-align:center; cursor:pointer; }
.scene { min-height: calc(100vh - 120px); display:flex; align-items:center; justify-content:center; padding-top:0; }
.perspective-container { perspective:1500px; width:100%; display:flex; justify-content:center; }
.env-wrapper { position:relative; width:84vw; max-width:316px; height:66vh; max-height:450px; transform-style:preserve-3d; transform:rotateX(5deg) translateY(0); transition:transform .6s cubic-bezier(.34,1.56,.64,1); }
.env-wrapper.settled { height:58vh; max-height:390px; }
.env-back { position:absolute; inset:0; border-radius:12px; z-index:1; box-shadow:inset 0 0 40px rgba(0,0,0,.3); }
.env-letter { position:absolute; bottom:15px; left:15px; right:15px; top:15px; background:var(--inner-bg, #fffdf5); border-radius:8px; z-index:2; transition:transform .8s cubic-bezier(.34,1.56,.64,1) .5s, box-shadow .8s .5s; box-shadow:0 4px 12px rgba(0,0,0,.1); display:flex; flex-direction:column; align-items:center; padding:22px 18px; text-align:center; background-image:repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(212,40,40,.04) 10px, rgba(212,40,40,.04) 20px); }
.env-front { position:absolute; bottom:0; left:0; right:0; height:75%; background:linear-gradient(135deg, #d42828 0%, #b81f1f 100%); border-radius:0 0 12px 12px; z-index:3; box-shadow:0 -5px 20px rgba(0,0,0,.25); border-top:1px solid rgba(255,255,255,.15); }
.env-flap { position:absolute; top:0; left:0; right:0; height:42%; background:linear-gradient(180deg, #db3030 0%, #c42626 100%); border-radius:12px 12px 50% 50%/12px 12px 35% 35%; transform-origin:top center; z-index:4; box-shadow:0 8px 20px rgba(0,0,0,.2); transition:transform .6s cubic-bezier(.4,0,.2,1), z-index 0s .3s; border-bottom:2px solid rgba(255,255,255,.2); }
.sender-info { transition:opacity .3s ease; }
.env-wrapper.open .sender-info { opacity:0; pointer-events:none; }
.env-coin { position:absolute; top:42%; left:50%; transform:translate(-50%,-50%); width:92px; height:92px; background:#fff; border-radius:50%; border:1px solid rgba(0,0,0,.05); z-index:10; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:transform .4s cubic-bezier(.175,.885,.32,1.275); box-shadow:0 8px 24px rgba(0,0,0,.15), inset 0 4px 6px rgba(255,255,255,1), inset 0 -2px 6px rgba(0,0,0,.05), 0 0 20px rgba(212,40,40,.5); animation:coin-pulse 2s infinite alternate ease-in-out; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.env-coin.loading { pointer-events:none!important; animation:none!important; }
.env-coin.loading .coin-inner img { animation:logo-spin .9s linear infinite; }
@keyframes logo-spin { 0% { transform:rotate(0deg); } 100% { transform:rotate(360deg); } }
@keyframes coin-pulse { 0% { box-shadow:0 8px 24px rgba(0,0,0,.15), inset 0 4px 6px rgba(255,255,255,1), inset 0 -2px 6px rgba(0,0,0,.05), 0 0 10px rgba(212,40,40,.2);} 100% { box-shadow:0 8px 24px rgba(0,0,0,.15), inset 0 4px 6px rgba(255,255,255,1), inset 0 -2px 6px rgba(0,0,0,.05), 0 0 34px rgba(212,40,40,.8);} }
.coin-inner { position:relative; width:78px; height:78px; border-radius:50%; overflow:hidden; box-shadow:inset 0 2px 4px rgba(0,0,0,.1); background:#fff; pointer-events:none; }
.coin-inner img { width:100%; height:100%; object-fit:cover; pointer-events:none; }
.coin-reflection { position:absolute; inset:0; border-radius:50%; background:linear-gradient(135deg, rgba(255,255,255,.7) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,.1) 100%); pointer-events:none; }
.env-wrapper.open { transform:rotateX(0deg) translateY(2vh); }
.env-wrapper.open .env-flap { transform:rotateX(180deg); z-index:1; }
.env-wrapper.open .env-letter { transform:translateY(-28%); box-shadow:0 15px 30px rgba(0,0,0,.3); z-index:5; }
.env-wrapper.open .env-coin { animation:none!important; transform:translate(-50%,-50%) scale(0)!important; opacity:0; pointer-events:none; }
.amount-main { display:flex; align-items:flex-end; justify-content:center; gap:6px; }
.amount-int { font-size:44px; font-weight:900; color:#dc2626; line-height:1; }
.amount-decimal { font-size:22px; font-weight:800; color:#dc2626; line-height:1.05; }
.amount-logo { width:20px; height:20px; object-fit:contain; margin-bottom:5px; }
.claim-list { margin:12px auto 0; width:84vw; max-width:316px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:8px 10px; }
.claim-row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 0; border-bottom:1px dashed rgba(255,255,255,.12); }
.claim-row:last-child { border-bottom:none; }
.claim-user { display:flex; align-items:center; gap:8px; min-width:0; }
.claim-avatar { width:24px; height:24px; border-radius:999px; object-fit:cover; border:1px solid rgba(255,255,255,.22); background:#fff; }
.claim-name { color:#f3f4f6; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px; }
.claim-amount { color:#fde68a; font-size:12px; font-weight:700; white-space:nowrap; }
</style>