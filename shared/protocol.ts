import { z } from 'zod'
import type {
  Asset,
  Candle,
  FeedStatus,
  Portfolio,
  Quote,
  Range,
} from './types.js'
export const quoteSchema = z
  .object({
    symbol: z.string().regex(/^[A-Z][A-Z0-9.\-]{0,9}$/),
    price: z.number().finite().positive(),
    bid: z.number().finite().nonnegative(),
    ask: z.number().finite().nonnegative(),
    changePct: z.number().finite().nullable(),
    previousClose: z.number().finite().positive().nullable(),
    high: z.number().finite().positive(),
    low: z.number().finite().positive(),
    volume: z.number().finite().nonnegative(),
    priceAt: z.number().finite().nonnegative().optional(),
    updatedAt: z.number().finite().nonnegative(),
    quoteAt: z.number().finite().nonnegative(),
  })
  .refine(
    (q) => q.high >= q.low && (q.bid === 0 || q.ask === 0 || q.bid <= q.ask),
  )
export const candleSchema = z
  .object({
    time: z.number().finite().nonnegative(),
    open: z.number().finite().positive(),
    high: z.number().finite().positive(),
    low: z.number().finite().positive(),
    close: z.number().finite().positive(),
    volume: z.number().finite().nonnegative(),
  })
  .refine(
    (b) =>
      b.high >= Math.max(b.open, b.close) && b.low <= Math.min(b.open, b.close),
  )
const statusSchema = z.object({
  mode: z.enum(['live', 'demo']),
  state: z.enum(['connecting', 'connected', 'reconnecting', 'disconnected']),
  lastMessageAt: z.number().nullable(),
  message: z.string(),
  provider: z.string(),
})
const assetSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  sector: z.string(),
  color: z.string(),
  demoPrice: z.number(),
  demoChange: z.number(),
})
export interface CandleUpdate {
  symbol: string
  range: Range
  candle: Candle
}
export interface MarketFrame {
  type: 'snapshot' | 'delta'
  session: string
  sequence: number
  assets?: Asset[]
  quotes: Quote[]
  status: FeedStatus
  trails: Record<string, number[]>
  candles: CandleUpdate[]
}
export const marketFrameSchema = z.object({
  type: z.enum(['snapshot', 'delta']),
  session: z.string(),
  sequence: z.number().int().nonnegative(),
  assets: z.array(assetSchema).optional(),
  quotes: z.array(quoteSchema),
  status: statusSchema,
  trails: z.record(z.string(), z.array(z.number().finite().positive()).max(30)),
  candles: z.array(
    z.object({
      symbol: z.string(),
      range: z.enum(['1D', '1W', '1M', '3M', '1Y']),
      candle: candleSchema,
    }),
  ),
})
export type ServerMessage =
  | MarketFrame
  | { type: 'portfolio'; data: Portfolio }
  | { type: 'heartbeat'; session: string; sequence: number }
export const STALE_AFTER_MS = 60000
export function validQuote(q: Quote, now = Date.now()) {
  return (
    quoteSchema.safeParse(q).success &&
    q.updatedAt <= now + 5000 &&
    q.quoteAt <= now + 5000 &&
    (q.priceAt === undefined || q.priceAt <= now + 5000)
  )
}
export function staleQuote(q: Quote | undefined, now: number) {
  return (
    !q ||
    now - (q.priceAt ?? q.updatedAt) > STALE_AFTER_MS ||
    (q.priceAt ?? q.updatedAt) > now + 5000
  )
}
