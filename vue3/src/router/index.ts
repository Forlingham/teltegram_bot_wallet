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

const mainRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/wallet',
  },
  {
    path: '/wallet',
    name: 'home',
    component: HomePage,
    meta: { activeNav: 'home', title: 'SCASH 钱包' },
  },
  {
    path: '/wallet/create',
    name: 'wallet-create',
    component: CreatePage,
    meta: { title: '创建钱包' },
  },
  {
    path: '/wallet/import',
    name: 'wallet-import',
    component: ImportPage,
    meta: { title: '导入钱包' },
  },
  {
    path: '/wallet/bind',
    name: 'wallet-bind',
    component: BindPage,
    meta: { title: '绑定钱包' },
  },
  {
    path: '/wallet/send',
    name: 'wallet-send',
    component: SendPage,
    meta: { requireFullWallet: true, title: '发送' },
  },
  {
    path: '/wallet/receive',
    name: 'wallet-receive',
    component: ReceivePage,
    meta: { title: '接收' },
  },
  {
    path: '/wallet/inscribe',
    name: 'wallet-inscribe',
    component: InscribePage,
    meta: { requireFullWallet: true, title: '刻字上链' },
  },
  {
    path: '/wallet/recover',
    name: 'wallet-recover',
    component: RecoverPage,
    meta: { requireFullWallet: true, title: '备份助记词' },
  },
  {
    path: '/wallet/settings',
    name: 'wallet-settings',
    component: SettingsPage,
    meta: { requireAnyWallet: true, title: '设置' },
  },
  {
    path: '/wallet/history',
    name: 'wallet-history',
    component: HistoryPage,
    meta: { activeNav: 'history', title: '交易记录' },
  },
  {
    path: '/wallet/redpacket',
    name: 'wallet-redpacket',
    component: RedpacketPage,
    meta: { activeNav: 'redpacket', title: '红包' },
  },
  {
    path: '/wallet/redpacket/create',
    name: 'wallet-redpacket-create',
    component: CreateRedpacketPage,
    meta: { requireFullWallet: true, title: '发红包' },
  },
  {
    path: '/wallet/about',
    name: 'wallet-about',
    component: AboutPage,
    meta: { activeNav: 'about', title: '关于' },
  },
]

const claimRoutes: RouteRecordRaw[] = [
  {
    path: '/open',
    name: 'redpacket-claim',
    component: ClaimPage,
    meta: { layout: 'claim', backAsClose: true, title: '领取红包' },
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
  const title = (to.meta.title as string) || 'SCASH 钱包'
  document.title = title
})

export default router