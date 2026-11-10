import { z } from 'zod'
import type { AlpacaEvent } from './schemas.js'
import type { Quote } from '../../shared/types.js'
const schema = z.discriminatedUnion('T', [
  z.object({
    T: z.literal('t'),
    S: z.string(),
    t: z.string(),
    p: z.number().finite().positive(),
    s: z.number().finite().nonnegative(),
    i: z.union([z.string(), z.number()]).optional(),
  }),
  z
    .object({
      T: z.literal('q'),
      S: z.string(),
      t: z.string(),
      bp: z.number().finite().positive(),
      ap: z.number().finite().positive(),
    })
    .refine((e) => e.bp <= e.ap),
])
export const createEventProcessor = () => {
  const trades = new Map<string, number>()
  const quotes = new Map<string, number>()
  const seen = new Set<string>()
  const localMetrics = { accepted: 0, duplicate: 0, invalid: 0, delayed: 0 }
  const process = (
    input: AlpacaEvent,
    existing: Quote | undefined,
    previousClose: number | null,
    now = Date.now(),
  ): Quote | undefined => {
    const result = schema.safeParse(input)
    if (!result.success) {
      localMetrics.invalid++
      return
    }
    const e = result.data,
      timestamp = Date.parse(e.t)
    if (
      !Number.isFinite(timestamp) ||
      timestamp > now + 5000 ||
      now - timestamp > 60000
    ) {
      localMetrics.delayed++
      return
    }
    const channel = e.T === 't' ? trades : quotes
    if (timestamp < (channel.get(e.S) ?? 0)) {
      localMetrics.delayed++
      return
    }
    const id =
      e.T === 't'
        ? `t:${e.S}:${e.t.slice(0, 10)}:${e.i ?? `${e.t}:${e.p}:${e.s}`}`
        : `q:${e.S}:${e.t}:${e.bp}:${e.ap}`
    if (seen.has(id)) {
      localMetrics.duplicate++
      return
    }
    seen.add(id)
    if (seen.size > 20000)
      seen.delete(seen.values().next().value!)
    channel.set(e.S, timestamp)
    const price = e.T === 't' ? e.p : (existing?.price ?? (e.bp + e.ap) / 2)
    localMetrics.accepted++
    return {
      symbol: e.S,
      price,
      priceAt: e.T === 't' ? timestamp : (existing?.priceAt ?? timestamp),
      bid: e.T === 'q' ? e.bp : (existing?.bid ?? 0),
      ask: e.T === 'q' ? e.ap : (existing?.ask ?? 0),
      quoteAt: e.T === 'q' ? timestamp : (existing?.quoteAt ?? 0),
      updatedAt: Math.max(timestamp, existing?.updatedAt ?? 0),
      previousClose,
      changePct: previousClose ? (price / previousClose - 1) * 100 : null,
      high: Math.max(existing?.high ?? price, price),
      low: Math.min(existing?.low ?? price, price),
      volume: (existing?.volume ?? 0) + (e.T === 't' ? e.s : 0),
    }
  }

  return { process, metrics: localMetrics }
}
export type EventProcessor = ReturnType<typeof createEventProcessor>
