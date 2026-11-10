import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../../lib/api'
import { requestSchema } from '../../../shared/portfolio-schema'
import { orderResponseSchema } from '../../../shared/api'
import type { Order } from '../../../shared/types'
import type { OrderRequest } from '../../../shared/order-types'
import { usePortfolio } from '../portfolio/store'
const ORDER_TIMEOUT_MESSAGE = 'Order status timed out. Check Activity before retrying.'
const ORDER_TIMEOUT_MS = 15000
const POLL_INTERVAL_MS = 200

const waitForNextPoll = (signal: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error(ORDER_TIMEOUT_MESSAGE))
      return
    }

    const abort = (): void => {
      clearTimeout(timer)
      reject(new Error(ORDER_TIMEOUT_MESSAGE))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, POLL_INTERVAL_MS)
    signal.addEventListener('abort', abort, { once: true })
  })
}

export const useOrders = defineStore('orders', () => {
  const account = usePortfolio()
  const activeId = ref('')
  const active = computed(() =>
    account.portfolio?.requests?.find((r) => r.id === activeId.value),
  )
  const controllers = new Set<AbortController>()
  const trackPendingOrder = (pending: OrderRequest): void => {
    const currentRequest = account.portfolio?.requests?.find(
      (request) => request.id === pending.id,
    )
    if (
      account.portfolio &&
      (!currentRequest || currentRequest.updatedAt < pending.updatedAt)
    )
      account.applyPortfolioSnapshot({
        ...account.portfolio,
        requests: [
          pending,
          ...(account.portfolio.requests ?? []).filter((r) => r.id !== pending.id),
        ],
      })
  }

  const waitForOrderResult = async (id: string, signal: AbortSignal): Promise<Order> => {
    while (!signal.aborted) {
      const result = await api(`/api/orders/${id}`, orderResponseSchema, {
        signal,
      })
      const request = result.order
      account.applyPortfolioSnapshot(result.portfolio)
      if (request.state === 'filled') {
        const fill = result.portfolio.orders.find(
          (o) => o.id === request.fillId,
        )
        if (!fill)
          throw new Error('Fill is being synchronized. Check Activity.')
        return fill
      }
      if (request.state !== 'pending')
        throw new Error(request.reason || `Order ${request.state}.`)
      await waitForNextPoll(signal)
    }
    throw new Error(ORDER_TIMEOUT_MESSAGE)
  }

  const submit = async (input: {
    symbol: string
    side: 'buy' | 'sell'
    quantity: number
  }): Promise<Order> => {
    const id = crypto.randomUUID()
    activeId.value = id
    const controller = new AbortController()
    controllers.add(controller)
    const timeout = setTimeout(() => controller.abort(), ORDER_TIMEOUT_MS)
    try {
      const pending = await api('/api/orders', requestSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, input }),
        signal: controller.signal,
      })
      trackPendingOrder(pending)
      return await waitForOrderResult(id, controller.signal)
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error(ORDER_TIMEOUT_MESSAGE)
      throw error
    } finally {
      clearTimeout(timeout)
      controllers.delete(controller)
    }
  }
  const cancel = async (id: string): Promise<OrderRequest> => {
    const result = await api(`/api/orders/${id}/cancel`, orderResponseSchema, {
      method: 'POST',
    })
    account.applyPortfolioSnapshot(result.portfolio)
    return result.order
  }
  const stop = (): void => {
    controllers.forEach((c) => c.abort())
    controllers.clear()
  }
  return { activeId, active, submit, cancel, stop }
})
