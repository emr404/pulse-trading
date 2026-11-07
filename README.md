# Ledger

A stock trading terminal with streaming prices, candlestick charts, watchlists and paper trading. All trades use virtual money.

## Run locally

Requires Node.js 22.12 or later.

```sh
npm install
npm run dev:demo
```

Open http://127.0.0.1:5173. No API keys are needed for simulated prices.

## Publish

### 1. Host the backend

Use a Node.js host with WebSocket support and persistent storage.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Set `HOST=0.0.0.0` and `MARKET_MODE=demo`.
- Set `FRONTEND_ORIGIN=https://YOUR-USERNAME.github.io` (no repository path).
- Set `DATA_FILE` to a JSON file on the host's persistent disk.

The host must provide HTTPS and secure WebSockets. Check `https://YOUR-BACKEND/api/health` returns `{"status":"ok"}`.

This is a shared paper account: all visitors use the same balance and holdings. There is no sign-in or account isolation. Origin restrictions are not authentication.

### 2. Publish the frontend on GitHub Pages

1. Push this project to a GitHub repository on `main`.
2. Under **Settings → Secrets and variables → Actions → Variables**, add `VITE_API_URL` with your backend origin, such as `https://pulse-api.example.com` (no `/api` suffix).
3. Under **Settings → Pages**, select **GitHub Actions**.
4. Under **Actions → Publish Ledger to GitHub Pages**, select **Run workflow**.
5. Find the website link under **Settings → Pages** when deployment finishes.

Future pushes to `main` deploy automatically. Repository names need no code changes. WebSockets use the backend's `/ws` address automatically; add a `VITE_WS_URL` repository variable only if your host uses a different address. Redeploy after changing either variable.

## Optional live prices

Set `MARKET_MODE=live`, `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` on the backend. Keep keys off GitHub and never put them in `VITE_` variables. Orders remain simulated.

For local configuration, copy `.env.example` to `.env` and run `npm run dev`.
