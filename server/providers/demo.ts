import {
  RANGE_CONFIG,
  type Asset,
  type Candle,
  type MarketSnapshot,
  type Range,
} from '../../shared/types.js'
import type { MarketProvider } from './types.js'
// A deterministic historical series, ending at the current simulated quote.
export function demoCandles(
  asset: Asset,
  range: Range,
  price: number,
  now = Date.now(),
): Candle[] {
  const { seconds, days } = RANGE_CONFIG[range]
  const count = Math.min(365, Math.floor((days * 86400) / seconds))
  let seed =
    [...(asset.symbol + range)].reduce(
      (n, c) => n * 31 + c.charCodeAt(0),
      1,
    ) >>> 0
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const end = Math.floor(now / 1000 / seconds) * seconds
  let close = price * (range === '1D' ? 0.99 : 0.85)
  const bars: Candle[] = []
  for (let i = 0; i < count; i++) {
    const open = close
    close = open * (1 + (random() - 0.46) * (range === '1D' ? 0.0025 : 0.018))
    bars.push({
      time: end - (count - 1 - i) * seconds,
      open,
      close,
      high: Math.max(open, close) * (1 + random() * 0.0025),
      low: Math.min(open, close) * (1 - random() * 0.0025),
      volume: Math.floor(15000 + random() * 400000),
    })
  }
  const factor = price / close
  return bars.map((b) => ({
    ...b,
    open: b.open * factor,
    high: b.high * factor,
    low: b.low * factor,
    close: b.close * factor,
  }))
}
export class DemoProvider implements MarketProvider {
  private timer?: ReturnType<typeof setInterval>
  private state: MarketSnapshot
  constructor(
    assets: Asset[],
    message = 'Simulated prices and historical data. No exchange connection.',
  ) {
    this.state = {
      assets,
      quotes: assets.map((a) => ({
        symbol: a.symbol,
        price: a.demoPrice,
        bid: a.demoPrice - 0.01,
        ask: a.demoPrice + 0.01,
        changePct: a.demoChange,
        previousClose: a.demoPrice / (1 + a.demoChange / 100),
        high: a.demoPrice * 1.012,
        low: a.demoPrice * 0.983,
        volume: Math.floor(12000000 + a.demoPrice * 80000),
        updatedAt: Date.now(),
        quoteAt: Date.now(),
      })),
      status: {
        mode: 'demo',
        state: 'connected',
        provider: 'Simulation engine',
        message,
        lastMessageAt: Date.now(),
      },
      trails: {},
    }
    for (const a of assets)
      this.state.trails[a.symbol] = demoCandles(a, '1D', a.demoPrice)
        .slice(-30)
        .map((b) => b.close)
  }
  snapshot() {
    return this.state
  }
  start(onUpdate: () => void) {
    this.timer = setInterval(() => {
      const now = Date.now()
      this.state.quotes = this.state.quotes.map((q) => {
        const price = Math.max(
          0.1,
          q.price * (1 + (Math.random() - 0.5) * 0.0006),
        )
        this.state.trails[q.symbol] = [
          ...this.state.trails[q.symbol].slice(-29),
          price,
        ]
        return {
          ...q,
          price,
          bid: price - 0.01,
          ask: price + 0.01,
          changePct: (price / q.previousClose! - 1) * 100,
          high: Math.max(price, q.high),
          low: Math.min(price, q.low),
          volume: q.volume + Math.floor(Math.random() * 1000),
          updatedAt: now,
          quoteAt: now,
        }
      })
      this.state.status.lastMessageAt = now
      onUpdate()
    }, 1800)
    onUpdate()
  }
  stop() {
    clearInterval(this.timer)
  }
  async candles(symbol: string, range: Range) {
    const asset = this.state.assets.find((a) => a.symbol === symbol)
    if (!asset) throw new Error('Unknown symbol.')
    return demoCandles(
      asset,
      range,
      this.state.quotes.find((q) => q.symbol === symbol)!.price,
    )
  }
}
