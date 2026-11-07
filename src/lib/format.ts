import { useCurrency } from '../stores/currency'
export function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—'
  const display = useCurrency()
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: display.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n * display.rate)
}
export const moneyUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    n,
  )
export const number = (n: number | null | undefined) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(n)
export const compact = (n: number) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(n)
export const percent = (n: number | null | undefined) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
export const time = (n: number | null) =>
  n ? new Date(n).toLocaleTimeString('en-US', { hour12: false }) : '—'
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(10000),
  })
  const body: unknown = await response.json()
  if (!response.ok)
    throw new Error(
      typeof body === 'object' && body !== null && 'error' in body
        ? String(body.error)
        : 'Request failed. Please try again.',
    )
  return body as T
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback
  } catch {
    return fallback
  }
}
export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Private browsing may disable storage. */
  }
}
