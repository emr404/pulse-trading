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
export class MarketHub {
  readonly session = randomUUID()
  sequence = 0
  private latest = new Map<string, Quote>()
  private changed = new Set<string>()
  private buckets = new Map<string, CandleUpdate>()
  private pendingBars = new Map<string, CandleUpdate>()
  private statusChanged = true
  private statusKey = ''
  constructor(private source: () => MarketSnapshot) {}
  capture(): void {
    const state = this.source()
    const key = `${state.status.state}:${state.status.message}`
    if (key !== this.statusKey) {
      this.statusKey = key
      this.statusChanged = true
    }
    for (const q of state.quotes) {
      const old = this.latest.get(q.symbol)
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
      this.latest.set(q.symbol, q)
      this.changed.add(q.symbol)
      for (const range of RANGES) {
        const bucketKey = `${q.symbol}:${range}`,
          seconds = RANGE_CONFIG[range].seconds
        const time = Math.floor(q.updatedAt / 1000 / seconds) * seconds
        const previous = this.buckets.get(bucketKey)
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
        this.buckets.set(bucketKey, update)
        this.pendingBars.set(`${bucketKey}:${time}`, update)
      }
    }
  }
  snapshot(): MarketFrame {
    const state = this.source()
    return {
      type: 'snapshot',
      session: this.session,
      sequence: this.sequence,
      assets: state.assets,
      quotes: [...this.latest.values()],
      status: state.status,
      trails: state.trails,
      candles: [...this.buckets.values()],
    }
  }
  flush(): MarketFrame | null {
    if (!this.changed.size && !this.statusChanged) return null
    const state = this.source(),
      symbols = [...this.changed]
    const frame: MarketFrame = {
      type: 'delta',
      session: this.session,
      sequence: ++this.sequence,
      quotes: symbols.map((s) => this.latest.get(s)!),
      status: state.status,
      trails: Object.fromEntries(
        symbols.map((s) => [s, state.trails[s] ?? []]),
      ),
      candles: [...this.pendingBars.values()],
    }
    this.changed.clear()
    this.pendingBars.clear()
    this.statusChanged = false
    return frame
  }
}
