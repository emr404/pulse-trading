<template>
  <section class="market-strip" aria-label="Market overview">
    <button
      v-for="asset in overviewAssets"
      :key="asset.symbol"
      class="market-card"
      @click="store.select(asset.symbol)"
    >
      <div class="market-card-label">
        <span>{{
          asset.symbol === 'SPY'
            ? 'S&P 500 ETF'
            : asset.symbol === 'QQQ'
              ? 'Nasdaq 100 ETF'
              : asset.symbol === 'DIA'
                ? 'Dow Jones ETF'
                : 'NVIDIA'
        }}</span
        ><span>{{ asset.symbol }} <ArrowUpRight :size="11" /></span>
      </div>
      <div class="market-card-body">
        <div>
          <strong>{{ money(store.quotes[asset.symbol]?.price) }}</strong
          ><small
            :class="
              (store.quotes[asset.symbol]?.changePct ?? 0) >= 0
                ? 'positive'
                : 'negative'
            "
            ><component
              :is="
                (store.quotes[asset.symbol]?.changePct ?? 0) >= 0
                  ? ArrowUpRight
                  : ArrowDownRight
              "
              :size="12"
            />{{ percent(store.quotes[asset.symbol]?.changePct)
            }}<span>today</span></small
          >
        </div>
      </div>
    </button>
    <div
      v-if="!store.assets.length"
      v-for="n in 4"
      :key="n"
      class="market-card skeleton"
    ></div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, ArrowDownRight } from 'lucide-vue-next'
const overviewAssets = computed(() =>
  ['SPY', 'QQQ', 'DIA', 'NVDA']
    .map((s) => store.assets.find((a) => a.symbol === s))
    .filter((a) => a !== undefined),
)
import { useTerminal } from '../stores/terminal'
import { money, percent, time } from '../lib/format'
const store = useTerminal()
</script>
