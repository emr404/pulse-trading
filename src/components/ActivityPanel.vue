<template>
  <section class="panel activity-panel">
    <div class="panel-heading">
      <h2>{{ compact ? 'Recent activity' : 'Transaction history' }}</h2>
      <button
        v-if="compact"
        class="text-button"
        @click="store.page = 'Activity'"
      >
        View all <ArrowUpRight :size="13" /></button
      ><span v-else class="tiny-label">LATEST 200 FILLS</span>
    </div>
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    <div
      v-for="request in requests"
      :key="request.id"
      class="order-lifecycle-row"
    >
      <b
        >{{ request.side.toUpperCase() }} {{ request.quantity }}
        {{ request.symbol }}</b
      >
      <span :class="request.state === 'rejected' ? 'negative' : 'muted'"
        >{{ request.state }}<small>{{ request.reason }}</small></span
      >
      <button
        v-if="request.state === 'pending'"
        class="secondary-button"
        @click="cancel(request.id)"
      >
        Cancel order
      </button>
    </div>
    <div class="table-scroll">
      <table v-if="store.portfolio?.orders.length">
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Quantity</th>
            <th>Fill price</th>
            <th>Total</th>
            <th>Time</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="order in store.portfolio.orders.slice(0, compact ? 4 : 200)"
            :key="order.id"
          >
            <td>
              <span class="transaction-symbol"
                ><component
                  :is="order.side === 'buy' ? ArrowDownLeft : ArrowUpRight"
                  :size="15"
                  :class="order.side === 'buy' ? 'positive' : 'negative'"
                /><b
                  >{{ order.side === 'buy' ? 'Buy' : 'Sell' }}
                  {{ order.symbol }}</b
                ></span
              >
            </td>
            <td>{{ number(order.quantity) }}</td>
            <td>{{ money(order.price) }}</td>
            <td>{{ money(order.total) }}</td>
            <td>
              {{
                new Date(order.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              }}
            </td>
            <td><span class="filled-badge">Filled · Paper</span></td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">
        <History :size="23" />No transactions yet.
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ArrowDownLeft, ArrowUpRight, History } from 'lucide-vue-next'
import { ref, computed } from 'vue'
import { useOrders } from '../modules/orders/store'
import { useTerminal } from '../stores/terminal'
import { money, number } from '../lib/format'
defineProps<{ compact?: boolean }>()
const store = useTerminal()
const orders = useOrders()
const error = ref('')
const requests = computed(() =>
  (store.portfolio?.requests ?? []).filter(
    (request) => request.state !== 'filled',
  ),
)
const cancel = async (id: string): Promise<void> => {
  try {
    await orders.cancel(id)
  } catch {
    error.value = 'Could not cancel. Refresh the order status before retrying.'
  }
}
</script>
