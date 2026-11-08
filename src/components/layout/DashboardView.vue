<template>
  <MarketStrip />
  <div class="dashboard-grid">
    <div class="chart-column"><MarketChart /><PortfolioPanel /></div>
    <div class="watch-column">
      <WatchlistPanel all /><MarketMovers />
    </div>
    <div class="trade-column">
      <TradeTicket />
      <AccountSummary />
    </div>
  </div>
  <ActivityPanel compact />
</template>

<script setup lang="ts">
import MarketStrip from '../MarketStrip.vue'
import MarketChart from '../MarketChart.vue'
import PortfolioPanel from '../PortfolioPanel.vue'
import WatchlistPanel from '../WatchlistPanel.vue'
import MarketMovers from '../MarketMovers.vue'
import TradeTicket from '../TradeTicket.vue'
import AccountSummary from '../AccountSummary.vue'
import ActivityPanel from '../ActivityPanel.vue'
</script>
