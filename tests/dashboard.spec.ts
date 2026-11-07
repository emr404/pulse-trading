import { test, expect } from '@playwright/test'
test('terminal streams stocks, charts, watchlists, trades, navigation and mobile', async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Market overview.' }),
  ).toBeVisible()
  await expect(page.locator('.connection-badge')).toHaveText('Connected')
  await expect(page.locator('.simulation-banner')).toContainText(
    'SIMULATED DATA',
  )
  await expect(page.locator('.chart-bottom')).toContainText('288 bars')
  const first = await page.locator('.chart-price-row strong').innerText()
  await expect
    .poll(() => page.locator('.chart-price-row strong').innerText(), {
      timeout: 10000,
    })
    .not.toBe(first)
  await page.getByRole('button', { name: '1W', exact: true }).click()
  await expect(page.locator('.chart-bottom')).toContainText('168 bars')
  await page.getByRole('button', { name: '1Y', exact: true }).click()
  await expect(page.locator('.chart-bottom')).toContainText('365 bars')
  await page.getByRole('button', { name: '1D', exact: true }).click()
  await expect(page.locator('.chart-bottom')).toContainText('288 bars')
  await page.getByRole('button', { name: 'Expand chart' }).click()
  await expect(page.locator('.chart-panel')).toHaveClass(/expanded/)
  await page.keyboard.press('Escape')
  await expect(page.locator('.chart-panel')).not.toHaveClass(/expanded/)
  await page.getByRole('button', { name: 'Search stocks, companies…' }).click()
  await page
    .getByRole('textbox', { name: 'Search stocks', exact: true })
    .fill('meta')
  await page.locator('.search-result').click()
  await expect(page.locator('.chart-asset h2')).toContainText('META')
  await page.getByRole('button', { name: 'Add stock to watchlist' }).click()
  await page
    .getByRole('textbox', { name: 'Search stocks', exact: true })
    .fill('meta')
  await page.locator('.search-result').click()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Select META', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Select META', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Remove META', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Select META', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Sort by percentage change' }).click()
  const changes = await page.locator('.watch-select .change').allTextContents()
  expect(parseFloat(changes[0])).toBeGreaterThanOrEqual(
    parseFloat(changes[changes.length - 1]),
  )
  await page.getByRole('button', { name: 'Select AAPL', exact: true }).click()
  await page.getByLabel('Quantity', { exact: false }).fill('1000000')
  await expect(page.getByText('Insufficient buying power.')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Buy AAPL', exact: true }),
  ).toBeDisabled()
  await page.getByLabel('Quantity', { exact: false }).fill('1')
  await page.getByRole('button', { name: 'Buy AAPL', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Bought 1 AAPL')
  await page.reload()
  await expect(page.locator('.portfolio-panel tbody')).toContainText('AAPL')
  await page.getByRole('button', { name: 'Sell', exact: true }).click()
  await page.getByLabel('Quantity', { exact: false }).fill('1')
  await page.getByRole('button', { name: 'Sell AAPL', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Sold 1 AAPL')
  const invalid = await request.post('/api/orders', {
    data: { symbol: 'AAPL', side: 'buy', quantity: -1 },
  })
  expect(invalid.status()).toBe(400)
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Activity', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Trading activity.' }),
  ).toBeVisible()
  await expect(page.locator('tbody')).toContainText('Buy AAPL')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('switch').click()
  await expect(page.getByRole('switch')).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Overview', exact: true })
    .click()
  await page.setViewportSize({ width: 1440, height: 1100 })
  await expect(page.locator('.chart-bottom')).toContainText('288 bars')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({
    path: 'test-results/pulse-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Portfolio', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Your portfolio.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Overview', exact: true })
    .click()
  await expect(page.locator('.sidebar')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, -204, 0)',
  )
  await page.screenshot({
    path: 'test-results/pulse-mobile.png',
    fullPage: true,
  })
  expect(errors).toEqual([])
})

