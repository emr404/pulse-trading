<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-vue-next'
import { useOrders } from '../modules/orders/store'
import { validateOrder, sizeOrder } from '../modules/orders/validation'
import { useTerminal } from '../stores/terminal'
import { money, moneyUsd, number } from '../lib/format'
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
function fraction(part: number) {
  quantity.value = sizeOrder(
    part,
    side.value,
    price.value,
    store.portfolio?.cash ?? 0,
    store.held,
  )
}
async function cancel() {
  try {
    if (orders.active) await orders.cancel(orders.active.id)
  } catch {
    error.value = 'Unable to cancel. Check Activity for the latest status.'
  }
}
async function submit() {
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
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Order failed.'
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <section class="panel trade-panel">
    <div class="panel-heading">
      <h2>Order ticket</h2>
      <span class="paper-badge">PAPER</span>
    </div>
    <form @submit.prevent="submit">
      <div class="trade-tabs">
        <button
          type="button"
          :class="{ active: side === 'buy' }"
          :aria-pressed="side === 'buy'"
          @click="side = 'buy'"
        >
          Buy</button
        ><button
          type="button"
          class="sell-tab"
          :class="{ active: side === 'sell' }"
          :aria-pressed="side === 'sell'"
          @click="side = 'sell'"
        >
          Sell
        </button>
      </div>
      <div class="order-asset">
        <b>{{ store.selected }}</b
        ><span>Market order</span>
      </div>
      <div class="bid-ask">
        <div>
          <span>BID</span><b>{{ money(store.activeQuote?.bid) }}</b>
        </div>
        <div>
          <span>ASK</span><b>{{ money(store.activeQuote?.ask) }}</b>
        </div>
      </div>
      <label for="quantity">Quantity <span>Shares</span></label>
      <div class="quantity-input">
        <input
          id="quantity"
          v-model="quantity"
          type="number"
          min="0.00000001"
          max="1000000"
          step="any"
          inputmode="decimal"
          required
        /><span>{{ store.selected }}</span>
      </div>
      <div class="quantity-shortcuts">
        <button
          v-for="n in [25, 50, 75, 100]"
          :key="n"
          type="button"
          @click="fraction(n / 100)"
        >
          {{ n }}%
        </button>
      </div>
      <div class="order-lines">
        <div>
          <span>{{ side === 'buy' ? 'Buying power' : 'Shares available' }}</span
          ><b>{{
            side === 'buy' ? money(store.portfolio?.cash) : number(store.held)
          }}</b>
        </div>
        <div>
          <span>Est. fill price</span><b>{{ money(price || null) }}</b>
        </div>
        <div>
          <span>Commission</span><b>{{ money(0) }}</b>
        </div>
        <div class="order-total">
          <span>Estimated total</span><strong>{{ money(value || 0) }}</strong>
        </div>
      </div>
      <button
        class="trade-submit"
        :class="{ sell: side === 'sell' }"
        :disabled="busy || !store.canTrade || !store.portfolio || !!invalid"
        type="submit"
      >
        {{
          busy
            ? 'Placing order…'
            : `${side === 'buy' ? 'Buy' : 'Sell'} ${store.selected}`
        }}<ArrowRight :size="16" />
      </button>
      <button
        v-if="orders.active?.state === 'pending'"
        type="button"
        class="secondary-button cancel-order"
        @click="cancel"
      >
        Cancel pending order
      </button>
      <p v-if="invalid" class="form-error">{{ invalid }}</p>
      <p v-if="!store.canTrade" class="form-error">
        Waiting for a fresh tradable quote.
      </p>
      <p v-if="error" role="alert" class="trade-result negative">
        <AlertCircle :size="15" />{{ error }}
      </p>
      <p v-if="confirmation" role="status" class="trade-result positive">
        <CheckCircle2 :size="15" />{{ confirmation }}
      </p>
      <div class="trade-disclaimer">
        <ShieldCheck :size="13" /><span
          >Simulation only. No real money at risk.</span
        >
      </div>
    </form>
  </section>
</template>
