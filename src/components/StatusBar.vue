<template>
  <div class="statusbar">
    <span>{{
      store.status.mode === 'demo' ? 'Simulated prices' : store.status.provider
    }}</span>
    <span
      ><span class="status-clock"
        >{{ time(store.now) }} local
        <span class="statusbar-divider">|</span></span
      >
      Paper trading only</span
    >
  </div>
</template>

<script setup lang="ts">
import { useTerminal } from '../stores/terminal'
import { time } from '../lib/format'
const store = useTerminal()
</script>
