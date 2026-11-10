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
  const market = useMarket()
  const account = usePortfolio()
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
  const quotes = market.quotes
  const trails = market.trails
  const flashes = market.flashes
  const page = ref<Page>('Markets')
  const selectedSymbol = ref('AAPL')
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
  const activeQuote = computed(() => quotes[selectedSymbol.value])
  const activeAsset = computed(() =>
    assets.value.find((a) => a.symbol === selectedSymbol.value),
  )
  const heldQuantity = computed(
    () =>
      portfolio.value?.positions.find((p) => p.symbol === selectedSymbol.value)
        ?.quantity ?? 0,
  )
  const canTrade = computed(
    () =>
      connected.value &&
      !market.stale[selectedSymbol.value] &&
      !!activeQuote.value &&
      now.value - activeQuote.value.quoteAt < 60000 &&
      activeQuote.value.bid > 0 &&
      activeQuote.value.ask > 0,
  )
  const selectStock = (symbol: string): void => {
    selectedSymbol.value = symbol
  }
  const openStock = (symbol: string): void => {
    selectStock(symbol)
    if (!['Markets', 'Watchlist'].includes(page.value))
      page.value = 'Markets'
  }
  const toggleWatchlist = (symbol: string): void => {
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
    selectedSymbol,
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
    heldQuantity,
    canTrade,
    valuationEstimated,
    selectStock,
    openStock,
    toggleWatchlist,
  }
})
