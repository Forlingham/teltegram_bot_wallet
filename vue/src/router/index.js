import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import WalletHomePage from '../views/WalletHomePage.vue'
import CreateWalletPage from '../views/CreateWalletPage.vue'
import ImportWalletPage from '../views/ImportWalletPage.vue'
import SendPage from '../views/SendPage.vue'
import ReceivePage from '../views/ReceivePage.vue'
import SettingsPage from '../views/SettingsPage.vue'
import HistoryPage from '../views/HistoryPage.vue'
import AboutPage from '../views/AboutPage.vue'
import RedpacketPage from '../views/RedpacketPage.vue'
import BindPage from '../views/BindPage.vue'
import InscribePage from '../views/InscribePage.vue'
import RecoverPage from '../views/RecoverPage.vue'

const routes = [
  { path: '/', name: 'Home', component: HomePage },
  { path: '/wallet', name: 'WalletHome', component: WalletHomePage },
  { path: '/wallet/create', name: 'CreateWallet', component: CreateWalletPage },
  { path: '/wallet/import', name: 'ImportWallet', component: ImportWalletPage },
  { path: '/wallet/send', name: 'Send', component: SendPage },
  { path: '/wallet/receive', name: 'Receive', component: ReceivePage },
  { path: '/wallet/settings', name: 'Settings', component: SettingsPage },
  { path: '/wallet/history', name: 'History', component: HistoryPage },
  { path: '/wallet/about', name: 'About', component: AboutPage },
  { path: '/wallet/redpacket', name: 'Redpacket', component: RedpacketPage },
  { path: '/wallet/bind', name: 'Bind', component: BindPage },
  { path: '/wallet/inscribe', name: 'Inscribe', component: InscribePage },
  { path: '/wallet/recover', name: 'Recover', component: RecoverPage },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router