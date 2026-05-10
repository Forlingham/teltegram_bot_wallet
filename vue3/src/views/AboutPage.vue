<script setup lang="ts">
import { computed, h, type VNode } from 'vue'
import { useI18n } from '@/i18n'
import CopyButton from '@/components/CopyButton.vue'

const { t, locale } = useI18n()

const donateAddresses = [
  { label: 'BTC', address: 'bc1qnvdrxs23t6ejuxjs6mswx7cez2rn80wrwjd0u8' },
  { label: 'BNB', address: '0xD4dB57B007Ad386C2fC4d7DD146f5977c039Fefc' },
  { label: 'USDT (BEP-20)', address: '0xD4dB57B007Ad386C2fC4d7DD146f5977c039Fefc' },
  { label: 'SCASH', address: 'scash1qy48v7frkutlthqq7uqs8lk5fam24tghjdxqtf5' },
]

/**
 * Render a translation string with inline **bold** markers replaced
 * by a strong tag with primary color. Keeps marketing copy readable
 * without embedding HTML directly in the message files.
 */
function renderMarkdownish(key: string): VNode[] {
  void locale.value
  const text = t(key)
  const nodes: VNode[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(h('span', text.slice(last, m.index)))
    nodes.push(h('strong', { class: 'text-primary' }, m[1]))
    last = re.lastIndex
  }
  if (last < text.length) nodes.push(h('span', text.slice(last)))
  return nodes
}

const renderedPositioning = computed(() => renderMarkdownish('about.positioningBody'))
const renderedCustodial = computed(() => renderMarkdownish('about.howItWorksNonCustodial'))
const renderedBackup = computed(() => renderMarkdownish('about.howItWorksBackup'))
const renderedWatch = computed(() => renderMarkdownish('about.howItWorksWatch'))
const renderedMnemonicBody1 = computed(() => renderMarkdownish('about.mnemonicBody1'))
const renderedMnemonicBody2 = computed(() => renderMarkdownish('about.mnemonicBody2'))
const renderedRpFeat1 = computed(() => renderMarkdownish('about.redpacketFeature1'))
const renderedRpFeat2 = computed(() => renderMarkdownish('about.redpacketFeature2'))
const renderedRpFeat3 = computed(() => renderMarkdownish('about.redpacketFeature3'))
const renderedRpFeat4 = computed(() => renderMarkdownish('about.redpacketFeature4'))
const renderedRpFeat5 = computed(() => renderMarkdownish('about.redpacketFeature5'))
const renderedRpModes = computed(() => renderMarkdownish('about.redpacketModes'))

/**
 * For the architecture list we keep the `<strong>: </strong>` pattern.
 * Each entry's source reads like "Backend: NestJS + TypeScript" — we
 * split on the first colon so the label becomes bold.
 */
function splitArchLine(key: string): { label: string; rest: string } {
  void locale.value
  const line = t(key)
  const idx = line.indexOf(':')
  if (idx === -1) return { label: '', rest: line }
  return { label: line.slice(0, idx), rest: line.slice(idx + 1).trim() }
}
const archLines = computed(() => [
  splitArchLine('about.archBackend'),
  splitArchLine('about.archFrontend'),
  splitArchLine('about.archDb'),
  splitArchLine('about.archChain'),
  splitArchLine('about.archWallet'),
  splitArchLine('about.archDap'),
  splitArchLine('about.archDerive'),
])
</script>

