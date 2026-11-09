<template>
  <header class="topbar">
    <button
      class="icon-button mobile-menu"
      aria-label="Open navigation"
      :aria-expanded="shell.mobileNav"
      aria-controls="main-navigation"
      @click="shell.mobileNav = true"
    >
      <Menu :size="20" />
    </button>
    <button
      class="search-trigger"
      aria-label="Search stocks"
      @click="shell.picker = true"
    >
      <Search :size="15" /><span>Search stocks, companies…</span><kbd>⌘ K</kbd>
    </button>
    <div class="topbar-right">
      <div class="select-control">
        <select
          v-model="currency.selected"
          class="currency-select compact-currency"
          aria-label="Display currency"
        >
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
          <option value="EUR">EUR</option>
        </select>
        <ChevronDown :size="14" aria-hidden="true" />
      </div>
      <span
        class="market-session"
        title="US weekday schedule; market holidays are not included"
        ><i
          class="status-dot"
          :class="{ amber: store.status.mode === 'demo' }"
        ></i
        >{{ shell.session }}</span
      >
      <div class="top-divider"></div>
      <button
        class="icon-button notification-button"
        aria-label="Notifications"
        :aria-expanded="store.notificationsOpen"
        @click="shell.toggleNotifications"
      >
        <Bell :size="18" /><i v-if="store.notice"></i></button
      ><button
        class="profile-trigger"
        aria-label="Account menu"
        :aria-expanded="shell.profile"
        @click="shell.toggleProfile"
      >
        <UserRound :size="18" />
      </button>
    </div>
    <section
      v-if="store.notificationsOpen"
      class="top-popover"
      aria-label="Notifications"
    >
      <h3>Notifications</h3>
      <p>
        {{ store.notice || 'No notifications.' }}
      </p>
      <div class="popover-separator"></div>
      <small>{{ store.status.message }}</small
      ><button class="text-button" @click="shell.dismissNotifications">
        Mark as read
      </button>
    </section>
    <section v-if="shell.profile" class="top-popover account-popover">
      <h3>Shared paper account</h3>
      <strong>{{ money(store.equity) }}</strong>
    </section>
  </header>
</template>

<script setup lang="ts">
import { Menu, Search, Bell, UserRound, ChevronDown } from 'lucide-vue-next'
import { useTerminal } from '../../stores/terminal'
import { useCurrency } from '../../stores/currency'
import { useShell } from '../../stores/shell'
import { money } from '../../lib/format'
const store = useTerminal()
const currency = useCurrency()
const shell = useShell()
</script>
