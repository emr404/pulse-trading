import { api } from '../lib/api'
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  CURRENCIES,
  exchangeRatesSchema,
  type Currency,
  type ExchangeRates,
} from '../../shared/currency'
export const useCurrency = defineStore('currency', () => {
  let saved: string | null = null
  try {
    saved = localStorage.getItem('pulse:currency')
  } catch {
    // Browser storage restrictions must not disable currency selection.
  }
  const selected = ref<Currency>(
    CURRENCIES.includes(saved as Currency) ? (saved as Currency) : 'USD',
  )
  const exchange = ref<ExchangeRates | null>(null)
  const loading = ref(false)
  const error = ref('')
  const currency = computed<Currency>(() =>
    selected.value === 'USD' || exchange.value ? selected.value : 'USD',
  )
  const rate = computed(() =>
    currency.value === 'USD' ? 1 : (exchange.value?.rates[currency.value] ?? 1),
  )
  const note = computed(() => {
    if (selected.value === 'USD') return 'USD · Account currency'
    if (!exchange.value)
      return loading.value
        ? `Loading ${selected.value} rates · Displaying USD`
        : `${selected.value} unavailable · Displaying USD`
    return `${currency.value} · FX ${exchange.value.date}${exchange.value.cached || error.value ? ' (cached)' : ''}`
  })
  let controller: AbortController | undefined
  const stop = (): void => {
    controller?.abort()
  }
  const refresh = async (): Promise<void> => {
    if (loading.value) return
    loading.value = true
    error.value = ''
    controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(10000),
    ])
    try {
      exchange.value = await api('/api/exchange-rates', exchangeRatesSchema, {
        signal,
      })
    } catch {
      error.value = 'Exchange rates unavailable. Try again shortly.'
    } finally {
      loading.value = false
    }
  }
  watch(selected, (value) => {
    try {
      localStorage.setItem('pulse:currency', value)
    } catch {
      // Browser storage restrictions must not disable currency selection.
    }
  })
  return {
    selected,
    exchange,
    loading,
    error,
    currency,
    rate,
    note,
    refresh,
    stop,
  }
})
