import { randomUUID } from 'node:crypto'
import {
  RANGES,
  RANGE_CONFIG,
  type MarketSnapshot,
  type Quote,
} from '../shared/types.js'
import {
  validQuote,
  type CandleUpdate,
  type MarketFrame,
} from '../shared/protocol.js'
/** Capture before batching so intermediate price extremes survive in candle OHLC. */
export const createMarketHub = (source: () => MarketSnapshot) => {
  const localSession = randomUUID()
  let localSequence = 0
  const latest = new Map<string, Quote>()
  const changed = new Set<string>()
  const buckets = new Map<string, CandleUpdate>()
  const pendingBars = new Map<string, CandleUpdate>()
  let statusChanged = true
  let statusKey = ''
  const capture = (): void => {
    const state = source()
    const key = `${state.status.state}:${state.status.message}`
    if (key !== statusKey) {
      statusKey = key
      statusChanged = true
    }
    for (const q of state.quotes) {
      const old = latest.get(q.symbol)
      if (
        q === old ||
        !validQuote(q) ||
        (old && (q.updatedAt < old.updatedAt || q.quoteAt < old.quoteAt))
      )
        continue
      if (
        old &&
        Object.keys(q).every(
          (k) => q[k as keyof Quote] === old[k as keyof Quote],
        )
      )
        continue
      latest.set(q.symbol, q)
      changed.add(q.symbol)
      for (const range of RANGES) {
        const bucketKey = `${q.symbol}:${range}`,
          seconds = RANGE_CONFIG[range].seconds
        const time = Math.floor(q.updatedAt / 1000 / seconds) * seconds
        const previous = buckets.get(bucketKey)
        if (previous && time < previous.candle.time) continue
        const deltaVolume = old ? Math.max(0, q.volume - old.volume) : 0
        const candle =
          previous?.candle.time === time
            ? {
              ...previous.candle,
              high: Math.max(previous.candle.high, q.price),
              low: Math.min(previous.candle.low, q.price),
              close: q.price,
              volume: previous.candle.volume + deltaVolume,
            }
            : {
              time,
              open: q.price,
              high: q.price,
              low: q.price,
              close: q.price,
              volume: deltaVolume,
            }
        const update = { symbol: q.symbol, range, candle }
        buckets.set(bucketKey, update)
        pendingBars.set(`${bucketKey}:${time}`, update)
      }
    }
  }

  const snapshot = (): MarketFrame => {
    const state = source()
    return {
      type: 'snapshot',
      session: localSession,
      sequence: localSequence,
      assets: state.assets,
      quotes: [...latest.values()],
      status: state.status,
      trails: state.trails,
      candles: [...buckets.values()],
    }
  }

  const flush = (): MarketFrame | null => {
    if (!changed.size && !statusChanged) return null
    const state = source(),
      symbols = [...changed]
    const frame: MarketFrame = {
      type: 'delta',
      session: localSession,
      sequence: ++localSequence,
      quotes: symbols.map((s) => latest.get(s)!),
      status: state.status,
      trails: Object.fromEntries(
        symbols.map((s) => [s, state.trails[s] ?? []]),
      ),
      candles: [...pendingBars.values()],
    }
    changed.clear()
    pendingBars.clear()
    statusChanged = false
    return frame
  }

  return { capture, snapshot, flush, session: localSession, getSequence: (): number => localSequence }
}
export type MarketHub = ReturnType<typeof createMarketHub>
