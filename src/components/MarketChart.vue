<template>
  <section class="panel chart-panel" :class="{ expanded }">
    <div class="chart-heading">
      <div class="chart-asset">
        <AssetMark :asset="store.activeAsset" />
        <div>
          <h2>{{ store.selected }}</h2>
          <small>{{ store.activeAsset?.name || 'Loading stock…' }}</small>
        </div>
        <button
          class="icon-button star-button"
          aria-label="Toggle selected stock in watchlist"
          @click="store.toggleWatch(store.selected)"
        >
          <Star
            :size="15"
            :fill="
              store.watchlist.includes(store.selected) ? 'currentColor' : 'none'
            "
          />
        </button>
      </div>
      <div class="chart-actions">
        <button
          class="icon-button"
          :aria-label="expanded ? 'Collapse chart' : 'Expand chart'"
          @click="expanded = !expanded"
        >
          <component :is="expanded ? Minimize2 : Maximize2" :size="15" />
        </button>
      </div>
    </div>
    <div v-if="store.stale[store.selected]" class="stale-notice">
      Stale price · Waiting for a fresh market update
    </div>
    <div class="chart-price-row">
      <strong>{{ money(store.activeQuote?.price) }}</strong
      ><span
        class="change-pill"
        :class="
          (store.activeQuote?.changePct ?? 0) >= 0 ? 'positive' : 'negative'
        "
        >{{ percent(store.activeQuote?.changePct) }}</span
      ><span class="muted">{{
        store.status.mode === 'demo' ? 'simulated day' : 'vs. previous close'
      }}</span>
    </div>
    <div class="chart-toolbar">
      <div class="range-tabs" aria-label="Chart timeframe">
        <button
          v-for="range in RANGES"
          :key="range"
          :aria-pressed="store.range === range"
          :class="{ active: store.range === range }"
          @click="store.range = range"
        >
          {{ range }}
        </button>
      </div>
    </div>
    <div class="ohlc" aria-live="off">
      <template v-if="legend"
        ><span
          >O <b>{{ money(legend.open) }}</b></span
        ><span
          >H <b>{{ money(legend.high) }}</b></span
        ><span
          >L <b>{{ money(legend.low) }}</b></span
        ><span
          >C
          <b :class="legend.close >= legend.open ? 'positive' : 'negative'">{{
            money(legend.close)
          }}</b></span
        ><span
          >Vol <b>{{ compact(legend.volume) }}</b></span
        ></template
      ><span v-else>OHLC · {{ store.range }}</span>
    </div>
    <div class="chart-canvas-wrap">
      <div ref="container" class="chart-canvas" data-testid="stock-chart"></div>
      <div v-if="loading" class="chart-overlay">
        <div class="skeleton chart-skeleton"></div>
        <span>Loading {{ store.selected }} · {{ store.range }}</span>
      </div>
      <div v-else-if="error || !bars.length" class="chart-overlay">
        <span>{{
          error || 'No trades in this period. Try a longer timeframe.'
        }}</span
        ><button v-if="error" class="secondary-button" @click="load">
          <RefreshCw :size="13" /> Retry chart
        </button>
      </div>
    </div>
    <div class="chart-bottom">
      <span>{{
        store.status.mode === 'demo' ? 'Simulated prices' : 'Live prices'
      }}</span
      ><span
        >{{ currency.currency }} <span class="toolbar-divider">·</span>
        {{ bars.length }} bars</span
      >
    </div>
  </section>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { Star, Maximize2, Minimize2, RefreshCw } from 'lucide-vue-next'
import { RANGES } from '../../shared/types'
import { useTerminal } from '../stores/terminal'
import { useCurrency } from '../stores/currency'
import { useStockChart } from '../modules/chart/useStockChart'
import { money, percent, compact } from '../lib/format'
import AssetMark from './AssetMark.vue'
const store = useTerminal(),
  currency = useCurrency()
const { container, loading, error, expanded, bars, legend, load } =
  useStockChart({
    symbol: toRef(store, 'selected'),
    range: toRef(store, 'range'),
    mode: toRef(() => store.status.mode),
  })
</script>
