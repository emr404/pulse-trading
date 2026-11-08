<template>
  <aside class="sidebar" :class="{ 'mobile-open': shell.mobileNav }">
    <a
      href="#"
      class="brand"
      aria-label="Ledger markets"
      @click.prevent="shell.navigate('Markets')"
      ><span class="brand-icon"
        ><Activity :size="23" :stroke-width="2.4" /></span
      ><span>ledger<span class="brand-period">.</span></span></a
    >
    <nav aria-label="Main navigation">
      <button
        v-for="item in nav"
        :key="item.name"
        :class="{ active: store.page === item.name }"
        :aria-current="store.page === item.name ? 'page' : undefined"
        :title="item.name"
        @click="shell.navigate(item.name)"
      >
        <component :is="item.icon" :size="17" /><span>{{ item.name }}</span
        ><span v-if="item.name === 'Watchlist'" class="nav-count">{{
          store.watchlist.length
        }}</span>
      </button>
    </nav>
    <div class="sidebar-bottom">
      <button
        class="side-setting collapse-nav"
        :aria-label="
          shell.collapsed ? 'Expand navigation' : 'Collapse navigation'
        "
        @click="shell.collapsed = !shell.collapsed"
      >
        <PanelLeftClose :size="17" /><span>Collapse sidebar</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  Activity,
  ChartNoAxesCombined,
  Star,
  BriefcaseBusiness,
  History,
  PanelLeftClose,
} from 'lucide-vue-next'
import { useTerminal } from '../../stores/terminal'
import { useShell } from '../../stores/shell'
const store = useTerminal()
const shell = useShell()
const nav = [
  { name: 'Markets', icon: ChartNoAxesCombined },
  { name: 'Watchlist', icon: Star },
  { name: 'Portfolio', icon: BriefcaseBusiness },
  { name: 'Activity', icon: History },
] as const
</script>
