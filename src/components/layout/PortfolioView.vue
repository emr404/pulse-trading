<template>
  <section class="portfolio-stats">
    <div>
      <span>Total equity</span><strong>{{ money(store.equity) }}</strong>
    </div>
    <div>
      <span>Buying power</span
      ><strong>{{ money(store.portfolio?.cash) }}</strong>
    </div>
    <div>
      <span>Unrealised P/L</span
      ><strong :class="store.unrealized >= 0 ? 'positive' : 'negative'">{{
        money(store.unrealized)
      }}</strong>
    </div>
    <div>
      <span>Total return</span
      ><strong :class="store.totalPnl >= 0 ? 'positive' : 'negative'">{{
        percent(
          store.portfolio
            ? (store.totalPnl / store.portfolio.initialCash) * 100
            : null,
        )
      }}</strong>
    </div>
  </section>
  <PortfolioPanel detailed /><ActivityPanel compact />
</template>

<script setup lang="ts">
import { useTerminal } from '../../stores/terminal'
import { money, percent } from '../../lib/format'
import PortfolioPanel from '../PortfolioPanel.vue'
import ActivityPanel from '../ActivityPanel.vue'
const store = useTerminal()
</script>
