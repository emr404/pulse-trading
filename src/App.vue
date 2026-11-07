<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import {
  Activity,
  LayoutDashboard,
  ChartNoAxesCombined,
  Star,
  BriefcaseBusiness,
  History,
  Settings2,
  Search,
  Bell,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  PanelLeftClose,
  Menu,
  X,
  CircleHelp,
  ArrowRight,
  ShieldCheck,
} from 'lucide-vue-next'
import { useOrders } from './modules/orders/store'
import { useCurrency } from './stores/currency'
import { useTerminal, type Page } from './stores/terminal'
import { useMarketStream } from './composables/useMarketStream'
import { money, percent, time } from './lib/format'
import MarketStrip from './components/MarketStrip.vue'
import AccountSummary from './components/AccountSummary.vue'
import ConnectionBadge from './components/ConnectionBadge.vue'
import StatusBar from './components/StatusBar.vue'
import AssetPicker from './components/AssetPicker.vue'
import SparkLine from './components/SparkLine.vue'
import MarketChart from './components/MarketChart.vue'
import WatchlistPanel from './components/WatchlistPanel.vue'
import TradeTicket from './components/TradeTicket.vue'
import MarketMovers from './components/MarketMovers.vue'
import PortfolioPanel from './components/PortfolioPanel.vue'
import ActivityPanel from './components/ActivityPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'
const orders = useOrders()
onUnmounted(() => orders.stop())
const store = useTerminal()
const currency = useCurrency()
let fxTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void currency.refresh()
  fxTimer = setInterval(() => void currency.refresh(), 3600000)
})
onUnmounted(() => clearInterval(fxTimer))
const { reconnect } = useMarketStream()
const picker = ref(false),
  mobileNav = ref(false),
  collapsed = ref(false),
  profile = ref(false)