<template>
  <div class="relative overflow-hidden mb-6">
    <div class="absolute -top-16 -right-16 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
    <div class="bg-surface-container-lowest rounded-lg p-6 shadow-[0px_12px_32px_rgba(44,47,49,0.06)] relative overflow-hidden">
      <div class="absolute -bottom-8 -right-8 w-32 h-32 bg-primary-container/10 rounded-full blur-2xl"></div>
      <div class="relative z-10 text-center">
        <div class="w-20 h-20 rounded-2xl primary-gradient flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
          <span class="material-symbols-outlined text-on-primary text-4xl" style="font-variation-settings: 'FILL' 1;">account_balance_wallet</span>
        </div>
        <h1 class="font-headline text-2xl font-extrabold text-on-surface mb-2">{{ t('about.title') }}</h1>
        <p class="text-on-surface-variant text-sm font-medium">{{ t('about.tagline') }}</p>
      </div>
    </div>
  </div>

  <section class="bg-surface-container-lowest rounded-lg p-5 mb-4 shadow-[0px_12px_32px_rgba(44,47,49,0.06)]">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">home</span>
      </div>
      <h2 class="font-headline text-lg font-bold text-on-surface">{{ t('about.positioning') }}</h2>
    </div>
    <p class="text-sm text-on-surface leading-relaxed">
      <template v-for="(node, i) in renderedPositioning" :key="i">
        <component :is="node" />
      </template>
    </p>
  </section>

  <section class="bg-surface-container-lowest rounded-lg p-5 mb-4 shadow-[0px_12px_32px_rgba(44,47,49,0.06)]">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">lock</span>
      </div>
      <h2 class="font-headline text-lg font-bold text-on-surface">{{ t('about.howItWorks') }}</h2>
    </div>
    <div class="space-y-4">
      <p class="text-sm text-on-surface leading-relaxed">
        <template v-for="(node, i) in renderedCustodial" :key="i"><component :is="node" /></template>
      </p>
      <p class="text-sm text-on-surface leading-relaxed">
        <template v-for="(node, i) in renderedBackup" :key="i"><component :is="node" /></template>
      </p>
      <p class="text-sm text-on-surface leading-relaxed">
        <template v-for="(node, i) in renderedWatch" :key="i"><component :is="node" /></template>
      </p>
    </div>
  </section>

  <section class="bg-surface-container-lowest rounded-lg p-5 mb-4 shadow-[0px_12px_32px_rgba(44,47,49,0.06)] border-l-4 border-primary">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">verified_user</span>
      </div>
      <h2 class="font-headline text-lg font-bold text-on-surface">{{ t('about.mnemonicSafety') }}</h2>
    </div>
    <p class="text-sm text-on-surface leading-relaxed mb-3">
      <template v-for="(node, i) in renderedMnemonicBody1" :key="i"><component :is="node" /></template>
    </p>
    <p class="text-sm text-on-surface leading-relaxed mb-3">
      <template v-for="(node, i) in renderedMnemonicBody2" :key="i"><component :is="node" /></template>
    </p>
    <ul class="space-y-2 mb-4 ml-4">
      <li class="flex items-center gap-2 text-sm text-on-surface">
        <span class="material-symbols-outlined text-primary text-lg">check_circle</span>{{ t('about.mnemonicTip1') }}
      </li>
      <li class="flex items-center gap-2 text-sm text-on-surface">
        <span class="material-symbols-outlined text-primary text-lg">check_circle</span>{{ t('about.mnemonicTip2') }}
      </li>
      <li class="flex items-center gap-2 text-sm text-on-surface">
        <span class="material-symbols-outlined text-primary text-lg">check_circle</span>{{ t('about.mnemonicTip3') }}
      </li>
      <li class="flex items-center gap-2 text-sm text-on-surface">
        <span class="material-symbols-outlined text-primary text-lg">check_circle</span>{{ t('about.mnemonicTip4') }}
      </li>
      <li class="flex items-center gap-2 text-sm text-on-surface">
        <span class="material-symbols-outlined text-primary text-lg">check_circle</span>{{ t('about.mnemonicTip5') }}
      </li>
    </ul>
    <div class="bg-error/5 border border-error/20 rounded-lg p-4">
      <p class="text-sm text-error font-bold">{{ t('about.mnemonicWarning') }}</p>
    </div>
  </section>

  <section class="bg-surface-container-lowest rounded-lg p-5 mb-4 shadow-[0px_12px_32px_rgba(44,47,49,0.06)]">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center">
        <span class="material-symbols-outlined text-tertiary" style="font-variation-settings: 'FILL' 1;">celebration</span>
      </div>
      <h2 class="font-headline text-lg font-bold text-on-surface">{{ t('about.redpacket') }}</h2>
    </div>
    <p class="text-sm text-on-surface leading-relaxed mb-3">{{ t('about.redpacketIntro') }}</p>
    <ul class="space-y-3 mb-4">
      <li class="flex items-start gap-3 text-sm text-on-surface">
        <span class="material-symbols-outlined text-tertiary mt-0.5" style="font-variation-settings: 'FILL' 1;">diamond</span>
        <span>
          <template v-for="(node, i) in renderedRpFeat1" :key="i"><component :is="node" /></template>
        </span>
      </li>
      <li class="flex items-start gap-3 text-sm text-on-surface">
        <span class="material-symbols-outlined text-tertiary mt-0.5" style="font-variation-settings: 'FILL' 1;">hub</span>
        <span>
          <template v-for="(node, i) in renderedRpFeat2" :key="i"><component :is="node" /></template>
        </span>
      </li>
      <li class="flex items-start gap-3 text-sm text-on-surface">
        <span class="material-symbols-outlined text-tertiary mt-0.5" style="font-variation-settings: 'FILL' 1;">visibility</span>
        <span>
          <template v-for="(node, i) in renderedRpFeat3" :key="i"><component :is="node" /></template>
        </span>
      </li>
      <li class="flex items-start gap-3 text-sm text-on-surface">
        <span class="material-symbols-outlined text-tertiary mt-0.5" style="font-variation-settings: 'FILL' 1;">account_balance</span>
        <span>
          <template v-for="(node, i) in renderedRpFeat4" :key="i"><component :is="node" /></template>
        </span>
      </li>
      <li class="flex items-start gap-3 text-sm text-on-surface">
        <span class="material-symbols-outlined text-tertiary mt-0.5" style="font-variation-settings: 'FILL' 1;">cloud_done</span>
        <span>
          <template v-for="(node, i) in renderedRpFeat5" :key="i"><component :is="node" /></template>
        </span>
      </li>
    </ul>
    <p class="text-sm text-on-surface leading-relaxed">
      <template v-for="(node, i) in renderedRpModes" :key="i"><component :is="node" /></template>
    </p>
  </section>

  <section class="bg-surface-container-lowest rounded-lg p-5 mb-4 shadow-[0px_12px_32px_rgba(44,47,49,0.06)]">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
        <span class="material-symbols-outlined text-on-surface-variant" style="font-variation-settings: 'FILL' 1;">code</span>
      </div>
      <h2 class="font-headline text-lg font-bold text-on-surface">{{ t('about.architecture') }}</h2>
    </div>
    <ul class="space-y-3">
      <li v-for="(line, i) in archLines" :key="i" class="flex items-center gap-3 text-sm text-on-surface">
        <span class="w-2 h-2 rounded-full bg-primary"></span>
        <span><strong v-if="line.label">{{ line.label }}:</strong> {{ line.rest }}</span>
      </li>
    </ul>
  </section>

  <section class="bg-surface-container-lowest rounded-lg p-5 mb-4 shadow-[0px_12px_32px_rgba(44,47,49,0.06)]">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <svg class="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      </div>
      <h2 class="font-headline text-lg font-bold text-on-surface">{{ t('about.openSource') }}</h2>
    </div>
    <p class="text-sm text-on-surface leading-relaxed mb-3">
      {{ t('about.openSourceBody') }}
    </p>
    <a
      href="https://github.com/Forlingham/teltegram_bot_wallet"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-start gap-2 text-sm text-primary font-bold bg-primary/5 px-3 py-2 rounded-lg active:scale-[0.98] transition-transform break-all"
    >
      <svg class="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      <span class="break-all">github.com/Forlingham/teltegram_bot_wallet</span>
    </a>
  </section>

  <section class="bg-surface-container-lowest rounded-lg p-5 mb-6 shadow-[0px_12px_32px_rgba(44,47,49,0.06)] border border-dashed border-outline-variant">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
        <span class="material-symbols-outlined text-warning" style="font-variation-settings: 'FILL' 1;">volunteer_activism</span>
      </div>
      <h2 class="font-headline text-lg font-bold text-on-surface">{{ t('about.donate') }}</h2>
    </div>
    <p class="text-sm text-on-surface leading-relaxed mb-4">{{ t('about.donateBody') }}</p>
    <div class="space-y-3">
      <div v-for="item in donateAddresses" :key="item.label" class="bg-surface-container-low rounded-lg p-3 flex items-center justify-between gap-3">
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-on-surface-variant uppercase mb-1">{{ item.label }}</p>
          <p class="text-xs mono text-primary break-all">{{ item.address }}</p>
        </div>
        <CopyButton :text="item.address" />
      </div>
    </div>
    <p class="text-xs text-on-surface-variant mt-4 leading-relaxed">{{ t('about.donateFooter') }}</p>
  </section>
</template>
