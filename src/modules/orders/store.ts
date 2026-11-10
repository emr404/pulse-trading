import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../../lib/format'
import { requestSchema } from '../../../shared/portfolio-schema'
import { orderResponseSchema } from '../../../shared/api'
import type { Order } from '../../../shared/types'
import type { OrderRequest } from '../../../shared/order-types'
import { usePortfolio } from '../portfolio/store'
export const useOrders = defineStore('orders', () => {
  const account = usePortfolio(),
    activeId = ref('')
  const active = computed(() =>
    account.portfolio?.requests?.find((r) => r.id === activeId.value),
  )
  const controllers = new Set<AbortController>()
  const submit = async (input: {
    symbol: string
    side: 'buy' | 'sell'
    quantity: number
  }): Promise<Order> => {
    const id = crypto.randomUUID()
    activeId.value = id
    const controller = new AbortController()
    controllers.add(controller)
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const pending = await api('/api/orders', requestSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, input }),
        signal: controller.signal,
      })
      const currentRequest = account.portfolio?.requests?.find(
        (request) => request.id === id,
      )
      if (
        account.portfolio &&
        (!currentRequest || currentRequest.updatedAt < pending.updatedAt)
      )
        account.apply({
          ...account.portfolio,
          requests: [
            pending,
            ...(account.portfolio.requests ?? []).filter((r) => r.id !== id),
          ],
        })
      while (!controller.signal.aborted) {
        const result = await api(`/api/orders/${id}`, orderResponseSchema, {
          signal: controller.signal,
        })
        const request = result.order
        account.apply(result.portfolio)
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
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer)
            reject(
              new Error(
                'Order status timed out. Check Activity before retrying.',
              ),
            )
          }
          const timer = setTimeout(() => {
            controller.signal.removeEventListener('abort', abort)
            resolve()
          }, 200)
          controller.signal.addEventListener('abort', abort, { once: true })
        })
      }
      throw new Error('Order status timed out. Check Activity before retrying.')
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error(
          'Order status timed out. Check Activity before retrying.',
        )
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
    account.apply(result.portfolio)
    return result.order
  }
  const stop = (): void => {
    controllers.forEach((c) => c.abort())
    controllers.clear()
  }
  return { activeId, active, submit, cancel, stop }
})
