import { z } from 'zod'
import { candleSchema } from './protocol.js'
import { portfolioMessageSchema, requestSchema } from './portfolio-schema.js'

export const apiErrorSchema = z.object({ error: z.string().min(1) })
export const orderResponseSchema = z.object({
  order: requestSchema,
  portfolio: portfolioMessageSchema,
})
export const candleResponseSchema = z.object({
  candles: z.array(candleSchema),
  mode: z.enum(['demo', 'live']),
  live: z
    .array(
      z.object({
        symbol: z.string(),
        range: z.enum(['1D', '1W', '1M', '3M', '1Y']),
        candle: candleSchema,
      }),
    )
    .default([]),
})
export type OrderResponse = z.infer<typeof orderResponseSchema>
export type CandleResponse = z.infer<typeof candleResponseSchema>
