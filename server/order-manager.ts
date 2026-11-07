import type { OrderRequest } from '../shared/order-types.js'
import type { MarketSnapshot, Portfolio } from '../shared/types.js'
import {
  executeOrder,
  orderSchema,
  TradingError,
  type OrderInput,
} from './trading.js'
interface Store {
  get(): Portfolio
  save(value: Portfolio): Portfolio
}
/** Single-writer lifecycle. A fill and its terminal state commit in one atomic save. */
export class OrderManager {
  private timers = new Map<string, ReturnType<typeof setTimeout>>()
  constructor(
    private store: Store,
    private market: () => MarketSnapshot,
    private publish: (p: Portfolio) => void,
    private delay = 700,
  ) {
    const value = store.get()
    let changed = false
    for (const request of value.requests ?? [])
      if (request.state === 'pending') {
        request.state = 'cancelled'
        request.reason = 'Server restarted before execution.'
        request.updatedAt = Date.now()
        changed = true
      }
    if (changed) store.save(value)
  }
  get(id: string) {
    return this.store.get().requests?.find((r) => r.id === id)
  }
  submit(id: string, input: OrderInput): OrderRequest {
    input = orderSchema.parse(input)
    const existing = this.get(id)
    if (existing) {
      if (
        existing.symbol !== input.symbol ||
        existing.side !== input.side ||
        existing.quantity !== input.quantity
      )
        throw new TradingError(
          'This order ID has already been used for different instructions.',
        )
      return existing
    }
    const value = this.store.get()
    if (
      (value.requests ?? []).filter((r) => r.state === 'pending').length >= 20
    )
      throw new TradingError('Too many pending orders.')
    const request: OrderRequest = {
      id,
      ...input,
      state: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    value.requests = [request, ...(value.requests ?? [])].slice(0, 200)
    this.publish(this.store.save(value))
    this.timers.set(
      id,
      setTimeout(() => {
        this.timers.delete(id)
        try {
          this.settle(id)
        } catch (error) {
          console.error(
            'Order persistence failed; request remains pending:',
            error instanceof Error ? error.message : 'Unknown failure',
          )
        }
      }, this.delay),
    )
    return request
  }
  settle(id: string) {
    const current = this.store.get(),
      request = current.requests?.find((r) => r.id === id)
    if (!request || request.state !== 'pending') return request
    let next: Portfolio
    try {
      const snapshot = this.market()
      if (snapshot.status.state !== 'connected')
        throw new TradingError('Market data is disconnected.')
      if (!snapshot.assets.some((a) => a.symbol === request.symbol))
        throw new TradingError('Stock is unavailable.')
      next = executeOrder(
        current,
        {
          symbol: request.symbol,
          side: request.side,
          quantity: request.quantity,
        },
        snapshot.quotes.find((q) => q.symbol === request.symbol),
        snapshot.status.mode,
      )
      const result = next.requests!.find((r) => r.id === id)!
      result.state = 'filled'
      result.fillId = next.orders[0].id
      result.updatedAt = Date.now()
    } catch (error) {
      if (!(error instanceof TradingError)) throw error
      next = current
      request.state = 'rejected'
      request.reason = error.message
      request.updatedAt = Date.now()
    }
    this.publish(this.store.save(next))
    return this.get(id)
  }
  cancel(id: string) {
    const value = this.store.get(),
      request = value.requests?.find((r) => r.id === id)
    if (!request) throw new TradingError('Order not found.')
    if (request.state !== 'pending') return request
    clearTimeout(this.timers.get(id))
    this.timers.delete(id)
    request.state = 'cancelled'
    request.reason = 'Cancelled before execution.'
    request.updatedAt = Date.now()
    this.publish(this.store.save(value))
    return request
  }
  stop() {
    for (const id of this.timers.keys()) this.cancel(id)
    this.timers.clear()
  }
}
