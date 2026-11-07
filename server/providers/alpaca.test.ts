import { EventEmitter } from 'node:events'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { ASSETS } from '../../shared/types.js'
const sockets = vi.hoisted(() => ({
  list: [] as {
    emit(event: string, ...args: unknown[]): boolean
    sent: string[]
    url: string
    closed: boolean
  }[],
}))
vi.mock('ws', () => ({
  default: class extends EventEmitter {
    sent: string[] = []
    closed = false
    constructor(public url: string) {
      super()
      sockets.list.push(this)
    }
    send(data: string) {
      this.sent.push(data)
    }
    ping() {
      this.emit('pong')
    }
    close() {
      this.closed = true
      this.emit('close')
    }
    terminate() {
      this.close()
    }
  },
}))
import { AlpacaProvider } from './alpaca.js'
beforeEach(() => {
  sockets.list.length = 0
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        bars: {
          AAPL: [
            {
              t: new Date(Date.now() - 86400000).toISOString(),
              o: 100,
              h: 102,
              l: 99,
              c: 100,
              v: 1000,
            },
          ],
        },
      }),
    }),
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('Alpaca adapter', () => {
  it('authenticates server-side, subscribes, normalizes quotes and excludes credentials from snapshots', async () => {
    const provider = new AlpacaProvider(
      [ASSETS[0]],
      'test-key',
      'test-secret',
      'iex',
    )
    const changed = vi.fn()
    provider.start(changed)
    await vi.advanceTimersByTimeAsync(0)
    const socket = sockets.list[0]
    expect(socket.url).toBe('wss://stream.data.alpaca.markets/v2/iex')
    socket.emit('open')
    expect(JSON.parse(socket.sent[0])).toEqual({
      action: 'auth',
      key: 'test-key',
      secret: 'test-secret',
    })
    socket.emit(
      'message',
      JSON.stringify([{ T: 'success', msg: 'authenticated' }]),
    )
    expect(JSON.parse(socket.sent[1])).toEqual({
      action: 'subscribe',
      trades: ['AAPL'],
      quotes: ['AAPL'],
    })
    socket.emit(
      'message',
      JSON.stringify([
        { T: 'q', S: 'AAPL', ap: 111, bp: 109, t: new Date().toISOString() },
        { T: 't', S: 'AAPL', p: 110, s: 10, t: new Date().toISOString() },
      ]),
    )
    expect(provider.snapshot().status.state).toBe('connected')
    expect(provider.snapshot().quotes[0]).toMatchObject({
      symbol: 'AAPL',
      price: 110,
      bid: 109,
      ask: 111,
      volume: 10,
      previousClose: 100,
    })
    expect(provider.snapshot().quotes[0].changePct).toBeCloseTo(10)
    expect(JSON.stringify(provider.snapshot())).not.toContain('test-secret')
    socket.emit('message', 'not json')
    socket.emit(
      'message',
      JSON.stringify([
        { T: 't', S: 'AAPL', p: -1, t: new Date().toISOString() },
      ]),
    )
    expect(provider.snapshot().quotes[0].price).toBe(110)
    provider.stop()
  })
  it('reconnects after transport loss, but stops retrying after rejected authentication', async () => {
    const provider = new AlpacaProvider([ASSETS[0]], 'key', 'secret', 'iex')
    provider.start(() => {})
    sockets.list[0].emit('close')
    expect(provider.snapshot().status.state).toBe('reconnecting')
    await vi.advanceTimersByTimeAsync(1000)
    expect(sockets.list).toHaveLength(2)
    sockets.list[1].emit(
      'message',
      JSON.stringify([{ T: 'error', code: 402, msg: 'auth failed' }]),
    )
    expect(provider.snapshot().status.state).toBe('disconnected')
    await vi.advanceTimersByTimeAsync(60000)
    expect(sockets.list).toHaveLength(2)
    provider.stop()
  })
})
