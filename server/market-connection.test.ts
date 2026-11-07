import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarketConnection } from '../src/modules/market/connection'
import type { MarketFrame } from '../shared/protocol'
class FakeSocket {
  readyState = 0
  sent: string[] = []
  onopen: ((e: Event) => void) | null = null
  onclose: ((e: CloseEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  onmessage: ((e: MessageEvent) => void) | null = null
  send(data: string) {
    this.sent.push(data)
  }
  open() {
    this.readyState = 1
    this.onopen?.({} as Event)
  }
  close() {
    if (this.readyState === 3) return
    this.readyState = 3
    this.onclose?.({} as CloseEvent)
  }
  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent)
  }
}
const frame = (
  sequence = 0,
  type: 'snapshot' | 'delta' = 'snapshot',
): MarketFrame => ({
  type,
  sequence,
  session: 'test',
  quotes: [],
  assets: [],
  trails: {},
  candles: [],
  status: {
    mode: 'demo',
    state: 'connected',
    message: '',
    provider: 'test',
    lastMessageAt: Date.now(),
  },
})
afterEach(() => vi.useRealTimers())
function setup() {
  vi.useFakeTimers()
  const sockets: FakeSocket[] = [],
    receive = vi.fn(),
    state = vi.fn(),
    unsync = vi.fn()
  const connection = new MarketConnection({
    socket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
    frame: receive,
    portfolio: () => {},
    state,
    unsynchronized: unsync,
    online: () => true,
  })
  connection.start()
  return { connection, sockets, receive, state, unsync }
}
describe('resilient market transport', () => {
  it('backs off repeated failures, restores subscriptions, and cleans up all timers', () => {
    const { connection, sockets } = setup()
    sockets[0].open()
    expect(sockets[0].sent).toContain('{"type":"subscribe"}')
    sockets[0].close()
    vi.advanceTimersByTime(999)
    expect(sockets).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(2)
    sockets[1].open()
    expect(sockets[1].sent).toContain('{"type":"subscribe"}')
    sockets[1].close()
    vi.advanceTimersByTime(1999)
    expect(sockets).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(3)
    connection.stop()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(60000)
    expect(sockets).toHaveLength(3)
  })
  it('detects silent sockets and times out connections that never synchronize', () => {
    const { connection, sockets, state } = setup()
    sockets[0].open()
    sockets[0].message(frame())
    vi.advanceTimersByTime(26000)
    expect(sockets[0].readyState).toBe(3)
    expect(state).toHaveBeenCalledWith('reconnecting')
    connection.stop()
    const second = setup()
    second.sockets[0].open()
    vi.advanceTimersByTime(10000)
    expect(second.sockets[0].readyState).toBe(3)
    second.connection.stop()
  })
  it('rejects duplicate/out-of-order frames and resynchronizes gaps, restarts and malformed quotes', () => {
    const { connection, sockets, receive, unsync } = setup(),
      socket = sockets[0]
    socket.open()
    socket.message(frame())
    socket.message(frame(1, 'delta'))
    socket.message(frame(1, 'delta'))
    socket.message(frame(0, 'delta'))
    expect(receive).toHaveBeenCalledTimes(2)
    socket.message(frame(3, 'delta'))
    expect(unsync).toHaveBeenCalledTimes(1)
    expect(socket.sent).toContain('{"type":"resync"}')
    socket.message(frame(4, 'delta'))
    expect(receive).toHaveBeenCalledTimes(2)
    socket.message(frame(4))
    expect(receive).toHaveBeenCalledTimes(3)
    socket.message({ type: 'heartbeat', session: 'new-server', sequence: 0 })
    expect(unsync).toHaveBeenCalledTimes(2)
    socket.message({ ...frame(), session: 'new-server' })
    socket.message({
      ...frame(1, 'delta'),
      session: 'new-server',
      quotes: [{ symbol: 'AAPL', price: -1 }],
    })
    expect(connection.metrics.invalid).toBe(1)
    expect(unsync).toHaveBeenCalledTimes(3)
    connection.stop()
  })
})
