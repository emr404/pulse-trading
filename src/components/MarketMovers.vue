<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUpRight } from 'lucide-vue-next'
import { useTerminal } from '../stores/terminal'
import { money, percent } from '../lib/format'
import SparkLine from './SparkLine.vue'
import AssetMark from './AssetMark.vue'
const store = useTerminal(),
  mode = ref<'gainers' | 'losers'>('gainers')
const movers = computed(() =>
  store.assets
    .filter(
      (a) =>
        a.sector !== 'Index ETF' &&
        store.quotes[a.symbol]?.changePct != null &&
        (mode.value === 'gainers'
          ? store.quotes[a.symbol].changePct! >= 0
          : store.quotes[a.symbol].changePct! < 0),
    )
    .sort((a, b) =>
      mode.value === 'gainers'
        ? store.quotes[b.symbol].changePct! - store.quotes[a.symbol].changePct!
        : store.quotes[a.symbol].changePct! - store.quotes[b.symbol].changePct!,
    )
    .slice(0, 4),
)
</script>
<template>
  <section class="panel movers-panel">
    <div class="panel-heading">
      <h2>Market movers</h2>
      <span class="tiny-label">TRACKED STOCKS</span>
    </div>
    <div class="mover-tabs">
      <button :class="{ active: mode === 'gainers' }" @click="mode = 'gainers'">
        Top gainers</button
      ><button :class="{ active: mode === 'losers' }" @click="mode = 'losers'">
        Top losers
      </button>
    </div>
    <button
      v-for="asset in movers"
      :key="asset.symbol"
      class="mover-row"
      @click="store.select(asset.symbol)"
    >
      <AssetMark :asset="asset" /><span class="mover-name"
        ><b>{{ asset.symbol }}</b
        ><small>{{ asset.name }}</small></span
      ><SparkLine
        :values="store.trails[asset.symbol] ?? []"
        :positive="mode === 'gainers'"
      /><span class="mover-price"
        ><b>{{ money(store.quotes[asset.symbol]?.price) }}</b
        ><small :class="mode === 'gainers' ? 'positive' : 'negative'">{{
          percent(store.quotes[asset.symbol]?.changePct)
        }}</small></span
      ><ArrowUpRight :size="13" class="mover-arrow" />
    </button>
    <div v-if="!movers.length" class="empty-state">
      No {{ mode }} available.<small>Waiting for percentage-change data.</small>
    </div>
  </section>
</template>