test('WebSocket interruption pauses trading and reconnects', async ({
  page,
}) => {
  let connection: { close(): void } | undefined
  await page.routeWebSocket('**/ws', (socket) => {
    const server = socket.connectToServer()
    connection = server
    server.onMessage((data) => socket.send(data))
    server.onClose(() => socket.close())
  })
  await page.goto('/')
  await expect(page.locator('.connection-badge')).toHaveText('Connected')
  connection?.close()
  await expect(page.locator('.connection-badge')).toHaveText('Reconnecting')
  await expect(
    page.getByRole('button', { name: 'Buy AAPL', exact: true }),
  ).toBeDisabled()
  await expect(page.locator('.connection-badge')).toHaveText('Connected', {
    timeout: 15000,
  })
})

test('currency preference converts UI and chart labels without changing USD accounting', async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/exchange-rates', (route) =>
    route.fulfill({
      json: {
        base: 'USD',
        date: '2026-11-06',
        rates: { USD: 1, GBP: 0.8, EUR: 0.9 },
        cached: false,
      },
    }),
  )
  await page.goto('/')
  await expect(page.locator('.connection-badge')).toHaveText('Connected')
  await expect(page.locator('.ohlc')).toContainText('$')
  const before = (await (await request.get('/api/state')).json()).portfolio
  await page
    .locator('.topbar')
    .getByLabel('Display currency')
    .selectOption('GBP')
  await expect(page.locator('.chart-price-row strong')).toContainText('£')
  await expect(page.locator('.ohlc')).toContainText('£')
  await expect(page.locator('.chart-bottom')).toContainText('GBP')
  await expect(page.locator('.fx-notice')).toContainText('FX 2026-11-06')
  await expect(page.locator('.order-total')).toContainText('£')
  const unchanged = (await (await request.get('/api/state')).json()).portfolio
  expect(unchanged).toEqual(before)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.locator('#display-currency')).toHaveValue('GBP')
  await page.locator('#display-currency').selectOption('EUR')
  await page.reload()
  await expect(
    page.locator('.topbar').getByLabel('Display currency'),
  ).toHaveValue('EUR')
  await expect(page.locator('.chart-price-row strong')).toContainText('€')
  await page.getByLabel('Quantity', { exact: false }).fill('1')
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/orders') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Buy AAPL', exact: true }).click()
  const pending = await (await responsePromise).json()
  await expect(page.locator('.trade-result')).toContainText('Bought 1 AAPL')
  const filled = (await (await request.get('/api/state')).json()).portfolio
  expect(filled.orders[0].total).toBeCloseTo(filled.orders[0].price)
  expect(filled.cash).toBeCloseTo(before.cash - filled.orders[0].total)
  await expect(page.locator('.trade-result')).toContainText('USD')
  await page.getByRole('button', { name: 'Sell', exact: true }).click()
  await page.getByRole('button', { name: 'Sell AAPL', exact: true }).click()
  await expect(page.locator('.trade-result')).toContainText('Sold 1 AAPL')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  expect(errors).toEqual([])
})

test('missing exchange rates clearly fall back to USD', async ({ page }) => {
  await page.route('**/api/exchange-rates', (route) =>
    route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
  )
  await page.goto('/')
  await expect(page.locator('.connection-badge')).toHaveText('Connected')
  await page
    .locator('.topbar')
    .getByLabel('Display currency')
    .selectOption('GBP')
  await expect(page.locator('.fx-notice')).toContainText(
    'GBP unavailable · Displaying USD',
  )
  await expect(page.locator('.chart-price-row strong')).toContainText('$')
  await expect(page.locator('.chart-bottom')).toContainText('USD')
  await page
    .locator('.topbar')
    .getByLabel('Display currency')
    .selectOption('USD')
  await expect(page.locator('.fx-notice')).toHaveCount(0)
})

