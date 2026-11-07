import { shallowReactive, shallowRef, ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Asset, Quote, FeedStatus } from '../../../shared/types'
import {
  staleQuote,
  type CandleUpdate,
  type MarketFrame,
} from '../../../shared/protocol'
export const useMarket = defineStore('market', () => {
  const assets = shallowRef<Asset[]>([])
  const quotes = shallowReactive<Record<string, Quote>>({})
  const trails = shallowReactive<Record<string, number[]>>({})
  const flashes = shallowReactive<Record<string, 'up' | 'down'>>({})
  const stale = shallowReactive<Record<string, boolean>>({})
  const status = shallowReactive<FeedStatus>({
    mode: 'demo',
    state: 'connecting',
    lastMessageAt: null,
    message: 'Connecting…',
    provider: 'Simulation engine',
  })
  const transport = ref<FeedStatus['state']>('connecting')
  const synchronized = ref(false)
  const now = ref(Date.now())
  const revision = ref(0)
  const connection = computed(() =>
    transport.value === 'connected' ? status.state : transport.value,
  )
  const connected = computed(
    () => connection.value === 'connected' && synchronized.value,
  )
  const listeners = new Map<string, Set<(update: CandleUpdate) => void>>()
  const metrics = { frames: 0, quoteWrites: 0, chartEvents: 0 }
  function apply(frame: MarketFrame) {
    metrics.frames++
    if (frame.type === 'snapshot') {
      if (
        frame.assets &&
        JSON.stringify(assets.value) !== JSON.stringify(frame.assets)
      )
        assets.value = frame.assets
      const present = new Set(frame.quotes.map((q) => q.symbol))
      for (const symbol of Object.keys(quotes))
        if (!present.has(symbol)) {
          delete quotes[symbol]
          delete trails[symbol]
          stale[symbol] = true
        }
      synchronized.value = true
      revision.value++
    }
    for (const q of frame.quotes) {
      const previous = quotes[q.symbol]
      if (
        frame.type !== 'snapshot' &&
        previous &&
        (q.updatedAt < previous.updatedAt || q.quoteAt < previous.quoteAt)
      )
        continue
      if (
        previous &&
        Object.keys(q).every(
          (k) => q[k as keyof Quote] === previous[k as keyof Quote],
        )
      )
        continue
      if (previous && previous.price !== q.price)
        flashes[q.symbol] = q.price > previous.price ? 'up' : 'down'
      quotes[q.symbol] = q
      metrics.quoteWrites++
      stale[q.symbol] = staleQuote(q, Date.now())
    }
    for (const [symbol, values] of Object.entries(frame.trails))
      trails[symbol] = values
    Object.assign(status, frame.status)
    for (const update of frame.candles) {
      metrics.chartEvents++
      listeners
        .get(`${update.symbol}:${update.range}`)
        ?.forEach((listener) => listener(update))
    }
  }
  function tick() {
    now.value = Date.now()
    for (const symbol of Object.keys(quotes)) {
      const value = staleQuote(quotes[symbol], now.value) || !connected.value
      if (stale[symbol] !== value) stale[symbol] = value
    }
  }
  function subscribe(key: string, listener: (update: CandleUpdate) => void) {
    const set = listeners.get(key) ?? new Set()
    set.add(listener)
    listeners.set(key, set)
    return () => {
      set.delete(listener)
      if (!set.size) listeners.delete(key)
    }
  }
  return {
    assets,
    quotes,
    trails,
    flashes,
    stale,
    status,
    transport,
    synchronized,
    now,
    revision,
    connection,
    connected,
    metrics,
    apply,
    tick,
    subscribe,
  }
})
