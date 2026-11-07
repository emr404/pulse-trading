import { z } from 'zod'
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
export class EventProcessor {
  private trades = new Map<string, number>()
  private quotes = new Map<string, number>()
  private seen = new Set<string>()
  readonly metrics = { accepted: 0, duplicate: 0, invalid: 0, delayed: 0 }
  process(
    input: unknown,
    existing: Quote | undefined,
    previousClose: number | null,
    now = Date.now(),
  ): Quote | undefined {
    const result = schema.safeParse(input)
    if (!result.success) {
      this.metrics.invalid++
      return
    }
    const e = result.data,
      timestamp = Date.parse(e.t)
    if (
      !Number.isFinite(timestamp) ||
      timestamp > now + 5000 ||
      now - timestamp > 60000
    ) {
      this.metrics.delayed++
      return
    }
    const channel = e.T === 't' ? this.trades : this.quotes
    if (timestamp < (channel.get(e.S) ?? 0)) {
      this.metrics.delayed++
      return
    }
    const id =
      e.T === 't'
        ? `t:${e.S}:${e.t.slice(0, 10)}:${e.i ?? `${e.t}:${e.p}:${e.s}`}`
        : `q:${e.S}:${e.t}:${e.bp}:${e.ap}`
    if (this.seen.has(id)) {
      this.metrics.duplicate++
      return
    }
    this.seen.add(id)
    if (this.seen.size > 20000)
      this.seen.delete(this.seen.values().next().value!)
    channel.set(e.S, timestamp)
    const price = e.T === 't' ? e.p : (existing?.price ?? (e.bp + e.ap) / 2)
    this.metrics.accepted++
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
}
