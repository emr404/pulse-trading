import { describe, expect, it, vi } from 'vitest'
import { ASSETS, RANGES, RANGE_CONFIG } from '../../shared/types.js'
import { DemoProvider, demoCandles } from './demo.js'
describe('simulated provider', () => {
  it('makes valid deterministic OHLC and distinct date ranges', () => {
    const now = 1800000000000
    for (const range of RANGES) {
      const bars = demoCandles(ASSETS[0], range, 200, now)
      expect(bars).toEqual(demoCandles(ASSETS[0], range, 200, now))
      expect(bars.at(-1)?.close).toBeCloseTo(200)
      for (let i = 0; i < bars.length; i++) {
        expect(bars[i].high).toBeGreaterThanOrEqual(
          Math.max(bars[i].open, bars[i].close),
        )
        expect(bars[i].low).toBeLessThanOrEqual(
          Math.min(bars[i].open, bars[i].close),
        )
        if (i)
          expect(bars[i].time - bars[i - 1].time).toBe(
            RANGE_CONFIG[range].seconds,
          )
      }
    }
  })
  it('streams labelled demo updates and stops cleanly', () => {
    vi.useFakeTimers()
    const provider = new DemoProvider(ASSETS)
    const listener = vi.fn()
    provider.start(listener)
    expect(provider.snapshot().status.mode).toBe('demo')
    vi.advanceTimersByTime(3600)
    expect(listener).toHaveBeenCalledTimes(3)
    provider.stop()
    vi.advanceTimersByTime(3600)
    expect(listener).toHaveBeenCalledTimes(3)
    vi.useRealTimers()
  })
})
