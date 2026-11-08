<template>
  <section class="panel account-summary">
    <div class="panel-heading">
      <h2>Account snapshot</h2>
      <BriefcaseBusiness :size="15" />
    </div>
    <div>
      <span>Available cash</span><b>{{ money(store.portfolio?.cash) }}</b>
    </div>
    <div>
      <span>Unrealised P/L</span
      ><b :class="store.unrealized >= 0 ? 'positive' : 'negative'">{{
        money(store.unrealized)
      }}</b>
    </div>
    <div>
      <span>Realised P/L</span
      ><b
        :class="
          (store.portfolio?.realizedPnl ?? 0) >= 0 ? 'positive' : 'negative'
        "
        >{{ money(store.portfolio?.realizedPnl) }}</b
      >
    </div>
    <div>
      <span>Open positions</span
      ><b>{{ store.portfolio?.positions.length ?? 0 }}</b>
    </div>
  </section>
</template>

<script setup lang="ts">
import { BriefcaseBusiness } from 'lucide-vue-next'
import { useTerminal } from '../stores/terminal'
import { money, percent, time } from '../lib/format'
const store = useTerminal()
</script>
