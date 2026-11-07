import { onMounted, onUnmounted } from 'vue'
import { MarketConnection } from '../modules/market/connection'
import { useMarket } from '../modules/market/store'
import { usePortfolio } from '../modules/portfolio/store'
export function useMarketStream() {
  const market = useMarket(),
    portfolio = usePortfolio()
  const connection = new MarketConnection({
    socket: () =>
      new WebSocket(
        `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`,
      ),
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
