import { z } from 'zod'
import type { ExchangeRates } from '../shared/currency.js'
const rowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  base: z.literal('USD'),
  quote: z.enum(['GBP', 'EUR']),
  rate: z.number().finite().positive(),
})
export class ExchangeRateService {
  private cache?: ExchangeRates
  private fetchedAt = 0
  private retryAt = 0
  private pending?: Promise<ExchangeRates>
  async get(): Promise<ExchangeRates> {
    if (this.cache && Date.now() - this.fetchedAt < 3600000) return this.cache
    if (Date.now() < this.retryAt) {
      if (this.cache) return { ...this.cache, cached: true }
      throw new Error(
        'Exchange rates are unavailable. USD display remains available.',
      )
    }
    if (this.pending) return this.pending
    this.pending = this.fetchRates().finally(() => {
      this.pending = undefined
    })
    return this.pending
  }
  private async fetchRates(): Promise<ExchangeRates> {
    try {
      const response = await fetch(
        'https://api.frankfurter.dev/v2/rates?base=USD&quotes=GBP,EUR&providers=ECB',
        { signal: AbortSignal.timeout(8000) },
      )
      if (!response.ok) throw new Error('Rate provider unavailable.')
      const rows = z.array(rowSchema).parse(await response.json())
      const gbp = rows.find((r) => r.quote === 'GBP'),
        eur = rows.find((r) => r.quote === 'EUR')
      if (!gbp || !eur || gbp.date !== eur.date)
        throw new Error('Incomplete exchange rates.')
      this.cache = {
        base: 'USD',
        date: gbp.date,
        rates: { USD: 1, GBP: gbp.rate, EUR: eur.rate },
        cached: false,
      }
      this.fetchedAt = Date.now()
      return this.cache
    } catch {
      this.retryAt = Date.now() + 60000
      if (this.cache) return { ...this.cache, cached: true }
      throw new Error(
        'Exchange rates are unavailable. USD display remains available.',
      )
    }
  }
}
