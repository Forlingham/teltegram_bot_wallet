import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import HomePage from '@/views/HomePage.vue'
import CreatePage from '@/views/CreatePage.vue'
import ImportPage from '@/views/ImportPage.vue'
import BindPage from '@/views/BindPage.vue'
import SendPage from '@/views/SendPage.vue'
import ReceivePage from '@/views/ReceivePage.vue'
import InscribePage from '@/views/InscribePage.vue'
import RecoverPage from '@/views/RecoverPage.vue'
import SettingsPage from '@/views/SettingsPage.vue'
import HistoryPage from '@/views/HistoryPage.vue'
import RedpacketPage from '@/views/RedpacketPage.vue'
import CreateRedpacketPage from '@/views/redpacket/CreatePage.vue'
import ClaimPage from '@/views/redpacket/ClaimPage.vue'
import AboutPage from '@/views/AboutPage.vue'
import { t } from '@/i18n'

const mainRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/wallet',
  },
  {
    path: '/wallet',
    name: 'home',
    component: HomePage,
    meta: { activeNav: 'home', titleKey: 'route.home' },
  },
  {
    path: '/wallet/create',
    name: 'wallet-create',
    component: CreatePage,
    meta: { titleKey: 'route.walletCreate' },
  },
  {
    path: '/wallet/import',
    name: 'wallet-import',
    component: ImportPage,
    meta: { titleKey: 'route.walletImport' },
  },
  {
    path: '/wallet/bind',
    name: 'wallet-bind',
    component: BindPage,
    meta: { titleKey: 'route.walletBind' },
  },
  {
    path: '/wallet/send',
    name: 'wallet-send',
    component: SendPage,
    meta: { requireFullWallet: true, titleKey: 'route.walletSend' },
  },
  {
    path: '/wallet/receive',
    name: 'wallet-receive',
    component: ReceivePage,
    meta: { titleKey: 'route.walletReceive' },
  },
  {
    path: '/wallet/inscribe',
    name: 'wallet-inscribe',
    component: InscribePage,
    meta: { requireFullWallet: true, titleKey: 'route.walletInscribe' },
  },
  {
    path: '/wallet/recover',
    name: 'wallet-recover',
    component: RecoverPage,
    meta: { requireFullWallet: true, titleKey: 'route.walletRecover' },
  },
  {
    path: '/wallet/settings',
    name: 'wallet-settings',
    component: SettingsPage,
    meta: { requireAnyWallet: true, titleKey: 'route.walletSettings' },
  },
  {
    path: '/wallet/history',
    name: 'wallet-history',
    component: HistoryPage,
    meta: { activeNav: 'history', titleKey: 'route.walletHistory' },
  },
  {
    path: '/wallet/redpacket',
    name: 'wallet-redpacket',
    component: RedpacketPage,
    meta: { activeNav: 'redpacket', requireAnyWallet: true, titleKey: 'route.walletRedpacket' },
  },
  {
    path: '/wallet/redpacket/create',
    name: 'wallet-redpacket-create',
    component: CreateRedpacketPage,
    meta: { requireFullWallet: true, titleKey: 'route.walletRedpacketCreate' },
  },
  {
    path: '/wallet/about',
    name: 'wallet-about',
    component: AboutPage,
    meta: { activeNav: 'about', titleKey: 'route.walletAbout' },
  },
]

const claimRoutes: RouteRecordRaw[] = [
  {
    path: '/open',
    name: 'redpacket-claim',
    component: ClaimPage,
    meta: { layout: 'claim', backAsClose: true, titleKey: 'route.redpacketClaim' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes: [...mainRoutes, ...claimRoutes],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const key = (to.meta.titleKey as string | undefined) || 'route.home'
  document.title = t(key)
})

export default router
