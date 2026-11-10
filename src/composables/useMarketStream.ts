import { socketUrl } from '../lib/endpoints'
import { onMounted, onUnmounted } from 'vue'
import { createMarketConnection } from '../modules/market/connection'
import { useMarket } from '../modules/market/store'
import { usePortfolio } from '../modules/portfolio/store'
export const useMarketStream = (): { reconnect(): void } => {
  const market = useMarket(),
    portfolio = usePortfolio()
  const connection = createMarketConnection({
    socket: () => new WebSocket(socketUrl()),
    online: () => navigator.onLine,
    frame: (frame) => market.apply(frame),
    portfolio: (data) => portfolio.apply(data),
    state: (value) => {
      market.transport = value
      market.tick()
    },
    unsynchronized: () => {
      market.synchronized = false
      market.tick()
    },
  })
  let timer: ReturnType<typeof setInterval>
  const reconnect = () => connection.reconnect()
  onMounted(() => {
    connection.start()
    timer = setInterval(() => market.tick(), 1000)
    window.addEventListener('online', reconnect)
    window.addEventListener('offline', reconnect)
  })
  onUnmounted(() => {
    connection.stop()
    clearInterval(timer)
    window.removeEventListener('online', reconnect)
    window.removeEventListener('offline', reconnect)
  })
  return { reconnect }
}
