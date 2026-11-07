import { validQuote, staleQuote } from '../shared/protocol.js'
import { randomUUID } from 'node:crypto'
import { Decimal } from 'decimal.js'
import { z } from 'zod'
import type { MarketMode, Portfolio, Quote } from '../shared/types.js'

export const symbolSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9.\-]{0,9}$/, 'Invalid stock symbol.')
export const orderSchema = z
  .object({
    symbol: symbolSchema,
    side: z.enum(['buy', 'sell']),
    quantity: z
      .number()
      .positive()
      .max(1_000_000)
      .refine(
        (value) => new Decimal(value).decimalPlaces() <= 8,
        'Use at most 8 decimal places.',
      ),
  })
  .strict()
export type OrderInput = z.infer<typeof orderSchema>
export class TradingError extends Error {}
export const freshPortfolio = (): Portfolio => ({
  requests: [],
  initialCash: 10_000,
  cash: 10_000,
  realizedPnl: 0,
  positions: [],
  orders: [],
})

/** Pure calculation: the caller persists the returned state before accepting a fill. */
export function executeOrder(
  current: Portfolio,
  input: OrderInput,
  quote: Quote | undefined,
  mode: MarketMode,
  now = Date.now(),
): Portfolio {
  input = orderSchema.parse(input)
  if (
    !quote ||
    !validQuote(quote, now) ||
    staleQuote(quote, now) ||
    quote.symbol !== input.symbol ||
    now - quote.updatedAt > 60_000 ||
    now - quote.quoteAt > 60_000
  )
    throw new TradingError(
      'Waiting for a fresh market quote. Try again when the feed is connected.',
    )
  if (
    ![quote.bid, quote.ask].every(
      (value) => Number.isFinite(value) && value > 0,
    ) ||
    quote.bid > quote.ask
  )
    throw new TradingError('This market quote cannot be used for a fill.')
  const next = structuredClone(current)
  const quantity = new Decimal(input.quantity)
  const price = new Decimal(input.side === 'buy' ? quote.ask : quote.bid)
  const total = quantity.mul(price)
  const position = next.positions.find((item) => item.symbol === input.symbol)
  if (input.side === 'buy') {
    if (total.gt(next.cash))
      throw new TradingError('Not enough available cash for this order.')
    const oldQuantity = new Decimal(position?.quantity ?? 0)
    const newQuantity = oldQuantity.plus(quantity)
    const averagePrice = oldQuantity
      .mul(position?.averagePrice ?? 0)
      .plus(total)
      .div(newQuantity)
      .toNumber()
    if (position) {
      position.quantity = newQuantity.toNumber()
      position.averagePrice = averagePrice
    } else
      next.positions.push({
        symbol: input.symbol,
        quantity: quantity.toNumber(),
        averagePrice,
      })
    next.cash = new Decimal(next.cash).minus(total).toNumber()
  } else {
    if (!position || quantity.gt(position.quantity))
      throw new TradingError(
        'You can only sell assets held in your paper portfolio.',
      )
    next.realizedPnl = new Decimal(next.realizedPnl)
      .plus(price.minus(position.averagePrice).mul(quantity))
      .toNumber()
    position.quantity = new Decimal(position.quantity)
      .minus(quantity)
      .toNumber()
    next.positions = next.positions.filter((item) => item.quantity > 0)
    next.cash = new Decimal(next.cash).plus(total).toNumber()
  }
  next.orders.unshift({
    id: randomUUID(),
    ...input,
    price: price.toNumber(),
    total: total.toNumber(),
    createdAt: now,
    mode,
  })
  next.orders = next.orders.slice(0, 200)
  return next
}
