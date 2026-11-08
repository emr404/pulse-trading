import { computed, ref, watch } from 'vue'
import { useMarket } from '../modules/market/store'
import { usePortfolio } from '../modules/portfolio/store'
import { defineStore, storeToRefs } from 'pinia'
import type { Range } from '../../shared/types'
import { z } from 'zod'
import { readLocal, writeLocal } from '../lib/storage'
export type Page =
  | 'Markets'
  | 'Watchlist'
  | 'Portfolio'
  | 'Activity'
export const useTerminal = defineStore('terminal', () => {
  const market = useMarket(),
    account = usePortfolio()
  const { assets, status, transport, now, connection, connected } =
    storeToRefs(market)
  const {
    portfolio,
    marketValue,
    equity,
    unrealized,
    totalPnl,
    valuationEstimated,
  } = storeToRefs(account)
  const quotes = market.quotes,
    trails = market.trails,
    flashes = market.flashes
  const page = ref<Page>('Markets')
  const selected = ref('AAPL')
  const range = ref<Range>('1D')
  const savedWatchlist = readLocal(
    'pulse:stocks:watchlist',
    z.array(z.string()),
    ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'GOOGL'],
  )
  const watchlist = ref<string[]>(savedWatchlist)
  const flashEnabled = ref(
    readLocal('pulse:flash', z.boolean(), true) !== false,
  )
  const notificationsOpen = ref(false)
  const notice = ref('')
  const activeQuote = computed(() => quotes[selected.value])
  const activeAsset = computed(() =>
    assets.value.find((a) => a.symbol === selected.value),
  )
  const held = computed(
    () =>
      portfolio.value?.positions.find((p) => p.symbol === selected.value)
        ?.quantity ?? 0,
  )
  const canTrade = computed(
    () =>
      connected.value &&
      !market.stale[selected.value] &&
      !!activeQuote.value &&
      now.value - activeQuote.value.quoteAt < 60000 &&
      activeQuote.value.bid > 0 &&
      activeQuote.value.ask > 0,
  )
  function select(symbol: string): void {
    selected.value = symbol
  }
  function openStock(symbol: string): void {
    select(symbol)
    if (!['Markets', 'Watchlist'].includes(page.value))
      page.value = 'Markets'
  }
  function toggleWatch(symbol: string): void {
    watchlist.value = watchlist.value.includes(symbol)
      ? watchlist.value.filter((s) => s !== symbol)
      : [...watchlist.value, symbol]
  }
  watch(watchlist, (value) => writeLocal('pulse:stocks:watchlist', value), {
    deep: true,
  })
  watch(flashEnabled, (value) => writeLocal('pulse:flash', value))
  return {
    assets,
    quotes,
    trails,
    status,
    transport,
    portfolio,
    page,
    selected,
    range,
    watchlist,
    flashes,
    stale: market.stale,
    flashEnabled,
    notificationsOpen,
    notice,
    now,
    activeQuote,
    activeAsset,
    connection,
    connected,
    marketValue,
    equity,
    unrealized,
    totalPnl,
    held,
    canTrade,
    valuationEstimated,
    select,
    openStock,
    toggleWatch,
  }
})
