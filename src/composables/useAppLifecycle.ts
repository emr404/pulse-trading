import { onMounted, onUnmounted } from 'vue'
import { useShell } from '../stores/shell'
import { useOrders } from '../modules/orders/store'
import { useCurrency } from '../stores/currency'
import { useMarketStream } from './useMarketStream'

export interface AppLifecycle {
  reconnect(): void
}

export const useAppLifecycle = (): AppLifecycle => {
  const shell = useShell()
  const orders = useOrders()
  const currency = useCurrency()
  const stream = useMarketStream()
  let refreshTimer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    void currency.refresh()
    refreshTimer = setInterval(() => void currency.refresh(), 3600000)
    document.addEventListener('keydown', shell.shortcut)
  })
  onUnmounted(() => {
    orders.stop()
    currency.stop()
    clearInterval(refreshTimer)
    document.removeEventListener('keydown', shell.shortcut)
  })
  return stream
}
