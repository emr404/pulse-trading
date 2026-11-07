import { z } from 'zod'
export const CURRENCIES = ['USD', 'GBP', 'EUR'] as const
export type Currency = (typeof CURRENCIES)[number]
export const exchangeRatesSchema = z.object({
  base: z.literal('USD'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.object({
    USD: z.literal(1),
    GBP: z.number().finite().positive(),
    EUR: z.number().finite().positive(),
  }),
  cached: z.boolean(),
})
export type ExchangeRates = z.infer<typeof exchangeRatesSchema>
