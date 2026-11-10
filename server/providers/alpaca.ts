import WebSocket from 'ws'
import { createEventProcessor } from './event-processor.js'
import { z } from 'zod'
import {
  RANGE_CONFIG,
  type Asset,
  type Candle,
  type MarketSnapshot,
  type Range,
} from '../../shared/types.js'
import type { MarketProvider } from './types.js'
import { barSchema, eventSchema, type AlpacaEvent } from './schemas.js'
export const createAlpacaProvider = (
  assets: Asset[],
  key: string,
  secret: string,
  feed: 'iex' | 'sip',
) => {
  const localProcessor = createEventProcessor()
  const indices = new Map<string, number>()
  let authenticationTimer: ReturnType<typeof setTimeout> | undefined = undefined
  let localWs: WebSocket | undefined = undefined
  let retry: ReturnType<typeof setTimeout> | undefined = undefined
  let watchdog: ReturnType<typeof setInterval> | undefined = undefined
  let stopped = false
  let failed = false
  let attempts = 0
  let alive = true
  let localState: MarketSnapshot
  let localOnUpdate = () => { }
  const previousCloses = new Map<string, number>()
  const cache = new Map<string, { at: number; bars: Candle[] }>()
  const snapshot = (): MarketSnapshot => {
    return localState
  }

  const start = (onUpdate: () => void): void => {
    localOnUpdate = onUpdate
    void loadPreviousCloses()
    connect()
  }

  const headers = (): Record<string, string> => {
    return { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret }
  }

  const loadPreviousCloses = async (): Promise<void> => {
    // Daily history provides an actual prior close; unknown changes remain null.
    await Promise.all(
      localState.assets.map(async (a) => {
        try {
          const bars = await candles(a.symbol, '3M')
          const today = new Date().toISOString().slice(0, 10)
          const previous = bars
            .filter(
              (b) => new Date(b.time * 1000).toISOString().slice(0, 10) < today,
            )
            .at(-1)
          if (previous) previousCloses.set(a.symbol, previous.close)
        } catch {
          /* The stream still works when historical access is unavailable. */
        }
      }),
    )
  }

  const connect = (): void => {
    if (stopped || failed) return
    localState.status.state = attempts ? 'reconnecting' : 'connecting'
    localOnUpdate()
    const socket = (localWs = new WebSocket(
      `wss://stream.data.alpaca.markets/v2/${feed}`,
      { handshakeTimeout: 10000 },
    ))
    socket.on('open', () => {
      authenticationTimer = setTimeout(() => socket.terminate(), 10000)
      alive = true
      socket.send(
        JSON.stringify({ action: 'auth', key: key, secret: secret }),
      )
      watchdog = setInterval(() => {
        if (!alive) {
          socket.terminate()
          return
        }
        alive = false
        socket.ping()
      }, 20000)
    })
    socket.on('pong', () => {
      alive = true
    })
    socket.on('message', (raw) => {
      if (stopped || localWs !== socket) return
      let messages: AlpacaEvent[]
      try {
        messages = z.array(eventSchema).parse(JSON.parse(raw.toString()))
      } catch {
        localState.status.message =
          'Invalid market data received. Reconnecting.'
        localOnUpdate()
        socket.close()
        return
      }
      for (const item of messages) {
        const parsed = eventSchema.safeParse(item)
        if (!parsed.success) continue
        const e = parsed.data
        if (e.T === 'success' && e.msg === 'authenticated') {
          clearTimeout(authenticationTimer)
          socket.send(
            JSON.stringify({
              action: 'subscribe',
              trades: localState.assets.map((a) => a.symbol),
              quotes: localState.assets.map((a) => a.symbol),
            }),
          )
          localState.status = {
            ...localState.status,
            state: 'connected',
            message: 'Live exchange data. Paper trading only.',
          }
        }
        if (e.T === 'error') {
          localState.status.state = 'disconnected'
          localState.status.message = `Provider rejected connection (code ${e.code ?? 'unknown'}). Check credentials, feed access, and symbol limits.`
          failed = true
          socket.close()
        }
        if (
          (e.T !== 't' && e.T !== 'q') ||
          !e.S ||
          !localState.assets.some((a) => a.symbol === e.S) ||
          !e.t
        )
          continue
        const index = indices.get(e.S)
        const existing =
          index === undefined ? undefined : localState.quotes[index]
        const quote = localProcessor.process(
          item,
          existing,
          previousCloses.get(e.S) ?? null,
        )
        if (!quote) continue
        if (index === undefined) {
          indices.set(e.S, localState.quotes.length)
          localState.quotes.push(quote)
        } else localState.quotes[index] = quote
        if (e.T === 't') {
          const trail = (localState.trails[e.S] ??= [])
          trail.push(quote.price)
          if (trail.length > 30) trail.shift()
        }
        localState.status.lastMessageAt = Date.now()
        attempts = 0
        localOnUpdate()
      }
      localOnUpdate()
    })
    socket.on('error', () => {
      localState.status.message =
        'Market connection interrupted. Retrying automatically.'
    })
    socket.on('close', () => {
      if (localWs !== socket) return
      clearInterval(watchdog)
      clearTimeout(authenticationTimer)
      if (stopped || failed) {
        localOnUpdate()
        return
      }
      localState.status.state = 'reconnecting'
      localOnUpdate()
      retry = setTimeout(
        () => connect(),
        Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)),
      )
    })
  }

  const candles = async (symbol: string, range: Range): Promise<Candle[]> => {
    const cacheKey = `${symbol}:${range}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.at < 60000) return cached.bars
    const config = RANGE_CONFIG[range]
    const params = new URLSearchParams({
      symbols: symbol,
      timeframe: config.interval,
      start: new Date(Date.now() - config.days * 86400000).toISOString(),
      feed: feed,
      limit: '10000',
      adjustment: 'split',
      sort: 'asc',
    })
    const response = await fetch(
      `https://data.alpaca.markets/v2/stocks/bars?${params}`,
      { headers: headers(), signal: AbortSignal.timeout(10000) },
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
    cache.set(cacheKey, { at: Date.now(), bars })
    return bars
  }

  const stop = (): void => {
    stopped = true
    clearTimeout(retry)
    clearTimeout(authenticationTimer)
    clearInterval(watchdog)
    localWs?.close()
  }

  localState = {
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

  return { snapshot, start, candles, stop }
}
export type AlpacaProvider = ReturnType<typeof createAlpacaProvider>
