import type { Candle, MarketSnapshot, Range } from '../../shared/types.js'
export interface MarketProvider {
  snapshot(): MarketSnapshot
  start(onUpdate: () => void): void
  stop(): void
  candles(symbol: string, range: Range): Promise<Candle[]>
}
