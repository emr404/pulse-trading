<template>
  <section class="panel watchlist-panel" :class="{ 'watchlist-expanded': expanded }">
    <div class="panel-heading">
      <h2>
        {{ all ? 'All markets' : 'Watchlist' }}
        <span class="count">{{ rows.length }}</span>
      </h2>
      <button
        class="icon-button"
        aria-label="Add stock to watchlist"
        @click="picker = true"
      >
        <Plus :size="17" />
      </button>
    </div>
    <div class="watchlist-header">
      <span>Symbol</span
      ><button @click="setSort('price')" aria-label="Sort by price">
        Price <ArrowDownUp :size="10" /></button
      ><button
        @click="setSort('change')"
        aria-label="Sort by percentage change"
      >
        Change <ArrowDownUp :size="10" /></button
      ><span></span>
    </div>
    <div v-if="!store.assets.length" class="watch-skeleton">
      <div v-for="n in 6" :key="n" class="skeleton"></div>
    </div>
    <div v-else class="watchlist-rows">
      <WatchlistRow
        v-for="asset in rows"
        :key="asset.symbol"
        :asset="asset"
        :all="all"
      />
      <div v-if="!rows.length" class="empty-state">
        <Star :size="22" />Your watchlist is empty.<small
          >Add a stock to keep it in view.</small
        ><button class="text-button" @click="picker = true">Add stocks</button>
      </div>
    </div>
    <button v-if="!all" class="watch-add" @click="picker = true">
      <Plus :size="13" /> Add symbol
    </button>
    <div class="panel-footnote">
      {{ currency.currency }} ·
      {{
        store.status.mode === 'demo'
          ? 'Simulated market prices'
          : 'Change from previous close'
      }}
    </div>
  </section>
  <AssetPicker v-if="picker" watch-mode @close="picker = false" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, ArrowDownUp, Star } from 'lucide-vue-next'
import { useCurrency } from '../stores/currency'
import { useTerminal } from '../stores/terminal'
import WatchlistRow from './WatchlistRow.vue'
import AssetPicker from './AssetPicker.vue'
const currency = useCurrency()
const props = defineProps<{ all?: boolean; expanded?: boolean }>()
const store = useTerminal(),
  picker = ref(false),
  sort = ref<'default' | 'price' | 'change'>('default'),
  ascending = ref(false)
const rows = computed(() => {
  const items = store.assets.filter(
    (a) => props.all || store.watchlist.includes(a.symbol),
  )
  if (sort.value === 'default') return items
  const sorted = [...items].sort(
    (a, b) =>
      ((sort.value === 'price'
        ? store.quotes[a.symbol]?.price
        : store.quotes[a.symbol]?.changePct) ?? 0) -
      ((sort.value === 'price'
        ? store.quotes[b.symbol]?.price
        : store.quotes[b.symbol]?.changePct) ?? 0),
  )
  return ascending.value ? sorted : sorted.reverse()
})
const setSort = (value: 'price' | 'change'): void => {
  ascending.value = sort.value === value ? !ascending.value : false
  sort.value = value
}
</script>
