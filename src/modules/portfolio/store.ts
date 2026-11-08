import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { Portfolio } from '../../../shared/types'
import { portfolioMessageSchema } from '../../../shared/portfolio-schema'
import { useMarket } from '../market/store'
import { valuePortfolio } from './valuation'
export const usePortfolio = defineStore('portfolio', () => {
  const market = useMarket(),
    portfolio = shallowRef<Portfolio | null>(null)
  const valuation = computed(() =>
    valuePortfolio(portfolio.value, (symbol) => market.quotes[symbol]),
  )
  const marketValue = computed(() => valuation.value.marketValue)
  const equity = computed(() => valuation.value.equity)
  const unrealized = computed(() => valuation.value.unrealized)
  const totalPnl = computed(() => valuation.value.totalPnl)
  const valuationEstimated = computed(
    () =>
      portfolio.value?.positions.some(
        (p) => !market.quotes[p.symbol] || market.stale[p.symbol],
      ) ?? false,
  )
  function apply(input: Portfolio): boolean {
    const parsed = portfolioMessageSchema.safeParse(input)
    if (parsed.success) portfolio.value = parsed.data
    return parsed.success
  }
  return {
    portfolio,
    marketValue,
    equity,
    unrealized,
    totalPnl,
    valuationEstimated,
    apply,
  }
})
