export { api } from './api'
import { useCurrency } from '../stores/currency'
import type { Currency } from '../../shared/currency'

const currencyFormats = new Map<Currency, Intl.NumberFormat>()
const decimalFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 4,
})
const compactFormat = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
})
const timeFormat = new Intl.DateTimeFormat('en-US', {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const currencyFormat = (currency: Currency): Intl.NumberFormat => {
  let formatter = currencyFormats.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    currencyFormats.set(currency, formatter)
  }
  return formatter
}

export const money = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '—'
  const display = useCurrency()
  return currencyFormat(display.currency).format(value * display.rate)
}
export const moneyUsd = (value: number): string => {
  return Number.isFinite(value) ? currencyFormat('USD').format(value) : '—'
}
export const number = (value: number | null | undefined): string => {
  return value != null && Number.isFinite(value)
    ? decimalFormat.format(value)
    : '—'
}
export const compact = (value: number): string => {
  return Number.isFinite(value) ? compactFormat.format(value) : '—'
}
export const percent = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}
export const time = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : timeFormat.format(date)
}
