import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { useOrders } from './store'
import { validateOrder, sizeOrder } from './validation'
import { useTerminal } from '../../stores/terminal'
import { moneyUsd, number } from '../../lib/format'

export interface TradeTicketState {
  orders: ReturnType<typeof useOrders>
  store: ReturnType<typeof useTerminal>
  side: Ref<'buy' | 'sell'>
  quantity: Ref<number | string>
  busy: Ref<boolean>
  confirmation: Ref<string>
  error: Ref<string>
  price: ComputedRef<number>
  value: ComputedRef<number>
  invalid: ComputedRef<string>
  fraction(part: number): void
  cancel(): Promise<void>
  submit(): Promise<void>
}

export const useTradeTicket = (): TradeTicketState => {
  const orders = useOrders()
  const store = useTerminal(),
    side = ref<'buy' | 'sell'>('buy'),
    quantity = ref<number | string>(1),
    busy = ref(false),
    confirmation = ref(''),
    error = ref('')
  const price = computed(
    () => store.activeQuote?.[side.value === 'buy' ? 'ask' : 'bid'] ?? 0,
  )
  const value = computed(() => Number(quantity.value) * price.value)
  const invalid = computed(() =>
    validateOrder(
      Number(quantity.value),
      side.value,
      price.value,
      store.portfolio?.cash ?? 0,
      store.held,
    ),
  )
  watch(
    () => [store.selected, side.value, quantity.value],
    () => {
      confirmation.value = ''
      error.value = ''
    },
  )
  const fraction = (part: number): void => {
    quantity.value = sizeOrder(
      part,
      side.value,
      price.value,
      store.portfolio?.cash ?? 0,
      store.held,
    )
  }
  const cancel = async (): Promise<void> => {
    try {
      if (orders.active) await orders.cancel(orders.active.id)
    } catch {
      error.value = 'Unable to cancel. Check Activity for the latest status.'
    }
  }
  const submit = async (): Promise<void> => {
    if (busy.value) return
    if (invalid.value || !store.canTrade) {
      error.value = invalid.value || 'Waiting for a fresh tradable quote.'
      return
    }
    busy.value = true
    error.value = ''
    confirmation.value = ''
    try {
      const order = await orders.submit({
        symbol: store.selected,
        side: side.value,
        quantity: Number(quantity.value),
      })
      confirmation.value = `${order.side === 'buy' ? 'Bought' : 'Sold'} ${number(order.quantity)} ${order.symbol} at ${moneyUsd(order.price)} USD.`
      store.notice = confirmation.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Order failed.'
    } finally {
      busy.value = false
    }
  }
  return {
    orders,
    store,
    side,
    quantity,
    busy,
    confirmation,
    error,
    price,
    value,
    invalid,
    fraction,
    cancel,
    submit,
  }
}
