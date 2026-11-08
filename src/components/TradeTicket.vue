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

<script setup lang="ts">
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-vue-next'
import { useTradeTicket } from '../modules/orders/useTradeTicket'
import { money, number } from '../lib/format'
const {
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
} = useTradeTicket()
</script>
