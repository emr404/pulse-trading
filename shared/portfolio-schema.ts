import { z } from 'zod'
const finite = z.number().finite()
export const requestSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  quantity: finite.positive(),
  state: z.enum(['pending', 'filled', 'cancelled', 'rejected']),
  createdAt: finite,
  updatedAt: finite,
  reason: z.string().optional(),
  fillId: z.string().optional(),
})
export const portfolioMessageSchema = z.object({
  initialCash: finite.positive(),
  cash: finite.nonnegative(),
  realizedPnl: finite,
  positions: z.array(
    z.object({
      symbol: z.string(),
      quantity: finite.positive(),
      averagePrice: finite.positive(),
    }),
  ),
  orders: z.array(
    z.object({
      id: z.string(),
      symbol: z.string(),
      side: z.enum(['buy', 'sell']),
      quantity: finite.positive(),
      price: finite.positive(),
      total: finite.positive(),
      createdAt: finite,
      mode: z.enum(['live', 'demo']),
    }),
  ),
  requests: z.array(requestSchema).optional(),
})
