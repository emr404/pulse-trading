import type { Candle } from '../../../shared/types'
/** Merge an absolute cumulative live bucket without counting its volume twice. */
export function mergeLiveCandle(
  history: Candle | undefined,
  live: Candle,
  previousLiveVolume = 0,
): Candle {
  if (!history || history.time !== live.time) return { ...live }
  return {
    ...history,
    high: Math.max(history.high, live.high),
    low: Math.min(history.low, live.low),
    close: live.close,
    volume: history.volume + Math.max(0, live.volume - previousLiveVolume),
  }
}
