<template>
  <div class="watchlist-view">
    <WatchlistPanel expanded />
    <MarketChart />
  </div>
</template>

<script setup lang="ts">
import MarketChart from '../MarketChart.vue'
import WatchlistPanel from '../WatchlistPanel.vue'
</script>
