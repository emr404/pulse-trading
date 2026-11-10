import {
  serverMessageSchema,
  type ServerMessage,
  type MarketFrame,
} from '../../../shared/protocol'
import type { FeedStatus, Portfolio } from '../../../shared/types'
interface Socket {
  readyState: number
  onopen: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent<string>) => void) | null
  send(data: string): void
  close(): void
}
interface Options {
  socket(): Socket
  frame(frame: MarketFrame): void
  portfolio(data: Portfolio): void
  state(state: FeedStatus['state']): void
  unsynchronized(): void
  online(): boolean
}
export const createMarketConnection = (options: Options) => {
  let localSocket: Socket | undefined = undefined
  let retry: ReturnType<typeof setTimeout> | undefined = undefined
  let health: ReturnType<typeof setInterval> | undefined = undefined
  let deadline: ReturnType<typeof setTimeout> | undefined = undefined
  let stopped = true
  let attempts = 0
  let localSession = ''
  let localSequence = -1
  let synced = false
  let lastMessage = 0
  let openedAt = 0
  const localMetrics = { invalid: 0, duplicate: 0, gaps: 0 }
  const start = (): void => {
    if (!stopped) return
    stopped = false
    connect()
    health = setInterval(() => {
      if (
        localSocket?.readyState === 1 &&
        Date.now() - lastMessage > 25000
      )
        localSocket.close()
    }, 1000)
  }

  const connect = (): void => {
    if (stopped) return
    if (!options.online()) {
      options.state('disconnected')
      schedule()
      return
    }
    options.state(attempts ? 'reconnecting' : 'connecting')
    let socket: Socket
    try {
      socket = options.socket()
      localSocket = socket
    } catch {
      options.unsynchronized()
      options.state('reconnecting')
      schedule()
      return
    }
    deadline = setTimeout(() => socket.close(), 10000)
    socket.onopen = () => {
      if (localSocket !== socket || stopped) return
      openedAt = lastMessage = Date.now()
      try {
        socket.send(JSON.stringify({ type: 'subscribe' }))
      } catch {
        socket.close()
      }
    }
    socket.onmessage = (event) => {
      if (localSocket !== socket || stopped) return
      try {
        receive(event.data)
      } catch {
        synced = false
        options.unsynchronized()
        options.state('reconnecting')
        socket.close()
      }
    }
    socket.onerror = () => socket.close()
    socket.onclose = () => {
      if (localSocket !== socket || stopped) return
      clearTimeout(deadline)
      synced = false
      options.unsynchronized()
      options.state(
        options.online() ? 'reconnecting' : 'disconnected',
      )
      schedule()
    }
  }

  const schedule = (): void => {
    clearTimeout(retry)
    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5))
    retry = setTimeout(() => connect(), delay)
  }

  const resync = (): void => {
    if (!synced) return
    localMetrics.gaps++
    synced = false
    options.unsynchronized()
    options.state('reconnecting')
    try {
      localSocket?.send(JSON.stringify({ type: 'resync' }))
    } catch {
      localSocket?.close()
      return
    }
    clearTimeout(deadline)
    deadline = setTimeout(() => localSocket?.close(), 10000)
  }

  const receive = (raw: string): void => {
    let value: ServerMessage
    try {
      const result = serverMessageSchema.safeParse(JSON.parse(raw))
      if (!result.success) {
        localMetrics.invalid++
        resync()
        return
      }
      value = result.data
    } catch {
      localMetrics.invalid++
      resync()
      return
    }
    if (value.type === 'portfolio') {
      options.portfolio(value.data)
      return
    }
    if (value.type === 'heartbeat') {
      lastMessage = Date.now()
      if (synced && Date.now() - openedAt > 10000) attempts = 0
      if (
        synced &&
        (value.session !== localSession || value.sequence !== localSequence)
      )
        resync()
      return
    }
    if (
      value.quotes.some(
        (q) =>
          q.updatedAt > Date.now() + 5000 ||
          q.quoteAt > Date.now() + 5000 ||
          (q.priceAt ?? 0) > Date.now() + 5000,
      )
    ) {
      localMetrics.invalid++
      resync()
      return
    }
    const frame = value
    lastMessage = Date.now()
    if (frame.type === 'snapshot') {
      if (
        synced &&
        frame.session === localSession &&
        frame.sequence <= localSequence
      ) {
        localMetrics.duplicate++
        return
      }
      localSession = frame.session
      localSequence = frame.sequence
      synced = true
      clearTimeout(deadline)
      options.state('connected')
    } else {
      if (!synced) return
      if (
        frame.session !== localSession ||
        frame.sequence > localSequence + 1
      ) {
        resync()
        return
      }
      if (frame.sequence <= localSequence) {
        localMetrics.duplicate++
        return
      }
      localSequence = frame.sequence
    }
    if (Date.now() - openedAt > 10000) attempts = 0
    options.frame(frame)
  }

  const reconnect = (): void => {
    if (stopped) return
    clearTimeout(retry)
    if (localSocket && localSocket.readyState < 2) localSocket.close()
    else connect()
  }

  const stop = (): void => {
    stopped = true
    clearTimeout(retry)
    clearTimeout(deadline)
    clearInterval(health)
    if (localSocket) {
      localSocket.onclose = null
      localSocket.onmessage = null
      localSocket.close()
    }
  }

  return { start, reconnect, stop, metrics: localMetrics }
}
export type MarketConnection = ReturnType<typeof createMarketConnection>
