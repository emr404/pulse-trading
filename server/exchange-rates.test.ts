import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExchangeRateService } from './exchange-rates.js'
const rows = [
  { date: '2026-11-06', base: 'USD', quote: 'GBP', rate: 0.8 },
  { date: '2026-11-06', base: 'USD', quote: 'EUR', rate: 0.9 },
]
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe('reference exchange rates', () => {
  it('validates rates, coalesces requests and caches successful fetches', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => rows })
    vi.stubGlobal('fetch', fetcher)
    const service = new ExchangeRateService()
    const [one, two] = await Promise.all([service.get(), service.get()])
    expect(one).toEqual(two)
    expect(one.rates).toEqual({ USD: 1, GBP: 0.8, EUR: 0.9 })
    await service.get()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('labels cached rates on provider failure and rejects incomplete responses', async () => {
    vi.useFakeTimers()
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => rows })
      .mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetcher)
    const service = new ExchangeRateService()
    await service.get()
    vi.advanceTimersByTime(3600001)
    expect((await service.get()).cached).toBe(true)
    expect((await service.get()).rates.GBP).toBe(0.8)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [rows[0]] }),
    )
    await expect(new ExchangeRateService().get()).rejects.toThrow('unavailable')
  })
})
