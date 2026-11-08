<template>
  <div class="watch-row" :class="{ selected: store.selected === asset.symbol }">
    <button
      class="watch-select"
      :aria-label="'Select ' + asset.symbol"
      @click="store.select(asset.symbol)"
    >
      <AssetMark :asset="asset" /><span class="asset-copy"
        ><b>{{ asset.symbol }}</b
        ><small
          >{{ store.stale[asset.symbol] ? 'STALE · ' : ''
          }}{{ asset.name }}</small
        ></span
      ><span
        class="watch-price"
        :key="store.quotes[asset.symbol]?.updatedAt"
        :class="
          store.flashEnabled && store.flashes[asset.symbol]
            ? 'flash-' + store.flashes[asset.symbol]
            : ''
        "
        >{{ money(store.quotes[asset.symbol]?.price) }}</span
      ><span
        class="change"
        :class="
          (store.quotes[asset.symbol]?.changePct ?? 0) >= 0
            ? 'positive'
            : 'negative'
        "
        >{{ percent(store.quotes[asset.symbol]?.changePct) }}</span
      ></button
    ><button
      class="remove-stock icon-button"
      :aria-label="(all ? 'Toggle watchlist ' : 'Remove ') + asset.symbol"
      @click="store.toggleWatch(asset.symbol)"
    >
      <Star
        v-if="all"
        :size="13"
        :fill="store.watchlist.includes(asset.symbol) ? 'currentColor' : 'none'"
      /><X v-else :size="13" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { X, Star } from 'lucide-vue-next'
import type { Asset } from '../../shared/types'
import { useTerminal } from '../stores/terminal'
import { money, percent } from '../lib/format'
import AssetMark from './AssetMark.vue'
defineProps<{ asset: Asset; all?: boolean }>()
const store = useTerminal()
</script>
