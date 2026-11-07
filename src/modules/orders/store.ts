import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../../lib/format'
import {
  requestSchema,
  portfolioMessageSchema,
} from '../../../shared/portfolio-schema'
import type { OrderRequest } from '../../../shared/order-types'
import { usePortfolio } from '../portfolio/store'
export const useOrders = defineStore('orders', () => {
  const account = usePortfolio(),
    activeId = ref('')
  const active = computed(() =>
    account.portfolio?.requests?.find((r) => r.id === activeId.value),
  )
  const controllers = new Set<AbortController>()
  async function submit(input: {
    symbol: string
    side: 'buy' | 'sell'
    quantity: number
  }) {
    const id = crypto.randomUUID()
    activeId.value = id
    const controller = new AbortController()
    controllers.add(controller)
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const pending = requestSchema.parse(
        await api<unknown>('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, input }),
          signal: controller.signal,
        }),
      )
      if (account.portfolio)
        account.apply({
          ...account.portfolio,
          requests: [
            pending,
            ...(account.portfolio.requests ?? []).filter((r) => r.id !== id),
          ],
        })
      while (!controller.signal.aborted) {
        const result = await api<{ order: OrderRequest; portfolio: unknown }>(
          `/api/orders/${id}`,
          { signal: controller.signal },
        )
        const request = requestSchema.parse(result.order)
        account.apply(portfolioMessageSchema.parse(result.portfolio))
        if (request.state === 'filled') {
          const fill = account.portfolio!.orders.find(
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
    } finally {
      clearTimeout(timeout)
      controllers.delete(controller)
    }
  }
  async function cancel(id: string) {
    const result = await api<{ order: OrderRequest; portfolio: unknown }>(
      `/api/orders/${id}/cancel`,
      { method: 'POST' },
    )
    account.apply(result.portfolio)
    return requestSchema.parse(result.order)
  }
  function stop() {
    controllers.forEach((c) => c.abort())
    controllers.clear()
  }
  return { activeId, active, submit, cancel, stop }
})
