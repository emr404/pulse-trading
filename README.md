# Pulse — Stock Trading Terminal

A Vue 3 + TypeScript stock terminal with streaming quotes, TradingView candlesticks and volume, a persistent watchlist, market movers, and simulated trading. This is a single-user local portfolio project, not a brokerage application.

## Start

Requires Node.js **22.12 or later**.

```sh
npm install
npm run dev:demo
```

Open **http://127.0.0.1:5173**. No keys are required. The server sends simulated stock quotes over a real WebSocket; prices, historical charts and sparkline data are clearly labelled as simulated. The account starts with **$10,000 virtual cash** and no positions. Demo history runs continuously, including weekends, and is not exchange history.

`npm run dev` respects `.env`; it defaults to demo mode. The market strip shows ETF prices for SPY, QQQ and DIA, not the underlying index levels.

## Live stock data

1. Copy `.env.example` to `.env`.
2. Set `MARKET_MODE=live`, `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` using an Alpaca account with market-data access.
3. Choose `ALPACA_FEED=iex` (default) or `sip` if your subscription allows it.
4. Restart with `npm run dev`.

The backend authenticates to Alpaca's WebSocket, subscribes to stock trades/quotes, retrieves historical bars over REST and forwards normalized data to the browser. The API keys stay server-side and must never use a `VITE_` prefix. No brokerage or order-execution endpoints are called.

Missing credentials trigger a labelled demo fallback. Invalid credentials or provider rejection produce an explicit disconnected/error state; real prices are never silently mixed with simulated data. Feed availability and symbol limits depend on your account. Live charts may be empty outside a selected date range or if historical data access is denied; a message and retry control are shown. Short live ranges represent trailing calendar time, so the one-day chart can be empty on weekends. The UI's regular-hours indicator uses the US weekday schedule and is not a holiday calendar.

Daily changes use the latest historical close before the current date; until available, percentage changes show a dash. High/low and live volume accumulate during the server session. Sparklines show the recent stream. Historical volume is provided by the selected feed. Live chart candles incorporate subsequent trade/quote updates; these are visual approximations, not official finalized exchange bars. Stale quotes cannot fill orders. Available balances and holdings can still be viewed while disconnected.

Provider references:
- [Alpaca WebSocket authentication and subscriptions](https://docs.alpaca.markets/us/docs/streaming-market-data)
- [Alpaca real-time stock message schemas](https://docs.alpaca.markets/us/docs/real-time-stock-pricing-data)
- [Alpaca historical stock bars](https://docs.alpaca.markets/us/reference/stockbars)

## Configuration and persistence

- `MARKET_SYMBOLS`: up to 50 comma-separated US stock/ETF symbols. The default catalogue includes AAPL, NVDA, TSLA, MSFT, AMZN, GOOGL, META, AMD, JPM, SPY, QQQ and DIA. Additional symbols display their ticker as their name. In demo mode unknown tickers start at a synthetic $100.
- `PORT`: API port; Vite reads the same value for its HTTP and WebSocket proxy.
- `HOST`: defaults to loopback (`127.0.0.1`).
- `DATA_FILE`: optional portfolio file override. Defaults to `.data/stocks-demo.json` or `.data/stocks-live.json`.
- Watchlist and price-highlight preferences: browser local storage.

Old crypto portfolio files are preserved. Paper trades execute at current bid/ask, use decimal arithmetic, reject overspending/overselling and quotes older than 60 seconds, and persist atomically before confirmation. Simulated trading has no fees or slippage model and stores the latest 200 fills. If a held symbol is removed from configuration or a quote becomes stale, the portfolio explicitly labels its valuation as estimated.

This local app has no authentication or multi-user isolation. Keep it on loopback; public hosting would require authentication, authorization, durable user-scoped storage and deployment-specific hardening.

## Architecture

```text
shared/types.ts                 Asset catalogue and typed market/trading contracts
server/providers/types.ts       Swappable market-provider interface
server/providers/demo.ts        Deterministic mock history and simulated streaming
server/providers/alpaca.ts      Server-side live WebSocket adapter + historical REST
server/index.ts                 Express API, WebSocket fan-out and order handling
server/trading.ts               Pure validated order calculations
server/portfolio.ts             Validated atomic portfolio storage
server/market-hub.ts            Batched deltas and live OHLCV aggregation
server/order-manager.ts         Pending, filled, cancelled and rejected requests
src/modules/market/             Granular market state and resilient connection
src/modules/chart/              Chart lifecycle and incremental candle updates
src/modules/orders/             Order submission, reconciliation and validation
src/modules/portfolio/          Account state and decimal valuation
src/stores/terminal.ts          UI facade, watchlist and selection preferences
src/composables/useMarketStream.ts  Vue lifecycle integration and freshness timer
src/components/                Chart, watchlist, search, movers, trade and account panels
src/lib/format.ts               Shared formatting and HTTP utilities
src/style.css                  Tailwind entry point and terminal design system
```

The design system is documented in [docs/design-system.md](docs/design-system.md). The UI has keyboard search (Cmd/Ctrl+K), focus-trapped search dialogs, accessible labels, reduced-motion support and responsive navigation.

## Verification and production build

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm start
```

`npm start` serves the production build and WebSocket/API at **http://127.0.0.1:3001**. It also respects `.env`.

Browser tests run separate servers on ports 5174/3002 with an isolated stock portfolio in `.data/e2e-stocks.json`. They cover streamed updates, chart timeframes, watchlist editing/persistence/sorting, order validation and fills, saved positions, navigation, mobile overflow, and WebSocket reconnection. Screenshots are written under `test-results/`.

Live credentials are not included. Live-provider authentication and subscription behavior is unit-tested with a mocked transport; actual account entitlements and provider connectivity require your keys.

## Display currency

Use the top-bar currency selector or **Settings → Display currency** to choose USD, GBP or EUR. The choice is saved in this browser. Prices, chart price labels/OHLC, holdings, totals and transaction-history amounts convert for display; all portfolio calculations, percentage returns, order validation and actual paper fills remain USD-based. Fill confirmations explicitly show the USD execution price.

The backend fetches daily ECB reference rates through [Frankfurter](https://frankfurter.dev/), validates the response and caches it for one hour. No extra API key is needed. The UI shows the reference date; historical charts and transaction amounts use that same current reference rate, not historical FX rates. Reference rates are indicative, not executable currency quotes. If refresh fails, existing rates are labelled cached; if no rates are available, amounts stay in USD with an explicit notice. Settings includes a refresh control, and open sessions check hourly.

## Engineering architecture

See [docs/architecture.md](docs/architecture.md) for the implemented market-data pipeline, sequenced delta protocol, per-symbol reactivity, candle aggregation, connection recovery, order lifecycle, portfolio valuation, measured validation and explicit limitations.

Paper orders now enter a cancellable **pending** state for 700 ms before execution. Activity displays filled, cancelled and rejected requests. Pending requests surviving a server restart are cancelled; existing balances and older fills are preserved. The order API now accepts an idempotency UUID and an `input` object (see the architecture document).

`npm test` includes a synthetic 10,000-event/50-symbol workload and checks that unrelated reactive consumers stay untouched. Playwright enables development-only Vue performance tracing to verify component render isolation. To inspect traces manually, start Vite with `VITE_PROFILE_RENDER=1`; production profiling remains disabled.
