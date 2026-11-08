<template>
  <div class="page-heading">
    <div>
      <h1>{{ shell.title }}</h1>
    </div>
    <ConnectionBadge />
  </div>
  <div v-if="!store.connected" class="connection-alert" role="alert">
    <span
      >{{
        store.connection === 'disconnected'
          ? 'Disconnected.'
          : store.connection === 'connecting'
            ? 'Connecting to market data.'
            : 'Reconnecting to market data.'
      }}
      Orders are paused until fresh prices return.</span
    ><button class="text-button" @click="emit('reconnect')">
      Retry connection
    </button>
  </div>
  <div
    v-if="store.status.mode === 'live' && store.status.state === 'disconnected'"
    class="connection-alert"
  >
    {{ store.status.message }}
  </div>
  <div v-if="currency.selected !== 'USD'" class="fx-notice" role="status">
    {{ currency.note }} · Display conversion only; all trades settle in USD.
  </div>
</template>

<script setup lang="ts">
import ConnectionBadge from '../ConnectionBadge.vue'
import { useTerminal } from '../../stores/terminal'
import { useCurrency } from '../../stores/currency'
import { useShell } from '../../stores/shell'
const emit = defineEmits<{ reconnect: [] }>()
const store = useTerminal()
const currency = useCurrency()
const shell = useShell()
</script>
