<template>
  <div class="terminal" :class="{ 'nav-collapsed': shell.collapsed }">
    <div
      v-if="shell.mobileNav"
      class="nav-scrim"
      @click="shell.mobileNav = false"
    ></div>
    <AppSidebar />
    <div class="main-shell">
      <AppHeader />
      <main>
        <PageHeading @reconnect="reconnect" />
        <DashboardView v-if="store.page === 'Markets'" />
        <WatchlistView v-else-if="store.page === 'Watchlist'" />
        <PortfolioView v-else-if="store.page === 'Portfolio'" />
        <ActivityPanel v-else-if="store.page === 'Activity'" />
      </main>
      <StatusBar />
    </div>
    <AssetPicker v-if="shell.picker" @close="shell.picker = false" />
  </div>
</template>

<script setup lang="ts">
import { useTerminal } from './stores/terminal'
import { useShell } from './stores/shell'
import { useAppLifecycle } from './composables/useAppLifecycle'
import AppSidebar from './components/layout/AppSidebar.vue'
import AppHeader from './components/layout/AppHeader.vue'
import PageHeading from './components/layout/PageHeading.vue'
import DashboardView from './components/layout/DashboardView.vue'
import WatchlistView from './components/layout/WatchlistView.vue'
import PortfolioView from './components/layout/PortfolioView.vue'
import ActivityPanel from './components/ActivityPanel.vue'
import StatusBar from './components/StatusBar.vue'
import AssetPicker from './components/AssetPicker.vue'
const store = useTerminal()
const shell = useShell()
const { reconnect } = useAppLifecycle()
</script>
