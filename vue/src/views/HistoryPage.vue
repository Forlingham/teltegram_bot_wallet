<script setup>
import AppLayout from '../components/AppLayout.vue'
import Icon from '../components/Icon.vue'
import Card from '../components/Card.vue'
import CoinLogo from '../components/CoinLogo.vue'

const transactions = [
  {
    type: 'transfer',
    direction: 'out',
    amount: '100.00',
    time: '2024.01.15 14:30:25',
    txid: 'abc123...xyz789',
    status: 'confirmed'
  },
  {
    type: 'transfer',
    direction: 'in',
    amount: '50.25',
    time: '2024.01.14 09:15:00',
    txid: 'def456...uvw012',
    status: 'confirmed'
  },
  {
    type: 'redpacket',
    redpacketType: 'CLAIM',
    amount: '10.00',
    time: '2024.01.13 18:45:30',
    txid: 'ghi789...rst345',
    status: 'confirmed'
  }
]

const formatTxid = (txid) => {
  if (!txid) return '-'
  if (txid.length <= 20) return txid
  return txid.slice(0, 6) + '...' + txid.slice(-6)
}
</script>

<template>
  <AppLayout title="记录" active-nav="history">
    <div id="txList">
      <div v-if="transactions.length === 0" class="text-center py-12 text-on-surface-variant text-sm">
        暂无交易记录
      </div>

      <section v-for="(tx, index) in transactions" :key="index" class="bg-surface-container-lowest rounded-lg p-5 shadow-ambient relative overflow-hidden group mb-4">
        <div class="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors"></div>

        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-10 h-10 rounded-full flex items-center justify-center',
                tx.direction === 'in' ? 'bg-tertiary/10' : 'bg-error/10'
              ]"
            >
              <Icon
                :name="tx.direction === 'in' ? 'call_received' : 'call_made'"
                :class="tx.direction === 'in' ? 'text-tertiary' : 'text-error'"
                filled
              />
            </div>
            <div>
              <p class="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-0.5">
                {{ tx.type === 'redpacket' ? '收到的红包' : '链上转账' }}
              </p>
              <h3 :class="['font-headline', tx.direction === 'in' ? 'text-tertiary' : 'text-error']">
                <span class="text-xl font-bold">{{ tx.direction === 'in' ? '+' : '-' }}</span>{{ tx.amount }}
                <CoinLogo :size="16" class="inline-block ml-1" />
              </h3>
            </div>
          </div>
          <span class="px-3 py-1 bg-surface-container-low text-on-surface-variant text-[11px] font-extrabold rounded-full tracking-wide">
            {{ tx.direction === 'in' ? '转入' : '转出' }}
          </span>
        </div>

        <div class="flex flex-col gap-2 border-t border-surface-container pt-3">
          <div class="flex justify-between items-center text-[11px]">
            <span class="text-on-surface-variant font-medium">交易哈希 (Hash)</span>
            <span class="font-mono text-primary bg-primary/5 px-2 py-0.5 rounded text-[11px]">{{ formatTxid(tx.txid) }}</span>
          </div>
          <div class="flex justify-between items-center text-[11px]">
            <span class="text-on-surface-variant font-medium">时间</span>
            <span class="text-on-surface font-semibold">{{ tx.time }}</span>
          </div>
        </div>
      </section>
    </div>
  </AppLayout>
</template>