test('pending orders can be cancelled and rejected orders remain in Activity', async ({
  page,
  request,
}) => {
  await page.goto('/')
  await expect(page.locator('.connection-badge')).toHaveText('Connected')
  const before = (await (await request.get('/api/state')).json()).portfolio.cash
  await page.getByLabel('Quantity', { exact: false }).fill('1')
  await page.getByRole('button', { name: 'Buy AAPL', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel pending order' }).click()
  await expect(page.locator('.trade-result')).toContainText('Cancelled')
  const rejected = await request.post('/api/orders', {
    data: {
      id: crypto.randomUUID(),
      input: { symbol: 'AAPL', side: 'buy', quantity: 1000000 },
    },
  })
  expect(rejected.status()).toBe(202)
  const id = (await rejected.json()).id
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/orders/${id}`)).json()).order.state,
    )
    .toBe('rejected')
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Activity', exact: true })
    .click()
  await expect(
    page
      .locator('.order-lifecycle-row')
      .filter({ hasText: 'cancelled' })
      .first(),
  ).toBeVisible()
  await expect(
    page
      .locator('.order-lifecycle-row')
      .filter({ hasText: 'rejected' })
      .first(),
  ).toContainText('cash')
  expect((await (await request.get('/api/state')).json()).portfolio.cash).toBe(
    before,
  )
})

test('isolates unrelated symbol renders and restores stale prices after a snapshot', async ({
  page,
  request,
}) => {
  const state = await (await request.get('/api/state')).json()
  let wire: { send(data: string): void } | undefined
  const initial = {
    type: 'snapshot',
    session: 'render-test',
    sequence: 0,
    assets: state.assets,
    quotes: state.quotes,
    trails: state.trails,
    candles: [],
    status: state.status,
  }
  await page.routeWebSocket('**/ws', (socket) => {
    wire = socket
    socket.onMessage(() => {
      socket.send(JSON.stringify(initial))
      socket.send(JSON.stringify({ type: 'portfolio', data: state.portfolio }))
    })
  })
  await page.goto('/')
  await expect(page.locator('.connection-badge')).toHaveText('Connected')
  await expect(page.locator('.chart-bottom')).toContainText('288 bars')
  await page.evaluate(() => {
    const target = window as Window & { pulseRenders: string[] }
    target.pulseRenders = []
    new PerformanceObserver((list) => {
      target.pulseRenders.push(
        ...list
          .getEntries()
          .filter((e) => e.name.includes('render'))
          .map((e) => e.name),
      )
    }).observe({ entryTypes: ['measure'] })
  })
  const nvda = state.quotes.find((q: { symbol: string }) => q.symbol === 'NVDA')
  for (let i = 1; i <= 30; i++) {
    wire!.send(
      JSON.stringify({
        ...initial,
        type: 'delta',
        assets: undefined,
        sequence: i,
        quotes: [
          {
            ...nvda,
            price: nvda.price + i / 100,
            updatedAt: Date.now(),
            quoteAt: Date.now(),
          },
        ],
        trails: {},
      }),
    )
  }
  await expect(
    page.getByRole('button', { name: 'Select NVDA', exact: true }),
  ).toContainText((nvda.price + 0.3).toFixed(2))
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as Window & { pulseRenders: string[] }).pulseRenders.some(
          (name) => name.includes('WatchlistRow'),
        ),
      ),
    )
    .toBe(true)
  const renders = await page.evaluate(
    () => (window as Window & { pulseRenders: string[] }).pulseRenders,
  )
  expect(renders.some((name) => name.includes('WatchlistRow'))).toBe(true)
  expect(renders.filter((name) => name === '<App> render')).toHaveLength(0)
  expect(
    renders.filter((name) => name === '<MarketChart> render'),
  ).toHaveLength(0)
  const aapl = state.quotes.find((q: { symbol: string }) => q.symbol === 'AAPL')
  wire!.send(
    JSON.stringify({
      ...initial,
      session: 'stale-test',
      quotes: [
        { ...aapl, updatedAt: Date.now() - 61000, quoteAt: Date.now() - 61000 },
      ],
    }),
  )
  await expect(page.locator('.stale-notice')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Buy AAPL', exact: true }),
  ).toBeDisabled()
  wire!.send(
    JSON.stringify({
      ...initial,
      session: 'stale-test',
      type: 'delta',
      sequence: 1,
      quotes: [{ ...aapl, updatedAt: Date.now(), quoteAt: Date.now() }],
    }),
  )
  await expect(page.locator('.stale-notice')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Buy AAPL', exact: true }),
  ).toBeEnabled()
})
