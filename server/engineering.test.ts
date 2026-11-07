import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effect, stop } from 'vue'
import { ASSETS, type MarketSnapshot, type Quote } from '../shared/types.js'
import { MarketHub } from './market-hub.js'
import { EventProcessor } from './providers/event-processor.js'
import { OrderManager } from './order-manager.js'
import { freshPortfolio } from './trading.js'
import { useMarket } from '../src/modules/market/store'
import { usePortfolio } from '../src/modules/portfolio/store'
import { valuePortfolio } from '../src/modules/portfolio/valuation'
import { mergeLiveCandle } from '../src/modules/chart/aggregate'
const quote = (symbol = 'AAPL', price = 100): Quote => ({
  symbol,
  price,
  bid: price - 1,
  ask: price + 1,
  previousClose: 100,
  changePct: price - 100,
  high: price,
  low: price,
  volume: 0,
  updatedAt: Date.now(),
  quoteAt: Date.now(),
})
const snapshot = (): MarketSnapshot => ({
  assets: ASSETS,
  quotes: [quote(), quote('NVDA')],
  trails: {},
  status: {
    mode: 'demo',
    state: 'connected',
    message: '',
    provider: 'test',
    lastMessageAt: Date.now(),
  },
})
afterEach(() => vi.useRealTimers())
describe('event integrity and batching', () => {
  it('rejects duplicates, invalid/future/delayed events while treating quote and trade clocks independently', () => {
    const processor = new EventProcessor(),
      now = Date.now()
    const trade = {
      T: 't',
      S: 'AAPL',
      t: new Date(now - 1000).toISOString(),
      p: 100,
      s: 10,
      i: 1,
    }
    const first = processor.process(trade, undefined, 90, now)!
    expect(first.volume).toBe(10)
    expect(processor.process(trade, first, 90, now)).toBeUndefined()
    const bidask = processor.process(
      { T: 'q', S: 'AAPL', t: new Date(now).toISOString(), bp: 99, ap: 101 },
      first,
      90,
      now,
    )!
    const second = processor.process(
      { ...trade, t: new Date(now - 500).toISOString(), i: 2, p: 102 },
      bidask,
      90,
      now,
    )!
    expect(second.volume).toBe(20)
    expect(second.quoteAt).toBe(now)
    expect(
      processor.process({ ...trade, i: 3 }, second, 90, now),
    ).toBeUndefined()
    for (const event of [
      { ...trade, p: -1 },
      { ...trade, t: new Date(now + 6000).toISOString() },
      { T: 'q', S: 'AAPL', t: new Date(now).toISOString(), bp: 101, ap: 99 },
    ])
      expect(processor.process(event, second, 90, now)).toBeUndefined()
  })
  it('retains intra-batch highs/lows, total volume and bucket transitions', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1800000000000)
    const state = snapshot(),
      hub = new MarketHub(() => state)
    hub.capture()
    hub.flush()
    for (const [price, volume] of [
      [110, 10],
      [90, 20],
      [105, 30],
    ]) {
      state.quotes[0] = { ...state.quotes[0], price, volume }
      hub.capture()
    }
    vi.advanceTimersByTime(300000)
    state.quotes[0] = {
      ...state.quotes[0],
      price: 108,
      volume: 40,
      updatedAt: Date.now(),
      quoteAt: Date.now(),
    }
    hub.capture()
    const frame = hub.flush()!
    const bars = frame.candles.filter(
      (b) => b.symbol === 'AAPL' && b.range === '1D',
    )
    expect(bars).toHaveLength(2)
    expect(bars[0].candle).toMatchObject({
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 30,
    })
    expect(bars[1].candle.volume).toBe(10)
    expect(frame.quotes).toHaveLength(1)
  })
  it('merges absolute live volume without double-counting repeated updates', () => {
    const history = {
      time: 100,
      open: 100,
      close: 101,
      high: 102,
      low: 99,
      volume: 1000,
    }
    const live = { ...history, high: 110, low: 90, volume: 30 }
    const merged = mergeLiveCandle(history, live, 10)
    expect(merged.volume).toBe(1020)
    expect(mergeLiveCandle(merged, live, 30).volume).toBe(1020)
    expect(merged.high).toBe(110)
  })
})
describe('granular reactivity under load', () => {
  it('handles 10,000 updates across 50 stocks without invalidating unrelated quote/portfolio effects', () => {
    setActivePinia(createPinia())
    const market = useMarket(),
      account = usePortfolio(),
      state = snapshot()
    state.quotes = Array.from({ length: 50 }, (_, i) => quote(`S${i}`))
    const hub = new MarketHub(() => state)
    hub.capture()
    market.apply(hub.snapshot())
    account.apply({
      ...freshPortfolio(),
      positions: [{ symbol: 'S0', quantity: 2, averagePrice: 100 }],
    })
    let selectedRenders = 0,
      unrelatedRenders = 0,
      portfolioRenders = 0
    const selected = effect(() => {
      void market.quotes.S0
      selectedRenders++
    })
    const other = effect(() => {
      void market.quotes.S49
      unrelatedRenders++
    })
    const portfolio = effect(() => {
      void account.equity
      portfolioRenders++
    })
    const started = performance.now()
    for (let i = 0; i < 10000; i++) {
      const index = 1 + (i % 48)
      state.quotes[index] = {
        ...state.quotes[index],
        price: 100 + i / 1000,
        volume: i,
      }
      hub.capture()
      if (i % 100 === 99) market.apply(hub.flush()!)
    }
    expect(selectedRenders).toBe(1)
    expect(unrelatedRenders).toBe(1)
    expect(portfolioRenders).toBe(1)
    expect(market.metrics.frames).toBe(101)
    expect(market.metrics.quoteWrites).toBeLessThan(5000)
    console.log(
      `10,000 events / 50 stocks: ${(performance.now() - started).toFixed(0)}ms; ${market.metrics.quoteWrites} quote writes; unchanged symbol/portfolio effects: 1 each`,
    )
    stop(selected)
    stop(other)
    stop(portfolio)
  })
  it('flags individual prices stale even while the transport stays connected', () => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    const market = useMarket(),
      state = snapshot(),
      hub = new MarketHub(() => state)
    hub.capture()
    market.apply(hub.snapshot())
    market.transport = 'connected'
    market.tick()
    expect(market.stale.AAPL).toBe(false)
    vi.advanceTimersByTime(61000)
    market.tick()
    expect(market.stale.AAPL).toBe(true)
    expect(market.connected).toBe(true)
  })
})
describe('order lifecycle and valuation', () => {
  function setup() {
    let value = freshPortfolio()
    const state = snapshot()
    const store = {
      get: () => structuredClone(value),
      save: (next: typeof value) => {
        value = structuredClone(next)
        return value
      },
    }
    const manager = new OrderManager(
      store,
      () => state,
      () => {},
    )
    return { manager, store, state }
  }
  it('fills once per idempotency key and cancels without changing cash', () => {
    vi.useFakeTimers()
    const { manager, store } = setup()
    const input = { symbol: 'AAPL', side: 'buy' as const, quantity: 1 }
    manager.submit('one', input)
    manager.submit('one', input)
    expect(manager.get('one')?.state).toBe('pending')
    vi.advanceTimersByTime(700)
    expect(manager.get('one')?.state).toBe('filled')
    expect(store.get().orders).toHaveLength(1)
    expect(store.get().cash).toBe(9899)
    manager.submit('two', input)
    manager.cancel('two')
    vi.advanceTimersByTime(700)
    expect(manager.get('two')?.state).toBe('cancelled')
    expect(store.get().cash).toBe(9899)
    expect(() => manager.submit('one', { ...input, quantity: 2 })).toThrow(
      'different',
    )
    manager.stop()
  })
  it('rejects insufficient funds and disconnect/stale quotes at execution, then recovers interrupted pending requests', () => {
    vi.useFakeTimers()
    const { manager, store, state } = setup()
    manager.submit('large', { symbol: 'AAPL', side: 'buy', quantity: 10000 })
    vi.advanceTimersByTime(700)
    expect(manager.get('large')?.state).toBe('rejected')
    expect(store.get().cash).toBe(10000)
    manager.submit('offline', { symbol: 'AAPL', side: 'buy', quantity: 1 })
    state.status.state = 'disconnected'
    vi.advanceTimersByTime(700)
    expect(manager.get('offline')?.state).toBe('rejected')
    state.status.state = 'connected'
    state.quotes[0].quoteAt -= 61000
    manager.submit('stale', { symbol: 'AAPL', side: 'buy', quantity: 1 })
    vi.advanceTimersByTime(700)
    expect(manager.get('stale')?.state).toBe('rejected')
    manager.submit('restart', { symbol: 'AAPL', side: 'buy', quantity: 1 })
    const restarted = new OrderManager(
      store,
      () => state,
      () => {},
    )
    expect(restarted.get('restart')?.state).toBe('cancelled')
    manager.stop()
    restarted.stop()
  })
  it('uses decimal valuation with cost fallback for missing quotes', () => {
    const p = {
      ...freshPortfolio(),
      cash: 0.1,
      positions: [{ symbol: 'AAPL', quantity: 0.2, averagePrice: 1 }],
    }
    expect(valuePortfolio(p, () => ({ ...quote(), price: 0.1 })).equity).toBe(
      0.12,
    )
    expect(valuePortfolio(p, () => undefined).marketValue).toBe(0.2)
  })
})
