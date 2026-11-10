import { z } from 'zod'
import type { ExchangeRates } from '../shared/currency.js'
const rowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  base: z.literal('USD'),
  quote: z.enum(['GBP', 'EUR']),
  rate: z.number().finite().positive(),
})
export const createExchangeRateService = () => {
  let cache: ExchangeRates | undefined = undefined
  let fetchedAt = 0
  let retryAt = 0
  let pending: Promise<ExchangeRates> | undefined = undefined
  const get = async (): Promise<ExchangeRates> => {
    if (cache && Date.now() - fetchedAt < 3600000) return cache
    if (Date.now() < retryAt) {
      if (cache) return { ...cache, cached: true }
      throw new Error(
        'Exchange rates are unavailable. USD display remains available.',
      )
    }
    if (pending) return pending
    pending = fetchRates().finally(() => {
      pending = undefined
    })
    return pending
  }

  const fetchRates = async (): Promise<ExchangeRates> => {
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
      cache = {
        base: 'USD',
        date: gbp.date,
        rates: { USD: 1, GBP: gbp.rate, EUR: eur.rate },
        cached: false,
      }
      fetchedAt = Date.now()
      return cache
    } catch {
      retryAt = Date.now() + 60000
      if (cache) return { ...cache, cached: true }
      throw new Error(
        'Exchange rates are unavailable. USD display remains available.',
      )
    }
  }

  return { get }
}
export type ExchangeRateService = ReturnType<typeof createExchangeRateService>
