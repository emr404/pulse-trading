<template>
  <Teleport to="body"
    ><div class="modal-backdrop" @click.self="emit('close')">
      <section
        ref="dialog"
        class="asset-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="watchMode ? 'Manage watchlist' : 'Search stocks'"
      >
        <div class="dialog-search">
          <Search :size="18" /><input
            ref="input"
            v-model="query"
            aria-label="Search stocks"
            placeholder="Search ticker or company…"
          /><button
            class="icon-button"
            aria-label="Close search"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </div>
        <div class="dialog-label">
          {{
            watchMode
              ? 'ADD STOCKS TO YOUR WATCHLIST'
              : 'AVAILABLE STOCKS & ETFS'
          }}
        </div>
        <div class="search-results">
          <button
            v-for="asset in results"
            :key="asset.symbol"
            class="search-result"
            @click="choose(asset.symbol)"
          >
            <AssetMark :asset="asset" /><span
              ><b>{{ asset.symbol }}</b
              ><small>{{ asset.name }}</small></span
            ><span class="search-price"
              >{{ money(store.quotes[asset.symbol]?.price)
              }}<small
                :class="
                  (store.quotes[asset.symbol]?.changePct ?? 0) >= 0
                    ? 'positive'
                    : 'negative'
                "
                >{{ percent(store.quotes[asset.symbol]?.changePct) }}</small
              ></span
            ><component
              v-if="watchMode"
              :is="store.watchlist.includes(asset.symbol) ? Check : Plus"
              :size="16"
            />
          </button>
          <div v-if="!results.length" class="empty-state">
            No stocks match “{{ query }}”.<small
              >Try a company name or ticker.</small
            >
          </div>
        </div>
        <div class="dialog-footer">
          {{ results.length }} assets available <span>ESC to close</span>
        </div>
      </section>
    </div></Teleport
  >
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Search, X, Plus, Check } from 'lucide-vue-next'
import { useTerminal } from '../stores/terminal'
import { money, percent } from '../lib/format'
import AssetMark from './AssetMark.vue'
const props = defineProps<{ watchMode?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const store = useTerminal(),
  query = ref(''),
  input = ref<HTMLInputElement>(),
  dialog = ref<HTMLElement>()
let previousFocus: Element | null
const results = computed(() =>
  store.assets.filter((a) =>
    `${a.symbol} ${a.name}`.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
const choose = (symbol: string): void => {
  if (props.watchMode) store.toggleWatch(symbol)
  else {
    store.openStock(symbol)
    emit('close')
  }
}
const keydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') emit('close')
  if (event.key === 'Tab') {
    const nodes = dialog.value?.querySelectorAll<HTMLElement>('button,input')
    if (!nodes?.length) return
    const first = nodes[0],
      last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}
onMounted(() => {
  previousFocus = document.activeElement
  input.value?.focus()
  document.addEventListener('keydown', keydown)
})
onUnmounted(() => {
  document.removeEventListener('keydown', keydown)
  if (previousFocus instanceof HTMLElement) previousFocus.focus()
})
</script>
