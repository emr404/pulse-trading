import type { OrderRequest } from '../shared/order-types.js'
import type { MarketSnapshot, Portfolio } from '../shared/types.js'
import {
  executeOrder,
  orderSchema,
  createTradingError,
  type OrderInput,
} from './trading.js'
interface Store {
  get(): Portfolio
  save(value: Portfolio): Portfolio
}
/** Single-writer lifecycle. A fill and its terminal state commit in one atomic save. */
export const createOrderPersistenceError = (): Error =>
  Object.assign(new Error('Order storage is unavailable. Check Activity before retrying; execution could not be confirmed.'), { name: 'OrderPersistenceError' })
export const createOrderManager = (
  store: Store,
  market: () => MarketSnapshot,
  publish: (p: Portfolio) => void,
  delay = 700,
) => {
  let persistenceFailed = false
  const failedRequests = new Set<string>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const get = (id: string): OrderRequest | undefined => {
    if (failedRequests.has(id)) throw createOrderPersistenceError()
    return store.get().requests?.find((r) => r.id === id)
  }

  const submit = (id: string, input: OrderInput): OrderRequest => {
    if (persistenceFailed) throw createOrderPersistenceError()
    input = orderSchema.parse(input)
    const existing = get(id)
    if (existing) {
      if (
        existing.symbol !== input.symbol ||
        existing.side !== input.side ||
        existing.quantity !== input.quantity
      )
        throw createTradingError(
          'This order ID has already been used for different instructions.',
        )
      return existing
    }
    const value = store.get()
    if (
      (value.requests ?? []).filter((r) => r.state === 'pending').length >= 20
    )
      throw createTradingError('Too many pending orders.')
    const request: OrderRequest = {
      id,
      ...input,
      state: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    value.requests = [request, ...(value.requests ?? [])].slice(0, 200)
    publish(store.save(value))
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id)
        try {
          settle(id)
        } catch (error) {
          persistenceFailed = true
          failedRequests.add(id)
          console.error(
            'Order persistence failed; request remains pending:',
            error instanceof Error ? error.message : 'Unknown failure',
          )
        }
      }, delay),
    )
    return request
  }

  const settle = (id: string): OrderRequest | undefined => {
    const current = store.get(),
      request = current.requests?.find((r) => r.id === id)
    if (!request || request.state !== 'pending') return request
    let next: Portfolio
    try {
      const snapshot = market()
      if (snapshot.status.state !== 'connected')
        throw createTradingError('Market data is disconnected.')
      if (!snapshot.assets.some((a) => a.symbol === request.symbol))
        throw createTradingError('Stock is unavailable.')
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
      if (!((error instanceof Error && error.name === 'TradingError'))) throw error
      next = current
      request.state = 'rejected'
      request.reason = error.message
      request.updatedAt = Date.now()
    }
    publish(store.save(next))
    return get(id)
  }

  const cancel = (id: string): OrderRequest => {
    const value = store.get(),
      request = value.requests?.find((r) => r.id === id)
    if (!request) throw createTradingError('Order not found.')
    if (request.state !== 'pending') return request
    clearTimeout(timers.get(id))
    timers.delete(id)
    request.state = 'cancelled'
    request.reason = 'Cancelled before execution.'
    request.updatedAt = Date.now()
    publish(store.save(value))
    return request
  }

  const stop = (): void => {
    for (const [id, timer] of timers) {
      clearTimeout(timer)
      try {
        cancel(id)
      } catch {
        failedRequests.add(id)
      }
    }
    timers.clear()
  }

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

  return { get, submit, settle, cancel, stop }
}
export type OrderManager = ReturnType<typeof createOrderManager>
