import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCurrency } from '../src/stores/currency'
import { money, moneyUsd } from '../src/lib/format'
beforeEach(() => setActivePinia(createPinia()))
describe('display currency', () => {
  it('converts only displayed values and keeps settlement formatting in USD', () => {
    const display = useCurrency()
    display.exchange = {
      base: 'USD',
      date: '2026-11-06',
      rates: { USD: 1, GBP: 0.8, EUR: 0.9 },
      cached: false,
    }
    display.selected = 'GBP'
    expect(money(100)).toBe('£80.00')
    expect(money(-10)).toBe('-£8.00')
    display.selected = 'EUR'
    expect(money(100)).toBe('€90.00')
    expect(moneyUsd(100)).toBe('$100.00')
    expect(money(null)).toBe('—')
  })
  it('uses explicitly labelled USD when no reference rates are available', () => {
    const display = useCurrency()
    display.selected = 'GBP'
    expect(display.currency).toBe('USD')
    expect(money(100)).toBe('$100.00')
    expect(display.note).toContain('GBP unavailable · Displaying USD')
  })
})
