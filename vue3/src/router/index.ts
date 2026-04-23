import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const mainRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/wallet',
  },
  {
    path: '/wallet',
    name: 'home',
    component: () => import('@/views/HomePage.vue'),
    meta: { activeNav: 'home', title: 'SCASH 钱包' },
  },
  {
    path: '/wallet/create',
    name: 'wallet-create',
    component: () => import('@/views/CreatePage.vue'),
    meta: { title: '创建钱包' },
  },
  {
    path: '/wallet/import',
    name: 'wallet-import',
    component: () => import('@/views/ImportPage.vue'),
    meta: { title: '导入钱包' },
  },
  {
    path: '/wallet/bind',
    name: 'wallet-bind',
    component: () => import('@/views/BindPage.vue'),
    meta: { title: '绑定钱包' },
  },
  {
    path: '/wallet/send',
    name: 'wallet-send',
    component: () => import('@/views/SendPage.vue'),
    meta: { requireFullWallet: true, title: '发送' },
  },
  {
    path: '/wallet/receive',
    name: 'wallet-receive',
    component: () => import('@/views/ReceivePage.vue'),
    meta: { title: '接收' },
  },
  {
    path: '/wallet/inscribe',
    name: 'wallet-inscribe',
    component: () => import('@/views/InscribePage.vue'),
    meta: { requireFullWallet: true, title: '刻字上链' },
  },
  {
    path: '/wallet/recover',
    name: 'wallet-recover',
    component: () => import('@/views/RecoverPage.vue'),
    meta: { requireFullWallet: true, title: '备份助记词' },
  },
  {
    path: '/wallet/settings',
    name: 'wallet-settings',
    component: () => import('@/views/SettingsPage.vue'),
    meta: { requireAnyWallet: true, title: '设置' },
  },
  {
    path: '/wallet/history',
    name: 'wallet-history',
    component: () => import('@/views/HistoryPage.vue'),
    meta: { activeNav: 'history', title: '交易记录' },
  },
  {
    path: '/wallet/redpacket',
    name: 'wallet-redpacket',
    component: () => import('@/views/RedpacketPage.vue'),
    meta: { activeNav: 'redpacket', title: '红包' },
  },
  {
    path: '/wallet/redpacket/create',
    name: 'wallet-redpacket-create',
    component: () => import('@/views/redpacket/CreatePage.vue'),
    meta: { requireFullWallet: true, title: '发红包' },
  },
  {
    path: '/wallet/about',
    name: 'wallet-about',
    component: () => import('@/views/AboutPage.vue'),
    meta: { activeNav: 'about', title: '关于' },
  },
]

const claimRoutes: RouteRecordRaw[] = [
  {
    path: '/open',
    name: 'redpacket-claim',
    component: () => import('@/views/redpacket/ClaimPage.vue'),
    meta: { layout: 'claim', backAsClose: true, title: '领取红包' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes: [...mainRoutes, ...claimRoutes],
})

router.beforeEach((to) => {
  const title = (to.meta.title as string) || 'SCASH 钱包'
  document.title = title
})

export default router