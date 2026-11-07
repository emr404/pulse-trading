<script setup lang="ts">
import { CircleHelp } from 'lucide-vue-next'
import { useTerminal } from '../stores/terminal'
import { time } from '../lib/format'
const store = useTerminal()
</script>
<template>
  <div class="statusbar">
    <span
      ><i class="status-dot" :class="{ amber: !store.connected }"></i
      >{{ store.connected ? 'All systems connected' : 'Connection interrupted'
      }}</span
    ><span
      >{{ time(store.now) }} LOCAL
      <span class="statusbar-divider">|</span> Paper trading only
      <CircleHelp :size="11"
    /></span>
  </div>
</template>
