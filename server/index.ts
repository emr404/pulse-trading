import 'dotenv/config'
import { ExchangeRateService } from './exchange-rates.js'
import express from 'express'
import { z } from 'zod'
import { MarketHub } from './market-hub.js'
import { OrderManager } from './order-manager.js'
import type { ServerMessage } from '../shared/protocol.js'
import { resolve } from 'node:path'
import { WebSocketServer, WebSocket } from 'ws'
import {
  ASSETS,
  RANGES,
  type Asset,
  type Range,
  type StreamMessage,
} from '../shared/types.js'
import { PortfolioStore } from './portfolio.js'
import {
  executeOrder,
  orderSchema,
  TradingError,
  symbolSchema,
} from './trading.js'
import { DemoProvider } from './providers/demo.js'
import { AlpacaProvider } from './providers/alpaca.js'
import type { MarketProvider } from './providers/types.js'

const symbols = [
  ...new Set(
    (process.env.MARKET_SYMBOLS || ASSETS.map((a) => a.symbol).join(','))
      .split(',')
      .map((s) => symbolSchema.parse(s.trim().toUpperCase())),
  ),
].slice(0, 50)
const assets: Asset[] = symbols.map(
  (symbol) =>
    ASSETS.find((a) => a.symbol === symbol) ?? {
      symbol,
      name: symbol,
      sector: 'US equity',
      color: '#8d9cae',
      demoPrice: 100,
      demoChange: 0,
    },
)
const liveRequested = process.env.MARKET_MODE === 'live'
const hasKeys = Boolean(
  process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY,
)
const provider: MarketProvider =
  liveRequested && hasKeys
    ? new AlpacaProvider(
        assets,
        process.env.ALPACA_API_KEY!,
        process.env.ALPACA_SECRET_KEY!,
        process.env.ALPACA_FEED === 'sip' ? 'sip' : 'iex',
      )
    : new DemoProvider(
        assets,
        liveRequested
          ? 'Alpaca credentials are missing. Using clearly simulated data.'
          : undefined,
      )
const mode = provider.snapshot().status.mode
const store = new PortfolioStore(
  process.env.DATA_FILE || `.data/stocks-${mode}.json`,
)
const app = express()
app.use(express.json({ limit: '8kb' }))
const exchangeRates = new ExchangeRateService()
app.get('/api/exchange-rates', async (_req, res) => {
  try {
    res.json(await exchangeRates.get())
  } catch (error) {
    res.status(503).json({
      error:
        error instanceof Error ? error.message : 'Exchange rates unavailable.',
    })
  }
})
app.get('/api/state', (_req, res) =>
  res.json({ ...provider.snapshot(), portfolio: store.get() }),
)
app.get('/api/candles', async (req, res) => {
  const symbol = String(req.query.symbol || '')
  const range = String(req.query.range || '1D')
  if (!symbols.includes(symbol) || !RANGES.includes(range as Range)) {
    res.status(400).json({ error: 'Choose a supported stock and timeframe.' })
    return
  }
  try {
    const candles = await provider.candles(symbol, range as Range)
    res.json({
      candles,
      mode,
      live: hub
        .snapshot()
        .candles.filter((b) => b.symbol === symbol && b.range === range),
    })
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error
          ? error.message
          : 'Unable to load historical data.',
    })
  }
})
const manager = new OrderManager(
  store,
  () => provider.snapshot(),
  (portfolio) => broadcast({ type: 'portfolio', data: portfolio }),
)
app.post('/api/orders', (req, res, next) => {
  const parsed = z
    .object({ id: z.string().uuid(), input: orderSchema })
    .safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid order instructions.' })
    return
  }
  try {
    res.status(202).json(manager.submit(parsed.data.id, parsed.data.input))
  } catch (error) {
    if (error instanceof TradingError)
      res.status(409).json({ error: error.message })
    else next(error)
  }
})
app.get('/api/orders/:id', (req, res) => {
  const order = manager.get(req.params.id)
  if (!order) {
    res.status(404).json({ error: 'Order not found.' })
    return
  }
  res.json({ order, portfolio: store.get() })
})
app.post('/api/orders/:id/cancel', (req, res, next) => {
  try {
    res.json({ order: manager.cancel(req.params.id), portfolio: store.get() })
  } catch (error) {
    if (error instanceof TradingError)
      res.status(404).json({ error: error.message })
    else next(error)
  }
})
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' })
})
app.use(express.static(resolve('dist')))
app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error.message)
    res.status(error instanceof SyntaxError ? 400 : 500).json({
      error:
        error instanceof SyntaxError
          ? 'Invalid JSON.'
          : 'Unable to complete request. Your order was not accepted.',
    })
  },
)
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || '127.0.0.1',
  () =>
    console.log(
      `Pulse: http://127.0.0.1:${process.env.PORT || 3001} · ${mode} stock data`,
    ),
)
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 })
const hub = new MarketHub(() => provider.snapshot())
function sendEncoded(socket: WebSocket, payload: string) {
  if (socket.readyState !== WebSocket.OPEN) return
  if (socket.bufferedAmount > 1000000) {
    socket.close(1013, 'Slow consumer; reconnect for snapshot')
    return
  }
  socket.send(payload)
}
function send(socket: WebSocket, message: ServerMessage) {
  sendEncoded(socket, JSON.stringify(message))
}
function broadcast(message: ServerMessage) {
  const payload = JSON.stringify(message)
  for (const client of wss.clients) sendEncoded(client, payload)
}
wss.on('connection', (socket) => {
  const snapshot = () => {
    hub.capture()
    send(socket, hub.snapshot())
    send(socket, { type: 'portfolio', data: store.get() })
  }
  snapshot()
  socket.on('message', (raw) => {
    try {
      const request: unknown = JSON.parse(raw.toString())
      if (
        request &&
        typeof request === 'object' &&
        'type' in request &&
        (request.type === 'subscribe' || request.type === 'resync')
      )
        snapshot()
    } catch {
      socket.close(1008, 'Invalid subscription')
    }
  })
  socket.on('error', () => socket.terminate())
})
provider.start(() => hub.capture())
hub.capture()
const updates = setInterval(() => {
  const frame = hub.flush()
  if (frame) broadcast(frame)
}, 100)
const heartbeat = setInterval(
  () =>
    broadcast({
      type: 'heartbeat',
      session: hub.session,
      sequence: hub.sequence,
    }),
  10000,
)
function stop() {
  clearInterval(updates)
  clearInterval(heartbeat)
  provider.stop()
  manager.stop()
  for (const client of wss.clients) client.terminate()
  wss.close()
  server.close()
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
