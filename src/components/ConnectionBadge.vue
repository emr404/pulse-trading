<template>
  <div class="page-meta" role="status">
    <span class="connection-badge" :class="{ connected: store.connected }"
      ><i class="status-dot" :class="{ amber: !store.connected }"></i
      >{{
        store.connection === 'connected'
          ? 'Connected'
          : store.connection === 'reconnecting'
            ? 'Reconnecting'
            : store.connection === 'connecting'
              ? 'Connecting'
              : 'Disconnected'
      }}</span
    ><small
      >Last update <span>{{ time(store.status.lastMessageAt) }}</span></small
    >
  </div>
</template>

<script setup lang="ts">
import { useTerminal } from '../stores/terminal'
import { time } from '../lib/format'
const store = useTerminal()
</script>
