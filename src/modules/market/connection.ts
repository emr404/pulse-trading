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
  let activeSocket: Socket | undefined = undefined
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined = undefined
  let healthCheckTimer: ReturnType<typeof setInterval> | undefined = undefined
  let connectionDeadline: ReturnType<typeof setTimeout> | undefined = undefined
  let stopped = true
  let reconnectAttempts = 0
  let currentSession = ''
  let lastSequence = -1
  let synchronized = false
  let lastMessageAt = 0
  let openedAt = 0
  const connectionMetrics = { invalid: 0, duplicate: 0, gaps: 0 }
  const start = (): void => {
    if (!stopped) return
    stopped = false
    connect()
    healthCheckTimer = setInterval(() => {
      if (
        activeSocket?.readyState === 1 &&
        Date.now() - lastMessageAt > 25000
      )
        activeSocket.close()
    }, 1000)
  }

  const connect = (): void => {
    if (stopped) return
    if (!options.online()) {
      options.state('disconnected')
      scheduleReconnect()
      return
    }
    options.state(reconnectAttempts ? 'reconnecting' : 'connecting')
    let socket: Socket
    try {
      socket = options.socket()
      activeSocket = socket
    } catch {
      options.unsynchronized()
      options.state('reconnecting')
      scheduleReconnect()
      return
    }
    connectionDeadline = setTimeout(() => socket.close(), 10000)
    socket.onopen = () => {
      if (activeSocket !== socket || stopped) return
      openedAt = lastMessageAt = Date.now()
      try {
        socket.send(JSON.stringify({ type: 'subscribe' }))
      } catch {
        socket.close()
      }
    }
    socket.onmessage = (event) => {
      if (activeSocket !== socket || stopped) return
      try {
        receiveMessage(event.data)
      } catch {
        synchronized = false
        options.unsynchronized()
        options.state('reconnecting')
        socket.close()
      }
    }
    socket.onerror = () => socket.close()
    socket.onclose = () => {
      if (activeSocket !== socket || stopped) return
      clearTimeout(connectionDeadline)
      synchronized = false
      options.unsynchronized()
      options.state(
        options.online() ? 'reconnecting' : 'disconnected',
      )
      scheduleReconnect()
    }
  }

  const scheduleReconnect = (): void => {
    clearTimeout(reconnectTimer)
    const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempts++, 5))
    reconnectTimer = setTimeout(() => connect(), delay)
  }

  const requestSnapshot = (): void => {
    if (!synchronized) return
    connectionMetrics.gaps++
    synchronized = false
    options.unsynchronized()
    options.state('reconnecting')
    try {
      activeSocket?.send(JSON.stringify({ type: 'resync' }))
    } catch {
      activeSocket?.close()
      return
    }
    clearTimeout(connectionDeadline)
    connectionDeadline = setTimeout(() => activeSocket?.close(), 10000)
  }

  const receiveMessage = (raw: string): void => {
    let value: ServerMessage
    try {
      const result = serverMessageSchema.safeParse(JSON.parse(raw))
      if (!result.success) {
        connectionMetrics.invalid++
        requestSnapshot()
        return
      }
      value = result.data
    } catch {
      connectionMetrics.invalid++
      requestSnapshot()
      return
    }
    if (value.type === 'portfolio') {
      options.portfolio(value.data)
      return
    }
    if (value.type === 'heartbeat') {
      lastMessageAt = Date.now()
      if (synchronized && Date.now() - openedAt > 10000) reconnectAttempts = 0
      if (
        synchronized &&
        (value.session !== currentSession || value.sequence !== lastSequence)
      )
        requestSnapshot()
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
      connectionMetrics.invalid++
      requestSnapshot()
      return
    }
    const frame = value
    lastMessageAt = Date.now()
    if (frame.type === 'snapshot') {
      if (
        synchronized &&
        frame.session === currentSession &&
        frame.sequence <= lastSequence
      ) {
        connectionMetrics.duplicate++
        return
      }
      currentSession = frame.session
      lastSequence = frame.sequence
      synchronized = true
      clearTimeout(connectionDeadline)
      options.state('connected')
    } else {
      if (!synchronized) return
      if (
        frame.session !== currentSession ||
        frame.sequence > lastSequence + 1
      ) {
        requestSnapshot()
        return
      }
      if (frame.sequence <= lastSequence) {
        connectionMetrics.duplicate++
        return
      }
      lastSequence = frame.sequence
    }
    if (Date.now() - openedAt > 10000) reconnectAttempts = 0
    options.frame(frame)
  }

  const reconnect = (): void => {
    if (stopped) return
    clearTimeout(reconnectTimer)
    if (activeSocket && activeSocket.readyState < 2) activeSocket.close()
    else connect()
  }

  const stop = (): void => {
    stopped = true
    clearTimeout(reconnectTimer)
    clearTimeout(connectionDeadline)
    clearInterval(healthCheckTimer)
    if (activeSocket) {
      activeSocket.onclose = null
      activeSocket.onmessage = null
      activeSocket.close()
    }
  }

  return { start, reconnect, stop, metrics: connectionMetrics }
}
export type MarketConnection = ReturnType<typeof createMarketConnection>
