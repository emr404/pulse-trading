<script setup lang="ts">
import { Radio, Monitor, ShieldCheck } from 'lucide-vue-next'
import { useCurrency } from '../stores/currency'
import { useTerminal } from '../stores/terminal'
const store = useTerminal()
const currency = useCurrency()
</script>
<template>
  <section class="panel settings-panel">
    <div class="panel-heading"><h2>App preferences</h2></div>
    <div class="settings-row currency-settings">
      <div>
        <label for="display-currency"><b>Display currency</b></label>
        <p>
          Convert prices, charts and portfolio values for display. Trading
          balances and fills stay in USD. Percentage returns remain based on USD
          performance.
        </p>
        <p>{{ currency.note }}</p>
        <p v-if="currency.exchange">
          Daily ECB reference rates via Frankfurter: 1 USD =
          {{ currency.exchange.rates.GBP.toFixed(4) }} GBP /
          {{ currency.exchange.rates.EUR.toFixed(4) }} EUR. Chart history and
          past trades use this same reference rate, not historical FX.
        </p>
        <p v-if="currency.error" class="negative" role="alert">
          {{ currency.error }}
        </p>
        <button
          class="text-button"
          :disabled="currency.loading"
          @click="currency.refresh"
        >
          {{ currency.loading ? 'Updating rates…' : 'Refresh exchange rates' }}
        </button>
      </div>
      <select
        id="display-currency"
        v-model="currency.selected"
        class="currency-select"
      >
        <option value="USD">USD — US dollar</option>
        <option value="GBP">GBP — British pound</option>
        <option value="EUR">EUR — Euro</option>
      </select>
    </div>
    <div class="settings-row">
      <Monitor :size="19" />
      <div>
        <b>Price movement highlights</b>
        <p>Briefly highlight prices as market updates arrive.</p>
      </div>
      <button
        class="toggle"
        :class="{ enabled: store.flashEnabled }"
        role="switch"
        :aria-checked="store.flashEnabled"
        aria-label="Price movement highlights"
        @click="store.flashEnabled = !store.flashEnabled"
      >
        <span></span>
      </button>
    </div>
    <div class="settings-row">
      <Radio :size="19" />
      <div>
        <b>Data connection</b>
        <p>{{ store.status.provider }} · {{ store.status.message }}</p>
        <p>
          To enable live data, set MARKET_MODE=live and Alpaca credentials in
          the server’s .env file, then restart. Credentials never enter the
          browser.
        </p>
      </div>
      <span class="paper-badge">{{ store.status.mode.toUpperCase() }}</span>
    </div>
    <div class="settings-row">
      <ShieldCheck :size="19" />
      <div>
        <b>Paper trading account</b>
        <p>
          Starting balance: $10,000 USD. Positions and transactions are saved
          locally on the server. No brokerage orders are sent.
        </p>
        <p>Watchlist and display preferences are saved in this browser.</p>
      </div>
    </div>
  </section>
</template>
