<template>
  <section class="panel portfolio-panel">
    <div class="panel-heading">
      <h2>
        Portfolio
        <span class="count">{{ store.portfolio?.positions.length ?? 0 }}</span>
      </h2>
      <button
        v-if="!detailed"
        class="text-button"
        @click="store.page = 'Portfolio'"
      >
        View portfolio <ArrowUpRight :size="13" />
      </button>
    </div>
    <div class="portfolio-overview">
      <div>
        <span class="muted">Net liquidation value</span
        ><strong>{{ store.portfolio ? money(store.equity) : '—' }}</strong
        ><small :class="store.totalPnl >= 0 ? 'positive' : 'negative'"
          >{{ money(store.totalPnl) }}
          <span
            >({{
              percent(
                store.portfolio
                  ? (store.totalPnl / store.portfolio.initialCash) * 100
                  : null,
              )
            }}) all time</span
          ></small
        >
      </div>
      <div class="allocation">
        <div class="allocation-label">
          <span
            ><i class="legend-dot"></i>Invested
            {{ allocation.toFixed(1) }}%</span
          ><span>Cash {{ (100 - allocation).toFixed(1) }}%</span>
        </div>
        <div class="allocation-bar">
          <span :style="{ width: allocation + '%' }"></span>
        </div>
        <div class="allocation-label">
          <span>{{ money(store.marketValue) }}</span
          ><span>{{ money(store.portfolio?.cash) }}</span>
        </div>
      </div>
    </div>
    <div class="table-scroll">
      <table v-if="store.portfolio?.positions.length">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Shares</th>
            <th>Avg. cost</th>
            <th>Market value</th>
            <th>Unrealised P/L</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="position in store.portfolio.positions"
            :key="position.symbol"
          >
            <td>
              <button
                class="table-asset"
                @click="store.openStock(position.symbol)"
              >
                <AssetMark
                  :asset="
                    store.assets.find((a) => a.symbol === position.symbol)
                  "
                  :symbol="position.symbol"
                /><b>{{ position.symbol }}</b>
              </button>
            </td>
            <td>{{ number(position.quantity) }}</td>
            <td>{{ money(position.averagePrice) }}</td>
            <td>
              {{
                money(
                  position.quantity *
                    (store.quotes[position.symbol]?.price ??
                      position.averagePrice),
                )
              }}
            </td>
            <td
              :class="
                (store.quotes[position.symbol]?.price ??
                  position.averagePrice) >= position.averagePrice
                  ? 'positive'
                  : 'negative'
              "
            >
              {{
                money(
                  position.quantity *
                    ((store.quotes[position.symbol]?.price ??
                      position.averagePrice) -
                      position.averagePrice),
                )
              }}
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="portfolio-empty">
        <Wallet :size="23" />
        <div>
          <b>No holdings.</b
          ><small
            >You have {{ money(store.portfolio?.cash) }} in virtual buying
            power.</small
          >
        </div>
        <button class="secondary-button" @click="store.page = 'Markets'">
          Explore stocks <ArrowUpRight :size="13" />
        </button>
      </div>
    </div>
    <div v-if="store.valuationEstimated" class="panel-footnote">
      Some prices are stale or unavailable. Valuation uses the last quote or
      average cost.
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, Wallet } from 'lucide-vue-next'
import { useTerminal } from '../stores/terminal'
import { money, number, percent } from '../lib/format'
import AssetMark from './AssetMark.vue'
defineProps<{ detailed?: boolean }>()
const store = useTerminal()
const allocation = computed(() =>
  store.equity > 0
    ? Math.min(100, (store.marketValue / store.equity) * 100)
    : 0,
)
</script>
