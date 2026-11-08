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
export class MarketConnection {
  private socket?: Socket
  private retry?: ReturnType<typeof setTimeout>
  private health?: ReturnType<typeof setInterval>
  private deadline?: ReturnType<typeof setTimeout>
  private stopped = true
  private attempts = 0
  private session = ''
  private sequence = -1
  private synced = false
  private lastMessage = 0
  private openedAt = 0
  readonly metrics = { invalid: 0, duplicate: 0, gaps: 0 }
  constructor(private options: Options) {}
  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.connect()
    this.health = setInterval(() => {
      if (
        this.socket?.readyState === 1 &&
        Date.now() - this.lastMessage > 25000
      )
        this.socket.close()
    }, 1000)
  }
  private connect(): void {
    if (this.stopped) return
    if (!this.options.online()) {
      this.options.state('disconnected')
      this.schedule()
      return
    }
    this.options.state(this.attempts ? 'reconnecting' : 'connecting')
    let socket: Socket
    try {
      socket = this.options.socket()
      this.socket = socket
    } catch {
      this.options.unsynchronized()
      this.options.state('reconnecting')
      this.schedule()
      return
    }
    this.deadline = setTimeout(() => socket.close(), 10000)
    socket.onopen = () => {
      if (this.socket !== socket || this.stopped) return
      this.openedAt = this.lastMessage = Date.now()
      try {
        socket.send(JSON.stringify({ type: 'subscribe' }))
      } catch {
        socket.close()
      }
    }
    socket.onmessage = (event) => {
      if (this.socket !== socket || this.stopped) return
      try {
        this.receive(event.data)
      } catch {
        this.synced = false
        this.options.unsynchronized()
        this.options.state('reconnecting')
        socket.close()
      }
    }
    socket.onerror = () => socket.close()
    socket.onclose = () => {
      if (this.socket !== socket || this.stopped) return
      clearTimeout(this.deadline)
      this.synced = false
      this.options.unsynchronized()
      this.options.state(
        this.options.online() ? 'reconnecting' : 'disconnected',
      )
      this.schedule()
    }
  }
  private schedule(): void {
    clearTimeout(this.retry)
    const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempts++, 5))
    this.retry = setTimeout(() => this.connect(), delay)
  }
  private resync(): void {
    if (!this.synced) return
    this.metrics.gaps++
    this.synced = false
    this.options.unsynchronized()
    this.options.state('reconnecting')
    try {
      this.socket?.send(JSON.stringify({ type: 'resync' }))
    } catch {
      this.socket?.close()
      return
    }
    clearTimeout(this.deadline)
    this.deadline = setTimeout(() => this.socket?.close(), 10000)
  }
  private receive(raw: string): void {
    let value: ServerMessage
    try {
      const result = serverMessageSchema.safeParse(JSON.parse(raw))
      if (!result.success) {
        this.metrics.invalid++
        this.resync()
        return
      }
      value = result.data
    } catch {
      this.metrics.invalid++
      this.resync()
      return
    }
    if (value.type === 'portfolio') {
      this.options.portfolio(value.data)
      return
    }
    if (value.type === 'heartbeat') {
      this.lastMessage = Date.now()
      if (this.synced && Date.now() - this.openedAt > 10000) this.attempts = 0
      if (
        this.synced &&
        (value.session !== this.session || value.sequence !== this.sequence)
      )
        this.resync()
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
      this.metrics.invalid++
      this.resync()
      return
    }
    const frame = value
    this.lastMessage = Date.now()
    if (frame.type === 'snapshot') {
      if (
        this.synced &&
        frame.session === this.session &&
        frame.sequence <= this.sequence
      ) {
        this.metrics.duplicate++
        return
      }
      this.session = frame.session
      this.sequence = frame.sequence
      this.synced = true
      clearTimeout(this.deadline)
      this.options.state('connected')
    } else {
      if (!this.synced) return
      if (
        frame.session !== this.session ||
        frame.sequence > this.sequence + 1
      ) {
        this.resync()
        return
      }
      if (frame.sequence <= this.sequence) {
        this.metrics.duplicate++
        return
      }
      this.sequence = frame.sequence
    }
    if (Date.now() - this.openedAt > 10000) this.attempts = 0
    this.options.frame(frame)
  }
  reconnect(): void {
    if (this.stopped) return
    clearTimeout(this.retry)
    if (this.socket && this.socket.readyState < 2) this.socket.close()
    else this.connect()
  }
  stop(): void {
    this.stopped = true
    clearTimeout(this.retry)
    clearTimeout(this.deadline)
    clearInterval(this.health)
    if (this.socket) {
      this.socket.onclose = null
      this.socket.onmessage = null
      this.socket.close()
    }
  }
}