const nav = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Markets', icon: ChartNoAxesCombined },
  { name: 'Watchlist', icon: Star },
  { name: 'Portfolio', icon: BriefcaseBusiness },
  { name: 'Activity', icon: History },
] as const
const dashboard = computed(() =>
  ['Overview', 'Markets', 'Watchlist'].includes(store.page),
)
const overviewAssets = computed(() =>
  ['SPY', 'QQQ', 'DIA', 'NVDA']
    .map((s) => store.assets.find((a) => a.symbol === s))
    .filter((a) => a !== undefined),
)
const title = computed(
  () =>
    ({
      Overview: 'Market overview',
      Markets: 'Explore markets',
      Watchlist: 'Your watchlist',
      Portfolio: 'Your portfolio',
      Activity: 'Trading activity',
      Settings: 'Settings',
    })[store.page],
)
const subtitles: Record<Page, string> = {
  Overview: 'The market, in focus.',
  Markets: 'Find your next opportunity.',
  Watchlist: 'The companies you’re keeping an eye on.',
  Portfolio: 'Every position. A clearer perspective.',
  Activity: 'A record of every move.',
  Settings: 'Make this workspace yours.',
}
const session = computed(() => {
  if (store.status.mode === 'demo') return 'Simulated session'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(store.now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const minutes = Number(get('hour')) * 60 + Number(get('minute'))
  return !['Sat', 'Sun'].includes(get('weekday')) &&
    minutes >= 570 &&
    minutes < 960
    ? 'Regular hours*'
    : 'Outside regular hours*'
})
function toggleNotifications() {
  store.notificationsOpen = !store.notificationsOpen
  profile.value = false
}
function toggleProfile() {
  profile.value = !profile.value
  store.notificationsOpen = false
}
function dismissNotifications() {
  store.notice = ''
  store.notificationsOpen = false
}
function navigate(page: Page) {
  store.page = page
  mobileNav.value = false
  profile.value = false
  store.notificationsOpen = false
}
function shortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault()
    picker.value = !picker.value
  }
  if (event.key === 'Escape') {
    store.notificationsOpen = false
    profile.value = false
    mobileNav.value = false
  }
}
onMounted(() => document.addEventListener('keydown', shortcut))
onUnmounted(() => document.removeEventListener('keydown', shortcut))
</script>
<template>
  <div class="terminal" :class="{ 'nav-collapsed': collapsed }">
    <div v-if="mobileNav" class="nav-scrim" @click="mobileNav = false"></div>
    <aside class="sidebar" :class="{ 'mobile-open': mobileNav }">
      <a
        href="#"
        class="brand"
        aria-label="Pulse overview"
        @click.prevent="navigate('Overview')"
        ><span class="brand-icon"
          ><Activity :size="23" :stroke-width="2.4" /></span
        ><span>pulse<span class="brand-period">.</span></span
        ><span class="pro-tag">TERMINAL</span></a
      >
      <div class="workspace-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        <button
          v-for="item in nav"
          :key="item.name"
          :class="{ active: store.page === item.name }"
          :aria-current="store.page === item.name ? 'page' : undefined"
          :title="item.name"
          @click="navigate(item.name)"
        >
          <component :is="item.icon" :size="17" /><span>{{ item.name }}</span
          ><span v-if="item.name === 'Watchlist'" class="nav-count">{{
            store.watchlist.length
          }}</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <button
          class="side-setting"
          :class="{ active: store.page === 'Settings' }"
          @click="navigate('Settings')"
        >
          <Settings2 :size="17" /><span>Settings</span></button
        ><button
          class="side-setting collapse-nav"
          :aria-label="collapsed ? 'Expand navigation' : 'Collapse navigation'"
          @click="collapsed = !collapsed"
        >
          <PanelLeftClose :size="17" /><span>Collapse sidebar</span>
        </button>
        <div class="sidebar-version">
          <span class="status-dot"></span> PULSE TERMINAL <span>v1.0</span>
        </div>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <button
          class="icon-button mobile-menu"
          aria-label="Open navigation"
          @click="mobileNav = true"
        >
          <Menu :size="20" />
        </button>
        <div class="breadcrumbs">
          Workspace <span>/</span> <b>{{ store.page }}</b>
        </div>
        <button class="search-trigger" @click="picker = true">
          <Search :size="15" /><span>Search stocks, companies…</span
          ><kbd>⌘ K</kbd>
        </button>
        <div class="topbar-right">
          <select
            v-model="currency.selected"
            class="currency-select compact-currency"
            aria-label="Display currency"
          >
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
          </select>
          <span class="market-session"
            ><i
              class="status-dot"
              :class="{ amber: store.status.mode === 'demo' }"
            ></i
            >{{ session }}</span
          >
          <div class="top-divider"></div>
          <button
            class="icon-button notification-button"
            aria-label="Notifications"
            :aria-expanded="store.notificationsOpen"
            @click="toggleNotifications"
          >
            <Bell :size="18" /><i v-if="store.notice"></i></button
          ><button
            class="profile-trigger"
            aria-label="Account menu"
            :aria-expanded="profile"
            @click="toggleProfile"
          >
            <span>JD</span><ChevronDown :size="12" />
          </button>
        </div>
        <section
          v-if="store.notificationsOpen"
          class="top-popover"
          aria-label="Notifications"
        >
          <h3>Notifications</h3>
          <p>
            {{
              store.notice ||
              'You’re all caught up. Trade confirmations appear here.'
            }}
          </p>
          <div class="popover-separator"></div>
          <small>{{ store.status.message }}</small
          ><button class="text-button" @click="dismissNotifications">
            Mark as read
          </button>
        </section>
        <section v-if="profile" class="top-popover account-popover">
          <h3>Personal workspace</h3>
          <p>Local paper trading account</p>
          <strong>{{ money(store.equity) }}</strong
          ><button class="secondary-button" @click="navigate('Settings')">
            Account settings <ArrowRight :size="13" />
          </button>
        </section>
      </header>
      <main>
        <div class="page-heading">
          <div>
            <div class="heading-kicker">
              {{
                store.status.mode === 'demo'
                  ? 'PAPER TRADING WORKSPACE'
                  : 'LIVE DATA · PAPER TRADING'
              }}
            </div>
            <h1>{{ title }}<span>.</span></h1>
            <p>{{ subtitles[store.page] }}</p>
          </div>
          <ConnectionBadge />
        </div>
        <div class="simulation-banner">
          <span
            ><Radio :size="14" /><b>{{
              store.status.mode === 'demo'
                ? 'SIMULATED DATA'
                : store.status.provider.toUpperCase()
            }}</b
            ><span>{{
              store.status.mode === 'demo'
                ? 'Prices and charts are simulated. Your strategy, without the stakes.'
                : 'Exchange market data. All orders are simulated with virtual funds.'
            }}</span></span
          ><span class="banner-account"
            >Paper account <ShieldCheck :size="13"
          /></span>
        </div>
        <div
          v-if="!store.connected && store.assets.length"
          class="connection-alert"
          role="alert"
        >
          <span
            >{{
              store.connection === 'disconnected'
                ? 'Disconnected.'
                : 'Reconnecting to market data.'
            }}
            Orders are paused until fresh prices return.</span
          ><button class="text-button" @click="reconnect">
            Retry connection
          </button>
        </div>
        <div
          v-if="
            store.status.mode === 'live' &&
            store.status.state === 'disconnected'
          "
          class="connection-alert"
        >
          {{ store.status.message }}
        </div>
        <div v-if="currency.selected !== 'USD'" class="fx-notice" role="status">
          {{ currency.note }} · Display conversion only; all trades settle in
          USD.
        </div>
        <template v-if="dashboard"
          ><MarketStrip />
          <div class="dashboard-grid">
            <div class="chart-column"><MarketChart /><PortfolioPanel /></div>
            <div class="watch-column">
              <WatchlistPanel :all="store.page === 'Markets'" /><MarketMovers />
            </div>
            <div class="trade-column">
              <TradeTicket />
              <AccountSummary />
            </div>
          </div>
          <ActivityPanel compact
        /></template>
        <template v-else-if="store.page === 'Portfolio'"
          ><section class="portfolio-stats">
            <div>
              <span>Total equity</span
              ><strong>{{ money(store.equity) }}</strong>
            </div>
            <div>
              <span>Buying power</span
              ><strong>{{ money(store.portfolio?.cash) }}</strong>
            </div>
            <div>
              <span>Unrealised P/L</span
              ><strong
                :class="store.unrealized >= 0 ? 'positive' : 'negative'"
                >{{ money(store.unrealized) }}</strong
              >
            </div>
            <div>
              <span>Total return</span
              ><strong :class="store.totalPnl >= 0 ? 'positive' : 'negative'">{{
                percent(
                  store.portfolio
                    ? (store.totalPnl / store.portfolio.initialCash) * 100
                    : null,
                )
              }}</strong>
            </div>
          </section>
          <PortfolioPanel detailed /><ActivityPanel compact /></template
        ><ActivityPanel v-else-if="store.page === 'Activity'" /><SettingsPanel
          v-else
        />
        <footer>
          <span
            ><Activity :size="12" /> Pulse · Built for a clearer
            perspective.</span
          ><span
            >{{
              store.status.mode === 'demo'
                ? 'SIMULATED MARKET'
                : '* US weekday schedule; holidays not included'
            }}
            <span class="footer-dot">·</span> {{ currency.note }}</span
          >
        </footer>
      </main>
      <StatusBar />
    </div>
    <AssetPicker v-if="picker" @close="picker = false" />
  </div>
</template>
