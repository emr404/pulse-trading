import WebSocket from 'ws'
import { EventProcessor } from './event-processor.js'
import { z } from 'zod'
import {
  RANGE_CONFIG,
  type Asset,
  type Candle,
  type MarketSnapshot,
  type Range,
} from '../../shared/types.js'
import type { MarketProvider } from './types.js'
const barSchema = z.object({
  t: z.string(),
  o: z.number().positive(),
  h: z.number().positive(),
  l: z.number().positive(),
  c: z.number().positive(),
  v: z.number().nonnegative(),
})
const eventSchema = z.object({
  T: z.string(),
  S: z.string().optional(),
  msg: z.string().optional(),
  code: z.number().optional(),
  p: z.number().optional(),
  s: z.number().optional(),
  bp: z.number().optional(),
  ap: z.number().optional(),
  t: z.string().optional(),
})
export class AlpacaProvider implements MarketProvider {
  private processor = new EventProcessor()
  private indices = new Map<string, number>()
  private authenticationTimer?: ReturnType<typeof setTimeout>
  private ws?: WebSocket
  private retry?: ReturnType<typeof setTimeout>
  private watchdog?: ReturnType<typeof setInterval>
  private stopped = false
  private failed = false
  private attempts = 0
  private alive = true
  private state: MarketSnapshot
  private onUpdate = () => {}
  private previousCloses = new Map<string, number>()
  private cache = new Map<string, { at: number; bars: Candle[] }>()
  constructor(
    assets: Asset[],
    private key: string,
    private secret: string,
    private feed: 'iex' | 'sip',
  ) {
    this.state = {
      assets,
      quotes: [],
      trails: {},
      status: {
        mode: 'live',
        state: 'connecting',
        provider: `Alpaca ${feed.toUpperCase()}`,
        message: 'Connecting to market data…',
        lastMessageAt: null,
      },
    }
  }
  snapshot() {
    return this.state
  }
  start(onUpdate: () => void) {
    this.onUpdate = onUpdate
    void this.loadPreviousCloses()
    this.connect()
  }
  private headers() {
    return { 'APCA-API-KEY-ID': this.key, 'APCA-API-SECRET-KEY': this.secret }
  }
  private async loadPreviousCloses() {
    // Daily history provides an actual prior close; unknown changes remain null.
    await Promise.all(
      this.state.assets.map(async (a) => {
        try {
          const bars = await this.candles(a.symbol, '3M')
          const today = new Date().toISOString().slice(0, 10)
          const previous = bars
            .filter(
              (b) => new Date(b.time * 1000).toISOString().slice(0, 10) < today,
            )
            .at(-1)
          if (previous) this.previousCloses.set(a.symbol, previous.close)
        } catch {
          /* The stream still works when historical access is unavailable. */
        }
      }),
    )
  }
  private connect() {
    if (this.stopped || this.failed) return
    this.state.status.state = this.attempts ? 'reconnecting' : 'connecting'
    this.onUpdate()
    const socket = (this.ws = new WebSocket(
      `wss://stream.data.alpaca.markets/v2/${this.feed}`,
      { handshakeTimeout: 10000 },
    ))
    socket.on('open', () => {
      this.authenticationTimer = setTimeout(() => socket.terminate(), 10000)
      this.alive = true
      socket.send(
        JSON.stringify({ action: 'auth', key: this.key, secret: this.secret }),
      )
      this.watchdog = setInterval(() => {
        if (!this.alive) {
          socket.terminate()
          return
        }
        this.alive = false
        socket.ping()
      }, 20000)
    })
    socket.on('pong', () => {
      this.alive = true
    })
    socket.on('message', (raw) => {
      if (this.stopped || this.ws !== socket) return
      let messages: unknown
      try {
        messages = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (!Array.isArray(messages)) return
      for (const item of messages) {
        const parsed = eventSchema.safeParse(item)
        if (!parsed.success) continue
        const e = parsed.data
        if (e.T === 'success' && e.msg === 'authenticated') {
          clearTimeout(this.authenticationTimer)
          socket.send(
            JSON.stringify({
              action: 'subscribe',
              trades: this.state.assets.map((a) => a.symbol),
              quotes: this.state.assets.map((a) => a.symbol),
            }),
          )
          this.state.status = {
            ...this.state.status,
            state: 'connected',
            message: 'Live exchange data. Paper trading only.',
          }
        }
        if (e.T === 'error') {
          this.state.status.state = 'disconnected'
          this.state.status.message = `Provider rejected connection (code ${e.code ?? 'unknown'}). Check credentials, feed access, and symbol limits.`
          this.failed = true
          socket.close()
        }
        if (
          (e.T !== 't' && e.T !== 'q') ||
          !e.S ||
          !this.state.assets.some((a) => a.symbol === e.S) ||
          !e.t
        )
          continue
        const index = this.indices.get(e.S)
        const existing =
          index === undefined ? undefined : this.state.quotes[index]
        const quote = this.processor.process(
          item,
          existing,
          this.previousCloses.get(e.S) ?? null,
        )
        if (!quote) continue
        if (index === undefined) {
          this.indices.set(e.S, this.state.quotes.length)
          this.state.quotes.push(quote)
        } else this.state.quotes[index] = quote
        if (e.T === 't') {
          const trail = (this.state.trails[e.S] ??= [])
          trail.push(quote.price)
          if (trail.length > 30) trail.shift()
        }
        this.state.status.lastMessageAt = Date.now()
        this.attempts = 0
        this.onUpdate()
      }
      this.onUpdate()
    })
    socket.on('error', () => {
      this.state.status.message =
        'Market connection interrupted. Retrying automatically.'
    })
    socket.on('close', () => {
      if (this.ws !== socket) return
      clearInterval(this.watchdog)
      clearTimeout(this.authenticationTimer)
      if (this.stopped || this.failed) {
        this.onUpdate()
        return
      }
      this.state.status.state = 'reconnecting'
      this.onUpdate()
      this.retry = setTimeout(
        () => this.connect(),
        Math.min(30000, 1000 * 2 ** Math.min(this.attempts++, 5)),
      )
    })
  }
  async candles(symbol: string, range: Range): Promise<Candle[]> {
    const cacheKey = `${symbol}:${range}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.at < 60000) return cached.bars
    const config = RANGE_CONFIG[range]
    const params = new URLSearchParams({
      symbols: symbol,
      timeframe: config.interval,
      start: new Date(Date.now() - config.days * 86400000).toISOString(),
      feed: this.feed,
      limit: '10000',
      adjustment: 'split',
      sort: 'asc',
    })
    const response = await fetch(
      `https://data.alpaca.markets/v2/stocks/bars?${params}`,
      { headers: this.headers(), signal: AbortSignal.timeout(10000) },
    )
    if (!response.ok)
      throw new Error(
        `Historical data unavailable (${response.status}). Check provider permissions.`,
      )
    const body = z
      .object({ bars: z.record(z.string(), z.array(barSchema)).nullable() })
      .parse(await response.json())
    const bars = (body.bars?.[symbol] ?? []).map((b) => ({
      time: Math.floor(Date.parse(b.t) / 1000),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
    }))
    this.cache.set(cacheKey, { at: Date.now(), bars })
    return bars
  }
  stop() {
    this.stopped = true
    clearTimeout(this.retry)
    clearTimeout(this.authenticationTimer)
    clearInterval(this.watchdog)
    this.ws?.close()
  }
}
